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

async function unregisterToken(messaging, registration) {
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
  await registration.unregister();
  localStorage.removeItem(tokenStorageKey);
}

function showMessage(message) {
  window.alert(message);
}

function createButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Bật thông báo';
  button.setAttribute('aria-label', 'Bật thông báo đề xuất');
  Object.assign(button.style, {
    position: 'fixed',
    right: 'max(16px, env(safe-area-inset-right))',
    bottom: 'max(16px, env(safe-area-inset-bottom))',
    zIndex: '2147483000',
    minHeight: '44px',
    padding: '0 16px',
    border: '0',
    borderRadius: '22px',
    color: '#fff',
    background: '#174b8e',
    boxShadow: '0 2px 10px #0003',
    font: '600 14px "Segoe UI", sans-serif',
    cursor: 'pointer',
  });
  document.body.append(button);
  return button;
}

async function initializeWebPush() {
  const userResponse = await fetch('/api/me', { credentials: 'same-origin' });
  if (!userResponse.ok) throw new Error(`Không kiểm tra được tài khoản (${userResponse.status}).`);
  const { user } = await userResponse.json();
  if (!user || user.status !== 'active') return;

  const config = await readFirebaseConfig();
  if (!config.enabled) return;

  const button = createButton();
  if (isIOS && !isStandalone) {
    button.textContent = 'Thêm vào Màn hình chính để bật thông báo';
    button.addEventListener('click', () => showMessage(
      'Trên iPhone, hãy nhấn Chia sẻ trong Safari → Thêm vào Màn hình chính. Sau đó mở Gusa từ biểu tượng mới tạo và nhấn Bật thông báo.',
    ));
    return;
  }

  if (!('Notification' in window) || !('serviceWorker' in navigator) || !await isSupported()) {
    button.remove();
    return;
  }

  const app = initializeApp(config.firebase, 'gusa-web-push');
  const messaging = getMessaging(app);
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { type: 'module' });
  await navigator.serviceWorker.ready;

  if (localStorage.getItem(tokenStorageKey)) {
    button.textContent = 'Thông báo đã bật';
    button.disabled = true;
    button.style.background = '#53708f';
    return;
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showMessage('Bạn chưa cho phép thông báo. Hãy bật quyền thông báo cho Gusa trong Cài đặt của iPhone.');
        return;
      }
      const token = await getToken(messaging, {
        vapidKey: config.vapidKey,
        serviceWorkerRegistration: registration,
      });
      if (!token) throw new Error('Firebase không cấp được mã nhận thông báo.');
      await registerToken(token);
      button.textContent = 'Thông báo đã bật';
      button.style.background = '#53708f';
    } catch (error) {
      console.error('Không thể bật thông báo web:', error);
      showMessage('Chưa bật được thông báo. Vui lòng kiểm tra kết nối rồi thử lại.');
    } finally {
      button.disabled = localStorage.getItem(tokenStorageKey) !== null;
    }
  });

  onMessage(messaging, (payload) => {
    if (!payload.notification?.title || Notification.permission !== 'granted') return;
    new Notification(payload.notification.title, {
      body: payload.notification.body || '',
      icon: '/logo.png',
      data: payload.data,
    });
  });

  document.addEventListener('click', (event) => {
    const logoutLink = event.target.closest('a[href="/auth/logout"]');
    if (!logoutLink || !localStorage.getItem(tokenStorageKey)) return;
    event.preventDefault();
    unregisterToken(messaging, registration)
      .catch((error) => console.error('Không thể hủy đăng ký thông báo web:', error))
      .finally(() => window.location.assign(logoutLink.href));
  }, true);
}

initializeWebPush().catch((error) => {
  console.error('Không thể khởi tạo thông báo web:', error);
});
