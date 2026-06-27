/**
 * AgriPoulet Pro — Cloudflare Worker pour notifications push FCM (v2)
 * 
 * Utilise l'API FCM HTTP v1 (recommandée) avec un compte de service Firebase.
 * Remplace la Cloud Function Firebase (qui nécessite Blaze plan payant).
 * 
 * Déploiement :
 *   1. npx wrangler deploy
 *   2. npx wrangler secret put FCM_SERVICE_ACCOUNT
 *      → Collez le contenu du fichier JSON du compte de service
 *   3. L'URL du Worker : https://agripoulet-push.votre-sous-domaine.workers.dev
 * 
 * 🔑 Obtenir le compte de service Firebase :
 *   Firebase Console → ⚙️ Project Settings → Service Accounts
 *   → "Generate new private key" → Téléchargez le fichier JSON
 */

// ── Utilitaires JWT ────────────────────────────────────

/**
 * Encode un objet en base64url (sans padding)
 */
function base64url(data) {
  const uint8 = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data;
  const base64 = btoa(String.fromCharCode(...new Uint8Array(uint8)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Signe un header + payload JWT avec une clé privée RSA (RS256)
 */
async function signJWT(header, payload, privateKeyPem) {
  // Nettoyer la clé PEM
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKeyPem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');

  // Décoder la clé DER
  const derBytes = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  // Importer la clé privée
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    derBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Construire le message à signer
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const message = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  // Signer
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    message
  );

  return `${headerB64}.${payloadB64}.${base64url(signature)}`;
}

/**
 * Échange un JWT signé contre un access token OAuth2
 */
async function getAccessToken(saEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: saEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600, // 1 heure
  };

  const jwt = await signJWT(header, payload, privateKey);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OAuth2 error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.access_token;
}

// ── Cache des tokens OAuth2 ──
// On conserve le token en mémoire pour éviter de regénérer un JWT à chaque appel
let cachedToken = null;
let tokenExpiry = 0;

async function getCachedAccessToken(saEmail, privateKey) {
  const now = Date.now();
  // Renouveler 5 min avant expiration
  if (cachedToken && tokenExpiry > now + 300000) {
    return cachedToken;
  }
  cachedToken = await getAccessToken(saEmail, privateKey);
  tokenExpiry = now + 3300000; // 55 min (les tokens durent 1h)
  return cachedToken;
}

// ── Worker principal ───────────────────────────────────

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    // ── Validation ──
    let body;
    try { body = await request.json(); }
    catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { token, notification, data: extraData } = body;

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token FCM requis' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!notification?.title || !notification?.body) {
      return new Response(JSON.stringify({ error: 'Notification (title + body) requis' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Vérifier que le compte de service est configuré
    if (!env.FCM_SERVICE_ACCOUNT) {
      console.error('[FCM Worker] ⚠️ FCM_SERVICE_ACCOUNT non configuré');
      return new Response(JSON.stringify({ error: 'FCM_SERVICE_ACCOUNT not configured' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(env.FCM_SERVICE_ACCOUNT);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid FCM_SERVICE_ACCOUNT JSON' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      return new Response(JSON.stringify({ error: 'Invalid service account: missing client_email or private_key' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ── Obtenir un token OAuth2 ──
    let accessToken;
    try {
      accessToken = await getCachedAccessToken(
        serviceAccount.client_email,
        serviceAccount.private_key
      );
    } catch (e) {
      console.error('[FCM Worker] ❌ Erreur OAuth2:', e.message);
      return new Response(JSON.stringify({ success: false, error: 'OAuth2 failed', message: e.message }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ── Construction du message FCM v1 ──
    const projectId = serviceAccount.project_id;
    const fcmMessage = {
      message: {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          type: extraData?.type || 'general',
          url: extraData?.url || '/',
          ...(extraData || {}),
        },
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            icon: '/pwa-192x192.svg',
            badge: '/favicon.svg',
            vibrate: [200, 100, 200],
            requireInteraction: true,
          },
        },
      },
    };

    // ── Envoi à l'API FCM v1 ──
    try {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(fcmMessage),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('[FCM Worker] ❌ Erreur FCM v1:', response.status, JSON.stringify(result));

        // Token invalide → le client devra en générer un nouveau
        if (result.error?.details?.[0]?.errorCode === 'UNREGISTERED' ||
            result.error?.status === 'NOT_FOUND') {
          return new Response(JSON.stringify({
            success: false,
            error: 'token_expired',
            message: 'Token FCM invalide ou expiré',
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        return new Response(JSON.stringify({
          success: false,
          error: result.error?.message || result.error?.status || 'FCM API error',
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      console.log('[FCM Worker] ✅ Notification envoyée avec succès');
      return new Response(JSON.stringify({
        success: true,
        messageId: result?.name || 'unknown',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (error) {
      console.error('[FCM Worker] ❌ Erreur réseau:', error.message);
      return new Response(JSON.stringify({
        success: false,
        error: 'Network error',
        message: error.message,
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  },
};
