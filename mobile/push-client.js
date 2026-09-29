import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';

const apiOrigin = 'https://quytrinh.gusa.vn';
const tokenStorageKey = 'gusa-mobile-fcm-token';
let initialized = false;
let initializing = false;
let tokenListenerRegistered = false;
let actionListenerRegistered = false;
let permissionDenied = false;
let retryTimer;
let retryAttempt = 0;

function clearRetry() {
  if (!retryTimer) return;
  clearTimeout(retryTimer);
  retryTimer = null;
}

function scheduleRetry() {
  if (retryTimer || !Capacitor.isNativePlatform()) return;
  const delay = Math.min(60000, 3000 * (2 ** retryAttempt));
  retryAttempt += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    window.initializeGusaMobilePush?.();
  }, delay);
}

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
  retryAttempt = 0;
  clearRetry();
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
    FirebaseMessaging.createChannel({ id: 'proposal-created-general-v2', name: 'Đề xuất chung mới', description: 'Thông báo đề xuất chung mới cần xem xét', importance: 4, visibility: 1, sound: 'proposal_new_general', vibration: true }),
    FirebaseMessaging.createChannel({ id: 'proposal-created-payment-v2', name: 'Đề xuất thanh toán mới', description: 'Thông báo đề xuất thanh toán mới cần xem xét', importance: 4, visibility: 1, sound: 'proposal_new_payment', vibration: true }),
    FirebaseMessaging.createChannel({ id: 'proposal-approved', name: 'Đề xuất được duyệt', description: 'Thông báo đề xuất đã được duyệt', importance: 4, visibility: 1, sound: 'proposal_approved', vibration: true }),
    FirebaseMessaging.createChannel({ id: 'proposal-rejected', name: 'Đề xuất bị từ chối', description: 'Thông báo đề xuất bị từ chối', importance: 4, visibility: 1, sound: 'proposal_rejected', vibration: true }),
  ]);
}

window.initializeGusaMobilePush = async () => {
  if (initialized || initializing || !Capacitor.isNativePlatform()) return;
  initializing = true;
  try {
    if (!tokenListenerRegistered) {
      await FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
        registerDeviceToken(token).then(() => { initialized = true; }).catch((error) => {
          initialized = false;
          console.error('Không đăng ký được FCM token:', error.code || error.name || 'unknown');
          scheduleRetry();
        });
      });
      tokenListenerRegistered = true;
    }
    if (!actionListenerRegistered) {
      await FirebaseMessaging.addListener('notificationActionPerformed', ({ notification }) => {
        const targetUrl = notification.data?.url;
        if (typeof targetUrl === 'string' && new URL(targetUrl).origin === apiOrigin) window.location.assign(targetUrl);
      });
      actionListenerRegistered = true;
    }

    let permission = await FirebaseMessaging.checkPermissions();
    if (permission.receive !== 'granted') permission = await FirebaseMessaging.requestPermissions();
    if (permission.receive !== 'granted') {
      permissionDenied = true;
      return;
    }
    permissionDenied = false;

    await createAndroidChannels();
    const result = await FirebaseMessaging.getToken();
    if (!result.token) throw new Error('Firebase không trả về FCM token.');
    await registerDeviceToken(result.token);
    initialized = true;
  } catch (error) {
    initialized = false;
    console.error('Không thể bật push notification:', error.code || error.name || 'unknown');
    scheduleRetry();
  } finally {
    initializing = false;
  }
};

async function retryPushAfterResume() {
  if (!Capacitor.isNativePlatform()) return;
  if (permissionDenied) {
    try {
      const permission = await FirebaseMessaging.checkPermissions();
      if (permission.receive !== 'granted') return;
      permissionDenied = false;
    } catch {
      return;
    }
  }
  window.initializeGusaMobilePush?.();
}

window.addEventListener('online', retryPushAfterResume);
window.addEventListener('focus', retryPushAfterResume);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') retryPushAfterResume();
});

document.addEventListener('click', (event) => {
  const logoutLink = event.target.closest('a[href="/auth/logout"]');
  if (!logoutLink || !localStorage.getItem(tokenStorageKey)) return;
  event.preventDefault();
  removeDeviceToken().finally(() => window.location.assign(logoutLink.href));
}, true);