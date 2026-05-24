// services/notificationService.ts
// Gestion des notifications push et locales pour AgriPoulet Pro
// v2: Support FCM push distant avec VAPID key + Cloud Function

import { getMessaging, getToken, onMessage, deleteToken } from 'firebase/messaging';
import { AppData, NotificationPrefs, Sale, ProductionBatch } from '../types';
import { checkAllNotifications, countBySeverity } from './notificationChecks';
import type { NotificationEvent } from './notificationChecks';

export type { NotificationEvent };
import firebaseApp, { VAPID_KEY } from './firebaseConfig';

let notificationIdCounter = 0;

// ── Permission & Token ─────────────────────────────────

/**
 * Demande la permission d'afficher des notifications navigateur
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.log('[Notif] Les notifications ne sont pas supportées sur ce navigateur');
    return false;
  }

  if (Notification.permission === 'granted') return true;

  if (Notification.permission === 'denied') {
    console.log('[Notif] Permission déjà refusée');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

/**
 * Vérifie si les notifications sont autorisées
 */
export const hasNotificationPermission = (): boolean => {
  return 'Notification' in window && Notification.permission === 'granted';
};

let fcmInitialized = false;

/**
 * Enregistre le Service Worker FCM et initialise Firebase Messaging
 */
export const initFCM = async (): Promise<boolean> => {
  if (fcmInitialized) return true;
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;

  try {
    // 1. Enregistrer le Service Worker FCM
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    // 2. Attendre que le SW soit actif
    await new Promise<void>((resolve) => {
      if (registration.active) {
        resolve();
      } else {
        registration.addEventListener('activate', () => resolve());
        setTimeout(resolve, 3000);
      }
    });

    // 3. Envoyer la config Firebase au SW
    const config = (firebaseApp as any).options;

    if (registration.active) {
      registration.active.postMessage({
        type: 'FIREBASE_CONFIG',
        config: {
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
          storageBucket: config.storageBucket,
          messagingSenderId: config.messagingSenderId,
          appId: config.appId,
        },
      });
    }

    // 4. Attendre que le SW soit prêt (timeout 5s)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('[Notif] Timeout waiting for SW ack, continuing anyway');
        resolve();
      }, 5000);

      const messageHandler = (event: MessageEvent) => {
        if (event.data?.type === 'PONG') {
          clearTimeout(timeout);
          navigator.serviceWorker.removeEventListener('message', messageHandler);
          resolve();
        }
      };
      navigator.serviceWorker.addEventListener('message', messageHandler);

      if (registration.active) {
        registration.active.postMessage({ type: 'PING' });
      } else {
        clearTimeout(timeout);
        navigator.serviceWorker.removeEventListener('message', messageHandler);
        resolve();
      }
    });

    // 5. Initialiser Firebase Messaging côté client
    const messaging = getMessaging(firebaseApp);

    // 6. Écouter les messages en premier plan
    onMessage(messaging, (payload) => {
      console.log('[Notif] Message reçu en premier plan:', payload);
      if (payload.notification?.title && payload.notification?.body) {
        showLocalNotification(payload.notification.title, payload.notification.body);
      }
    });

    fcmInitialized = true;
    return true;
  } catch (e) {
    console.error('[Notif] Erreur init FCM:', e);
    return false;
  }
};

/**
 * Obtient le token FCM (nécessite une clé VAPID dans Firebase Console)
 * La clé VAPID est lue depuis VITE_FIREBASE_VAPID_KEY dans .env.local
 */
export const getFCMToken = async (): Promise<string | null> => {
  if (!hasNotificationPermission()) return null;

  if (!VAPID_KEY) {
    console.warn('[Notif] ⚠️ Clé VAPID non configurée. Les push distants ne fonctionneront pas.');
    console.warn('[Notif] Ajoutez VITE_FIREBASE_VAPID_KEY=votre_cle dans .env.local');
    console.warn('[Notif] Obtenez la clé ici: Firebase Console → Project Settings → Cloud Messaging → Web Push certificates');
    return null;
  }

  try {
    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    console.log('[Notif] ✅ FCM Token obtenu avec VAPID key');
    return token;
  } catch (e) {
    console.error('[Notif] Erreur récupération token FCM:', e);
    return null;
  }
};

/**
 * Rafraîchit le token FCM (supprime l'ancien, en crée un nouveau)
 */
export const refreshFCMToken = async (): Promise<string | null> => {
  try {
    const messaging = getMessaging(firebaseApp);
    await deleteToken(messaging);
    console.log('[Notif] Ancien token FCM supprimé');
    return await getFCMToken();
  } catch (e) {
    console.error('[Notif] Erreur rafraîchissement token FCM:', e);
    return null;
  }
};

/**
 * Envoie une notification push via la Cloud Function
 * @param fcmFunctionUrl - URL de la Cloud Function (stockée dans AppData.fcmPushFunctionUrl)
 * @param token - Token FCM du destinataire
 * @param title - Titre de la notification
 * @param body - Corps de la notification
 * @param type - Type de notification (pour le tag/déduplication)
 */
export const sendRemotePush = async (
  fcmFunctionUrl: string,
  token: string,
  title: string,
  body: string,
  type: string = 'general'
): Promise<boolean> => {
  if (!fcmFunctionUrl || !token) {
    console.warn('[Notif] URL de fonction ou token manquant pour le push distant');
    return false;
  }

  try {
    const response = await fetch(fcmFunctionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        notification: { title, body },
        data: { type },
      }),
    });

    if (!response.ok) {
      console.error('[Notif] Échec envoi push distant:', response.status, await response.text());
      return false;
    }

    console.log('[Notif] ✅ Push distant envoyé avec succès');
    return true;
  } catch (e) {
    console.error('[Notif] Erreur envoi push distant:', e);
    return false;
  }
};

// ── Affichage de notification locale ────────────────────

/**
 * Affiche une notification navigateur native
 */
export const showLocalNotification = (title: string, body: string, options?: {
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
}): void => {
  if (!hasNotificationPermission()) return;

  try {
    new Notification(title, {
      body,
      icon: options?.icon || '/pwa-192x192.svg',
      badge: '/favicon.svg',
      tag: options?.tag || `agripoulet-${++notificationIdCounter}`,
      requireInteraction: options?.requireInteraction ?? true,
      vibrate: [200, 100, 200],
    } as NotificationOptions & { vibrate?: number[] });
  } catch (e) {
    console.error('[Notif] Erreur affichage notification:', e);
  }
};

// ── Vérifications des conditions importées de notificationChecks.ts ──
// Les fonctions checkVaccinationReminders, checkMortalityAlerts,
// checkCreditDeadlines, checkAllNotifications et countBySeverity
// ont été extraites dans un fichier dédié pour améliorer la maintenabilité.


// ── Affichage des notifications avec déduplication ──

const shownNotifIds = new Set<string>();

/**
 * Affiche les notifications locales pour des événements donnés
 * ET envoie les push distants si configurés
 * (évite les doublons via un Set d'IDs déjà affichés)
 */
export const showLocalNotificationsFor = (events: NotificationEvent[], data?: AppData): void => {
  for (const event of events) {
    if (shownNotifIds.has(event.id)) continue;
    shownNotifIds.add(event.id);

    if (shownNotifIds.size > 500) {
      const iter = shownNotifIds.values().next();
      if (iter.value) shownNotifIds.delete(iter.value);
    }

    // Afficher la notification locale
    showLocalNotification(event.title, event.body);

    // Envoyer un push distant si configuré (fire-and-forget avec log d'erreur)
    if (data?.fcmToken && data?.fcmPushFunctionUrl) {
      sendRemotePush(
        data.fcmPushFunctionUrl,
        data.fcmToken,
        event.title,
        event.body,
        event.type
      ).catch(e => console.error('[Notif] Push distant échoué:', e));
    }

    setTimeout(() => shownNotifIds.delete(event.id), 3600000);
  }
};

/**
 * Réinitialise le cache des notifications affichées
 */
export const resetShownNotifications = (): void => {
  shownNotifIds.clear();
};
