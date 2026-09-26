import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';

const apiOrigin = 'https://quytrinh.gusa.vn';
const tokenStorageKey = 'gusa-mobile-fcm-token';
let initialized = false;

async function registerDeviceToken(token) {
  if (!token) return;
  const response = await fetch(`${apiOrigin}/api/push/devices`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform: Capacitor.getPlatform() }),
  });
  if (!response.ok) throw new Error(`Không đăng ký được thiết bị nhận push (${response.status}).`);
  localStorage.setItem(tokenStorageKey, token);
}

async function removeDeviceToken() {
  const token = localStorage.getItem(tokenStorageKey);
  if (!token) return;
  try {
    await fetch(`${apiOrigin}/api/push/devices`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } finally {
    localStorage.removeItem(tokenStorageKey);
  }
}

async function createAndroidChannels() {
  if (Capacitor.getPlatform() !== 'android') return;
  await Promise.all([
    FirebaseMessaging.createChannel({ id: 'proposal-approved', name: 'Đề xuất được duyệt', description: 'Thông báo đề xuất đã được duyệt', importance: 4, visibility: 1, sound: 'proposal_approved', vibration: true }),
    FirebaseMessaging.createChannel({ id: 'proposal-rejected', name: 'Đề xuất bị từ chối', description: 'Thông báo đề xuất bị từ chối', importance: 4, visibility: 1, sound: 'proposal_rejected', vibration: true }),
  ]);
}

window.initializeGusaMobilePush = async () => {
  if (initialized || !Capacitor.isNativePlatform()) return;
  initialized = true;
  try {
    await FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
      registerDeviceToken(token).catch((error) => console.error(error));
    });
    await FirebaseMessaging.addListener('notificationActionPerformed', ({ notification }) => {
      const targetUrl = notification.data?.url;
      if (typeof targetUrl === 'string' && new URL(targetUrl).origin === apiOrigin) window.location.assign(targetUrl);
    });

    let permission = await FirebaseMessaging.checkPermissions();
    if (permission.receive !== 'granted') permission = await FirebaseMessaging.requestPermissions();
    if (permission.receive !== 'granted') return;

    await createAndroidChannels();
    const result = await FirebaseMessaging.getToken();
    await registerDeviceToken(result.token);
  } catch (error) {
    initialized = false;
    console.error('Không thể bật push notification:', error);
  }
};

document.addEventListener('click', (event) => {
  const logoutLink = event.target.closest('a[href="/auth/logout"]');
  if (!logoutLink || !localStorage.getItem(tokenStorageKey)) return;
  event.preventDefault();
  removeDeviceToken().finally(() => window.location.assign(logoutLink.href));
}, true);