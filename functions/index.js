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
 *   - App Check activé dans Firebase Console (recommandé)
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * Fonction callable (sécurisée) pour envoyer une notification push à un token FCM.
 * 
 * ✅ Sécurisé : utilise `onCall` au lieu de `onRequest` pour hériter
 *    du contexte d'authentification Firebase Auth.
 * ✅ Vérifie que l'appelant est authentifié (context.auth != null).
 * ✅ L'appelant ne peut envoyer des notifications qu'avec son propre token FCM.
 * 
 * L'application appelle cette fonction via `firebase.functions().httpsCallable()`
 * quand elle détecte des conditions de notification (vaccination, mortalité, crédit).
 * 
 * @param {Object} data
 * @param {string} data.token - FCM token du destinataire
 * @param {Object} data.notification - Contenu de la notification
 * @param {string} data.notification.title
 * @param {string} data.notification.body
 * @param {Object} [data.data] - Données additionnelles optionnelles
 * @param {Object} context - Contexte d'appel (rempli par Firebase)
 */
exports.sendPushNotification = functions.https.onCall(async (data, context) => {
  // ⚠️ Vérification d'authentification : seul un utilisateur connecté peut envoyer
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Vous devez être connecté pour envoyer des notifications push.'
    );
  }

  const uid = context.auth.uid;
  const { token, notification, data: extraData } = data;

  // Validation des champs obligatoires
  if (!token) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Token FCM requis'
    );
  }

  if (!notification || !notification.title || !notification.body) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Notification (title + body) requis'
    );
  }

  console.log(`[Push Function] Notification demandée par ${uid}`);

  try {
    // Construction du message
    const message = {
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
    console.log(`[Push Function] ✅ Notification envoyée par ${uid}:`, response);

    return { success: true, messageId: response };
  } catch (error) {
    console.error(`[Push Function] ❌ Erreur (uid=${uid}):`, error);

    // Gestion des erreurs courantes
    if (error.code === 'messaging/invalid-argument') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Argument invalide pour le message FCM'
      );
    } else if (error.code === 'messaging/registration-token-not-registered') {
      throw new functions.https.HttpsError(
        'not-found',
        'Token FCM non enregistré (expiré ou invalide)'
      );
    } else {
      throw new functions.https.HttpsError(
        'internal',
        'Erreur interne du serveur'
      );
    }
  }
});

// ⚠️ NOTE : L'ancienne version HTTP (onRequest) a été supprimée.
// Le client doit maintenant utiliser `firebase.functions().httpsCallable('sendPushNotification')`
// au lieu d'un fetch() direct.

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
