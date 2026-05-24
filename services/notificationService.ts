// services/notificationService.ts
// Gestion des notifications push et locales pour AgriPoulet Pro
// v2: Support FCM push distant avec VAPID key + Cloud Function

import { getMessaging, getToken, onMessage, deleteToken } from 'firebase/messaging';
import { AppData, NotificationPrefs, Sale, ProductionBatch } from '../types';
import firebaseApp, { VAPID_KEY } from './firebaseConfig';

// Types de notifications
export interface NotificationEvent {
  id: string;
  type: 'vaccination' | 'mortalite' | 'credit';
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'danger';
  date: Date;
  link?: string; // navigation hint
}

type CheckResult = NotificationEvent[];

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

// ── Vérifications des conditions ────────────────────────

/**
 * Vérifie les rappels de vaccination
 */
const checkVaccinationReminders = (data: AppData): CheckResult => {
  const results: CheckResult = [];
  const prefs = data.settings.notifications;
  if (!prefs?.vaccinationReminders) return results;

  const today = new Date();

  for (const batch of data.productionBatches) {
    if (batch.statut !== 'active') continue;

    const startDate = new Date(batch.dateMisePlace);
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / 86400000);
    const currentJour = Math.max(1, daysSinceStart + 1);

    for (const vax of batch.vaccinations) {
      if (vax.effectuee) continue;

      for (const jour of vax.jours) {
        const diff = jour - currentJour;
        if (diff >= 0 && diff <= 2) {
          results.push({
            id: `vax-${batch.id}-${vax.traitement}-${jour}`,
            type: 'vaccination',
            title: '💉 Rappel Vaccination',
            body: `"${batch.nom}" : ${vax.traitement} prévu au jour ${jour}`,
            severity: diff === 0 ? 'danger' : diff === 1 ? 'warning' : 'info',
            date: new Date(today.getTime() + diff * 86400000),
          });
        }

        if (diff < 0 && Math.abs(diff) <= 3) {
          results.push({
            id: `vax-late-${batch.id}-${vax.traitement}-${jour}`,
            type: 'vaccination',
            title: '⚠️ Vaccination en retard',
            body: `"${batch.nom}" : ${vax.traitement} (jour ${jour}) - Retard de ${Math.abs(diff)}j`,
            severity: 'danger',
            date: today,
          });
        }
      }
    }
  }

  return results;
};

/**
 * Vérifie les alertes de mortalité anormale
 */
const checkMortalityAlerts = (data: AppData): CheckResult => {
  const results: CheckResult = [];
  const prefs = data.settings.notifications;
  if (!prefs?.mortalityAlerts) return results;

  for (const batch of data.productionBatches) {
    if (batch.statut !== 'active') continue;

    const records = batch.suiviQuotidien;
    if (records.length < 2) continue;

    const recentRecords = records.slice(-3);

    for (const record of recentRecords) {
      if (record.mort > 0) {
        const prevTotalMort = records
          .filter(r => new Date(r.date) < new Date(record.date))
          .reduce((sum, r) => sum + r.mort, 0);

        const aliveBefore = batch.nbPoussinsInitial - prevTotalMort;
        if (aliveBefore <= 0) continue;

        const mortalityRate = (record.mort / aliveBefore) * 100;

        if (mortalityRate > 5) {
          results.push({
            id: `mort-${batch.id}-${record.date}`,
            type: 'mortalite',
            title: '🚨 Alerte Mortalité Élevée',
            body: `"${batch.nom}" : ${record.mort} mort(s) le jour ${record.jourDeBande} (${mortalityRate.toFixed(1)}%)`,
            severity: 'danger',
            date: new Date(record.date),
          });
        } else if (mortalityRate > 3) {
          results.push({
            id: `mort-${batch.id}-${record.date}-warn`,
            type: 'mortalite',
            title: '⚠️ Mortalité Anormale',
            body: `"${batch.nom}" : ${record.mort} mort(s) le jour ${record.jourDeBande} (${mortalityRate.toFixed(1)}%)`,
            severity: 'warning',
            date: new Date(record.date),
          });
        }
      }
    }
  }

  return results;
};

/**
 * Vérifie les échéances de crédit
 */
const checkCreditDeadlines = (data: AppData): CheckResult => {
  const results: CheckResult = [];
  const prefs = data.settings.notifications;
  if (!prefs?.creditDeadlines) return results;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const sale of data.sales) {
    if (!sale.isCredit || sale.isPaid || !sale.dueDate) continue;

    const dueDate = new Date(sale.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / 86400000);

    const totalPayments = (sale.payments || []).reduce((sum, p) => sum + p.montant, 0);
    const remaining = Math.max(0, sale.total - totalPayments);
    if (remaining <= 0) continue;

    if (diffDays < 0) {
      results.push({
        id: `credit-overdue-${sale.id}`,
        type: 'credit',
        title: '🔴 Crédit en retard',
        body: `${sale.clientNom} : ${remaining.toLocaleString()} Frs restants (${Math.abs(diffDays)}j de retard)`,
        severity: diffDays <= -7 ? 'danger' : 'warning',
        date: dueDate,
      });
    }

    if (diffDays >= 0 && diffDays <= 3) {
      results.push({
        id: `credit-upcoming-${sale.id}`,
        type: 'credit',
        title: '🟡 Échéance imminente',
        body: `${sale.clientNom} : ${remaining.toLocaleString()} Frs à payer d'ici ${diffDays === 0 ? "aujourd'hui" : `${diffDays}j`}`,
        severity: diffDays <= 1 ? 'danger' : 'warning',
        date: dueDate,
      });
    }
  }

  return results;
};

/**
 * Vérifie toutes les conditions et retourne les alertes actives
 */
export const checkAllNotifications = (data: AppData): CheckResult => {
  const prefs = data.settings.notifications;
  if (!prefs?.enabled) return [];

  const results: CheckResult = [
    ...checkVaccinationReminders(data),
    ...checkMortalityAlerts(data),
    ...checkCreditDeadlines(data),
  ];

  results.sort((a, b) => {
    const severityOrder = { danger: 0, warning: 1, info: 2 };
    const diff = severityOrder[a.severity] - severityOrder[b.severity];
    if (diff !== 0) return diff;
    return a.date.getTime() - b.date.getTime();
  });

  return results;
};

/**
 * Compte les notifications non lues par sévérité
 */
export const countBySeverity = (events: NotificationEvent[]): {
  total: number;
  danger: number;
  warning: number;
  info: number;
} => {
  return {
    total: events.length,
    danger: events.filter(e => e.severity === 'danger').length,
    warning: events.filter(e => e.severity === 'warning').length,
    info: events.filter(e => e.severity === 'info').length,
  };
};

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
