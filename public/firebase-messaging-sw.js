// AgriPoulet Pro — Firebase Cloud Messaging Service Worker v2
// Gère les notifications push même quand l'app est fermée
// v2: Support amélioré des push distants, clics contextuels, gestion d'erreurs

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

let messaging = null;
let firebaseInitialized = false;

// ── Initialisation Firebase dans le SW ──

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'FIREBASE_CONFIG') {
    try {
      if (firebaseInitialized) {
        console.log('[FCM SW] Firebase already initialized, skipping');
        return;
      }

      firebase.initializeApp(event.data.config);
      messaging = firebase.messaging();
      firebaseInitialized = true;

      console.log('[FCM SW] Firebase initialized, ready for push notifications');

      // Écouter les messages en arrière-plan (quand l'app est fermée)
      messaging.onBackgroundMessage((payload) => {
        console.log('[FCM SW] Background message received:', payload);

        const notificationTitle = payload.notification?.title || 'AgriPoulet Pro';
        const notificationBody = payload.notification?.body || '';
        const notificationData = payload.data || {};
        const notifType = notificationData.type || 'general';

        const notificationOptions = {
          body: notificationBody,
          icon: '/pwa-192x192.svg',
          badge: '/favicon.svg',
          vibrate: [200, 100, 200],
          data: notificationData,
          requireInteraction: true,
          tag: `agripoulet-${notifType}`,
          actions: [
            { action: 'open', title: 'Ouvrir l\'app' },
          ],
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
      });
    } catch (e) {
      console.error('[FCM SW] Initialization error:', e);
    }
  }

  // Ping/pong pour vérifier que le SW est actif
  if (event.data.type === 'PING') {
    event.source?.postMessage({ type: 'PONG' });
  }
});

// ── Gestion des clics sur les notifications ──

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si une fenêtre existe déjà, la focaliser
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon ouvrir une nouvelle fenêtre
      return clients.openWindow(targetUrl);
    })
  );
});

// ── Gestion des push events directs (quand FCM n'est pas initialisé) ──
// Note: Quand Firebase FCM est initialisé, onBackgroundMessage gère déjà
// l'affichage. Ce handler sert de fallback.

self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('[FCM SW] Push event without data');
    return;
  }

  // Si FCM est déjà initialisé, onBackgroundMessage s'en charge → éviter les doublons
  if (firebaseInitialized) {
    return;
  }

  try {
    const payload = event.data.json();
    console.log('[FCM SW] Direct push event (fallback):', payload);

    if (payload.notification) {
      const title = payload.notification.title || 'AgriPoulet Pro';
      const options = {
        body: payload.notification.body || '',
        icon: '/pwa-192x192.svg',
        badge: '/favicon.svg',
        vibrate: [200, 100, 200],
        data: payload.data || {},
        requireInteraction: true,
      };
      event.waitUntil(self.registration.showNotification(title, options));
    }
  } catch (e) {
    console.error('[FCM SW] Error handling direct push:', e);
  }
});

// ── Installation et activation ──

self.addEventListener('install', () => {
  console.log('[FCM SW] Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[FCM SW] Service Worker activated');
  event.waitUntil(clients.claim());
});
