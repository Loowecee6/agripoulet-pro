/**
 * AgriPoulet Pro — Firebase Cloud Functions
 * 
 * Envoi de notifications push FCM aux utilisateurs
 * 
 * Déploiement:
 *   1. firebase init functions (si pas déjà fait)
 *   2. cd functions && npm install
 *   3. firebase deploy --only functions
 * 
 * Configuration requise:
 *   - Firebase Blaze plan (pay-as-you-go) requis pour les Cloud Functions
 *   - Clé VAPID configurée dans Firebase Console → Cloud Messaging
 *   - Variable d'env VITE_FIREBASE_VAPID_KEY dans .env.local
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * Fonction HTTP callable pour envoyer une notification push à un token FCM
 * 
 * L'application appelle cette fonction quand elle détecte des conditions
 * de notification (vaccination, mortalité, crédit).
 * 
 * Corps de la requête (POST JSON):
 * {
 *   token: string,         // FCM token du destinataire
 *   notification: {         // Contenu de la notification
 *     title: string,
 *     body: string
 *   },
 *   data?: {                // Données additionnelles (optionnelles)
 *     type?: string,
 *     url?: string,
 *     ...
 *   }
 * }
 */
exports.sendPushNotification = functions.https.onRequest(async (req, res) => {
  // ⚠️ Sécurité basique : vérifier la méthode HTTP
  if (req.method !== 'POST') {
    res.status(405).send({ error: 'Méthode non autorisée. Utilisez POST.' });
    return;
  }

  try {
    const { token, notification, data } = req.body;

    // Validation
    if (!token) {
      res.status(400).send({ error: 'Token FCM requis' });
      return;
    }

    if (!notification || !notification.title || !notification.body) {
      res.status(400).send({ error: 'Notification (title + body) requis' });
      return;
    }

    // Construction du message
    const message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        type: data?.type || 'general',
        url: data?.url || '/',
        ...(data || {}),
      },
      // Android: haute priorité pour notification immédiate
      android: {
        priority: 'high',
        notification: {
          channelId: 'agripoulet_alerts',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      // Web : configuration push
      webpush: {
        headers: {
          Urgency: 'high',
        },
        notification: {
          icon: '/pwa-192x192.svg',
          badge: '/favicon.svg',
          vibrate: [200, 100, 200],
          requireInteraction: true,
        },
      },
    };

    // Envoi
    const response = await admin.messaging().send(message);
    console.log('[Push Function] ✅ Notification envoyée avec succès:', response);

    res.status(200).send({ success: true, messageId: response });
  } catch (error) {
    console.error('[Push Function] ❌ Erreur envoi notification:', error);

    // Gestion des erreurs courantes
    if (error.code === 'messaging/invalid-argument') {
      res.status(400).send({ error: 'Argument invalide pour le message FCM' });
    } else if (error.code === 'messaging/registration-token-not-registered') {
      res.status(410).send({ error: 'Token FCM non enregistré (expiré ou invalide)' });
    } else {
      res.status(500).send({ error: 'Erreur interne du serveur' });
    }
  }
});

/**
 * Fonction background déclenchée par Firestore pour envoyer
 * des notifications push lors de la création d'un document
 * dans la collection 'pushQueue/{docId}'
 * 
 * Utile pour les notifications programmées ou déclenchées par d'autres services
 */
exports.onPushQueueCreate = functions.firestore
  .document('pushQueue/{docId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    if (!data || !data.token) {
      console.log('[Push Queue] Document sans token, ignoré');
      return;
    }

    try {
      const message = {
        token: data.token,
        notification: {
          title: data.title || 'AgriPoulet Pro',
          body: data.body || '',
        },
        data: {
          type: data.type || 'general',
          url: data.url || '/',
        },
      };

      const response = await admin.messaging().send(message);
      console.log('[Push Queue] ✅ Notification envoyée:', response);

      // Supprimer le document de la queue après envoi
      await snap.ref.delete();
    } catch (error) {
      console.error('[Push Queue] ❌ Erreur:', error);

      // Token invalide → supprimer le document
      if (error.code === 'messaging/registration-token-not-registered') {
        await snap.ref.delete();
      }
    }
  });

/**
 * Commande pour déployer la fonction:
 *   firebase deploy --only functions:sendPushNotification
 * 
 * Après déploiement, récupérez l'URL:
 *   https://us-central1-VOTRE_PROJECT_ID.cloudfunctions.net/sendPushNotification
 * 
 * Mettez cette URL dans l'app (elle sera stockée dans AppData.fcmPushFunctionUrl)
 */
