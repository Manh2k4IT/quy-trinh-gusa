const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'web-push.js'), 'utf8')
  .replace(/^import .*;\r?$/gm, '');

async function loadClient({ settings = true, desktop = false, native = false, ios = false, standalone = true, token = null } = {}) {
  const calls = [];
  const listeners = {};
  const storage = new Map(token ? [['gusa-web-fcm-token', token]] : []);
  const button = {
    disabled: true,
    attributes: {},
    classList: {
      values: new Set(),
      toggle(name, enabled) { if (enabled) this.values.add(name); else this.values.delete(name); },
      contains(name) { return this.values.has(name); },
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { listeners[name] = handler; },
  };
  const status = { textContent: '' };
  const section = { hidden: false };
  const registration = { showNotification: async () => {}, unregister: () => { throw new Error('Must not unregister shared worker'); } };
  const context = {
    window: {
      desktopSettings: desktop ? { isDesktop: true } : undefined,
      Capacitor: native ? { isNativePlatform: () => true } : undefined,
      matchMedia: () => ({ matches: standalone }),
      Notification: {},
      location: { assign: () => {} },
    },
    navigator: {
      userAgent: ios ? 'iPhone' : 'Chrome',
      platform: '',
      maxTouchPoints: 0,
      serviceWorker: { register: async () => registration, ready: Promise.resolve(registration) },
    },
    document: {
      querySelector: (selector) => settings ? ({
        '[data-web-push-setting]': section,
        '[data-web-push-toggle]': button,
        '[data-web-push-status]': status,
      })[selector] : null,
      addEventListener: (name, handler) => { listeners[`document:${name}`] = handler; },
    },
    Notification: { permission: 'granted', requestPermission: async () => { calls.push('permission'); return 'granted'; } },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    fetch: async (url, options = {}) => {
      calls.push(`${options.method || 'GET'} ${url}`);
      return { ok: true, json: async () => url === '/api/me'
        ? { user: { status: 'active' } }
        : { enabled: true, firebase: {}, vapidKey: 'test-key' } };
    },
    initializeApp: () => ({}),
    getMessaging: () => ({}),
    isSupported: async () => true,
    getToken: async () => 'fresh-token',
    deleteToken: async () => { calls.push('deleteToken'); },
    onMessage: () => {},
    console,
  };
  vm.runInNewContext(source, context);
  await new Promise((resolve) => setImmediate(resolve));
  return { calls, listeners, storage, button, status, section };
}

test('settings switch enables and disables Web Push without a floating button', async () => {
  const client = await loadClient();
  assert.equal(client.button.disabled, false);
  assert.equal(client.button.attributes['aria-checked'], 'false');
  assert.equal(client.button.classList.contains('is-on'), false);
  await client.listeners.click();
  assert.equal(client.button.attributes['aria-checked'], 'true');
  assert.equal(client.button.classList.contains('is-on'), true);
  assert.equal(client.storage.get('gusa-web-fcm-token'), 'fresh-token');
  await client.listeners.click();
  assert.equal(client.button.attributes['aria-checked'], 'false');
  assert.equal(client.button.classList.contains('is-on'), false);
  assert.equal(client.storage.size, 0);
  assert.ok(client.calls.includes('deleteToken'));
});

test('settings restore the enabled switch appearance for a saved subscription', async () => {
  const client = await loadClient({ token: 'old-token' });
  assert.equal(client.button.disabled, false);
  assert.equal(client.button.attributes['aria-checked'], 'true');
  assert.equal(client.button.classList.contains('is-on'), true);
  assert.equal(client.storage.get('gusa-web-fcm-token'), 'fresh-token');
  assert.match(client.status.textContent, /đã bật/);
  assert.ok(!client.calls.includes('permission'));
});

test('native shells skip Web Push and hide the web settings card', async () => {
  for (const options of [{ desktop: true }, { native: true }]) {
    const client = await loadClient(options);
    assert.equal(client.section.hidden, true);
    assert.deepEqual(client.calls, []);
  }
});

test('iPhone Safari settings explain Home Screen requirement without requesting permission', async () => {
  const client = await loadClient({ ios: true, standalone: false });
  assert.match(client.status.textContent, /Màn hình chính/);
  assert.equal(client.button.disabled, true);
  assert.ok(!client.calls.includes('permission'));
});

test('other pages refresh enabled subscriptions and retain logout cleanup without UI or prompting', async () => {
  const client = await loadClient({ settings: false, token: 'old-token' });
  assert.equal(client.storage.get('gusa-web-fcm-token'), 'fresh-token');
  assert.ok(client.calls.includes('POST /api/push/devices'));
  assert.ok(client.listeners['document:click']);
  assert.ok(!client.calls.includes('permission'));
});
