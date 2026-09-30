import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

if (Capacitor.isNativePlatform()) {
  if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
    fetch('/api/me', { credentials: 'include', cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data?.user) return;
        const destination = data.user.status === 'pending' ? '/pending.html' : '/organization-chart.html?showWelcome=1';
        window.location.replace(destination);
      })
      .catch(() => {});
  }

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action="login"], [data-action="register"]');
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const originalMarkup = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Đang đăng nhập...';

    try {
      await FirebaseAuthentication.signInWithGoogle();
      const tokenResult = await FirebaseAuthentication.getIdToken();
      const idToken = tokenResult.token;
      if (!idToken) throw new Error('Firebase không trả về ID token.');

      const response = await fetch('/auth/mobile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, mode: button.dataset.action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Không đăng nhập được vào Gusa Quy Trinh.');
      window.location.assign(data.redirectTo || '/organization-chart.html');
    } catch (error) {
      window.alert(error.message || 'Đăng nhập Google thất bại.');
      button.disabled = false;
      button.innerHTML = originalMarkup;
    }
  }, true);
}