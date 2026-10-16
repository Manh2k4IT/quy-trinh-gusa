const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('worker registers Firebase listeners synchronously without startup network requests', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'web-push-service-worker.js'), 'utf8')
    .replace(/^import .*;\r?$/gm, '');
  let handler;
  const notifications = [];
  const events = [];
  vm.runInNewContext(source, {
    self: {
      GUSA_FIREBASE_WEB_CONFIG: { enabled: true, firebase: { projectId: 'test' } },
      registration: { showNotification: async (...args) => notifications.push(args) },
      addEventListener: (name) => events.push(name),
    },
    initializeApp: () => ({}),
    getMessaging: () => ({}),
    onBackgroundMessage: (messaging, callback) => { handler = callback; },
    fetch: () => { throw new Error('No async configuration fetch allowed at worker startup'); },
  });
  assert.equal(typeof handler, 'function');
  assert.ok(events.includes('notificationclick'));
  await handler({ notification: { title: 'Already displayed by Firebase' } });
  assert.equal(notifications.length, 0);
  await handler({ data: { url: '/proposals.html' } });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0][1].data.url, '/proposals.html');
});

test('built service worker parses as a classic script without module top-level await', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'firebase-messaging-sw.js'), 'utf8');
  assert.doesNotThrow(() => new vm.Script(source));
});

async function clickNotification(data, clients = []) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'web-push-service-worker.js'), 'utf8')
    .replace(/^import .*;\r?$/gm, '');
  const listeners = [];
  const opened = [];
  let closed = false;
  let stopped = false;
  let completion;
  vm.runInNewContext(source, {
    URL,
    self: {
      GUSA_FIREBASE_WEB_CONFIG: { enabled: true, firebase: {} },
      location: { origin: 'https://quytrinh.gusa.vn' },
      addEventListener: (name, handler) => { if (name === 'notificationclick') listeners.push(handler); },
      clients: {
        matchAll: async () => clients,
        openWindow: async (url) => opened.push(url),
      },
    },
    initializeApp: () => ({}),
    getMessaging: () => {
      listeners.push(() => { throw new Error('Firebase must not intercept the application click handler'); });
      return {};
    },
    onBackgroundMessage: () => {},
  });
  const event = {
    notification: { data, close: () => { closed = true; } },
    stopImmediatePropagation: () => { stopped = true; },
    waitUntil: (promise) => { completion = promise; },
  };
  for (const listener of listeners) {
    listener(event);
    if (stopped) break;
  }
  await completion;
  return { opened, closed, stopped };
}

test('Firebase background notification navigates an existing settings window to its category', async () => {
  const calls = [];
  const target = 'https://quytrinh.gusa.vn/proposal-report.html?type=payment';
  const client = {
    url: 'https://quytrinh.gusa.vn/interface-settings.html',
    navigate: async (url) => { calls.push(url); return client; },
    focus: async () => { calls.push('focus'); },
  };
  const result = await clickNotification({ FCM_MSG: { data: { url: target }, fcmOptions: { link: target } } }, [client]);
  assert.deepEqual(calls, [target, 'focus']);
  assert.equal(result.closed, true);
  assert.equal(result.stopped, true);
  assert.deepEqual(result.opened, []);
});

test('foreground notifications open their target when there is no app window', async () => {
  const result = await clickNotification({ url: '/proposals.html' });
  assert.deepEqual(result.opened, ['https://quytrinh.gusa.vn/proposals.html']);
});

test('Firebase link focuses an exact matching window instead of navigating another tab', async () => {
  let focused = false;
  const target = 'https://quytrinh.gusa.vn/proposal-report.html?type=payment';
  const result = await clickNotification({ FCM_MSG: { fcmOptions: { link: target } } }, [
    { url: 'https://quytrinh.gusa.vn/interface-settings.html', navigate: () => { throw new Error('Wrong window'); } },
    { url: target, focus: async () => { focused = true; } },
  ]);
  assert.equal(focused, true);
  assert.deepEqual(result.opened, []);
});

test('click opens a new window when navigation cannot return a window client', async () => {
  const result = await clickNotification({ url: '/proposals.html' }, [
    { url: 'https://quytrinh.gusa.vn/interface-settings.html', navigate: async () => null },
  ]);
  assert.deepEqual(result.opened, ['https://quytrinh.gusa.vn/proposals.html']);
});
