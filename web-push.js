import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { initializeApp } from 'firebase/app';

const tokenStorageKey = 'gusa-web-fcm-token';
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  || navigator.standalone === true;

async function readFirebaseConfig() {
  const response = await fetch('/api/push/web-config', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Không tải được cấu hình thông báo (${response.status}).`);
  return response.json();
}

async function registerToken(token) {
  const response = await fetch('/api/push/devices', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform: 'web' }),
  });
  if (!response.ok) throw new Error(`Không đăng ký được thông báo (${response.status}).`);
  localStorage.setItem(tokenStorageKey, token);
}

async function unregisterToken(messaging) {
  const token = localStorage.getItem(tokenStorageKey);
  if (!token) return;
  const response = await fetch('/api/push/devices', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) throw new Error(`Không hủy đăng ký thông báo được (${response.status}).`);
  await deleteToken(messaging);
  localStorage.removeItem(tokenStorageKey);
}

const setting = document.querySelector('[data-web-push-setting]');
const button = document.querySelector('[data-web-push-toggle]');
const status = document.querySelector('[data-web-push-status]');

function setStatus(message) {
  if (status) status.textContent = message;
}

function updateToggle(enabled) {
  button?.setAttribute('aria-checked', String(enabled));
  button?.classList.toggle('is-on', enabled);
  setStatus(enabled ? 'Thông báo trên thiết bị này đã bật.' : 'Thông báo trên thiết bị này đang tắt.');
}

async function initializeWebPush() {
  if (window.desktopSettings?.isDesktop || window.Capacitor?.isNativePlatform?.()) {
    if (setting) setting.hidden = true;
    return;
  }
  const userResponse = await fetch('/api/me', { credentials: 'same-origin' });
  if (!userResponse.ok) throw new Error(`Không kiểm tra được tài khoản (${userResponse.status}).`);
  const { user } = await userResponse.json();
  if (!user || user.status !== 'active') {
    setStatus('Đăng nhập bằng tài khoản đang hoạt động để bật thông báo.');
    return;
  }

  const config = await readFirebaseConfig();
  if (!config.enabled) {
    setStatus('Thông báo web chưa được cấu hình trên máy chủ.');
    return;
  }

  if (isIOS && !isStandalone) {
    setStatus('Trong Safari, nhấn Chia sẻ → Thêm vào Màn hình chính. Mở Gusa từ biểu tượng mới, vào Cài đặt và bật thông báo. Cần iOS 16.4 trở lên.');
    return;
  }

  if (!('Notification' in window) || !('serviceWorker' in navigator) || !await isSupported()) {
    setStatus('Trình duyệt này không hỗ trợ thông báo web. Hãy sử dụng trình duyệt hỗ trợ trên HTTPS.');
    return;
  }

  const app = initializeApp(config.firebase, 'gusa-web-push');
  const messaging = getMessaging(app);
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { updateViaCache: 'none' });
  await navigator.serviceWorker.ready;

  button?.addEventListener('click', async () => {
    button.disabled = true;
    try {
      if (localStorage.getItem(tokenStorageKey)) {
        await unregisterToken(messaging);
        updateToggle(false);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('Bạn chưa cho phép thông báo. Hãy bật quyền thông báo cho Gusa trong Cài đặt thiết bị hoặc quyền của trang web trong trình duyệt.');
        return;
      }
      const token = await getToken(messaging, {
        vapidKey: config.vapidKey,
        serviceWorkerRegistration: registration,
      });
      if (!token) throw new Error('Firebase không cấp được mã nhận thông báo.');
      await registerToken(token);
      updateToggle(true);
    } catch (error) {
      console.error('Không thể bật thông báo web:', error);
      setStatus(`Không thay đổi được thông báo: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  });

  onMessage(messaging, (payload) => {
    if (!payload.notification?.title || Notification.permission !== 'granted') return;
    registration.showNotification(payload.notification.title, {
      body: payload.notification.body || '',
      icon: '/app-icons/icon-192.png',
      data: payload.data,
    }).catch((error) => console.error('Không hiển thị được thông báo web:', error));
  });

  document.addEventListener('click', (event) => {
    const logoutLink = event.target.closest('a[href="/auth/logout"]');
    if (!logoutLink || !localStorage.getItem(tokenStorageKey)) return;
    event.preventDefault();
    unregisterToken(messaging)
      .catch((error) => console.error('Không thể hủy đăng ký thông báo web:', error))
      .finally(() => window.location.assign(logoutLink.href));
  }, true);

  // Refresh the token and account binding without prompting on ordinary pages.
  if (localStorage.getItem(tokenStorageKey) && Notification.permission === 'granted') {
    const token = await getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) throw new Error('Firebase không cấp được mã nhận thông báo.');
    await registerToken(token);
    updateToggle(true);
  } else {
    if (localStorage.getItem(tokenStorageKey)) await unregisterToken(messaging);
    updateToggle(false);
  }
  if (button) button.disabled = false;
}

initializeWebPush().catch((error) => {
  console.error('Không thể khởi tạo thông báo web:', error);
  setStatus(`Không kiểm tra được thông báo: ${error.message}`);
});
