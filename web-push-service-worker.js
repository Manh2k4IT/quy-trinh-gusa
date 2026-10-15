import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

const configResponse = await fetch('/api/push/web-config');
const config = await configResponse.json();

if (config.enabled) {
  const app = initializeApp(config.firebase, 'gusa-web-push-service-worker');
  const messaging = getMessaging(app);

  onBackgroundMessage(messaging, (payload) => {
    const title = payload.notification?.title || 'Gusa Quy Trinh';
    const options = {
      body: payload.notification?.body || '',
      icon: '/logo.png',
      data: { url: payload.data?.url || '/' },
    };
    return self.registration.showNotification(title, options);
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin);
  if (targetUrl.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        if ('navigate' in client && client.url !== targetUrl.href) await client.navigate(targetUrl.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(targetUrl.href);
  })());
});
