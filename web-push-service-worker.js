import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

const config = self.GUSA_FIREBASE_WEB_CONFIG;

// Register before getMessaging: Firebase otherwise handles clicks by only focusing an existing window.
self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data;
  const firebasePayload = data?.FCM_MSG;
  const targetUrl = new URL(data?.url || firebasePayload?.data?.url
    || firebasePayload?.fcmOptions?.link || firebasePayload?.notification?.click_action || '/', self.location.origin);
  if (targetUrl.origin !== self.location.origin) return;
  event.stopImmediatePropagation();
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const matchingWindow = windows.find((client) => client.url === targetUrl.href);
    if (matchingWindow) return matchingWindow.focus();
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin || !('navigate' in client)) continue;
      const navigated = await client.navigate(targetUrl.href);
      if (navigated) return navigated.focus();
    }
    return self.clients.openWindow(targetUrl.href);
  })());
});

if (config?.enabled) {
  const app = initializeApp(config.firebase, 'gusa-web-push-service-worker');
  const messaging = getMessaging(app);

  onBackgroundMessage(messaging, (payload) => {
    // Firebase already displays notification payloads in the background.
    if (payload.notification) return;
    const title = payload.notification?.title || 'Gusa Quy Trinh';
    const options = {
      body: payload.notification?.body || '',
      icon: '/app-icons/icon-192.png',
      data: { url: payload.data?.url || '/' },
    };
    return self.registration.showNotification(title, options);
  });
}
