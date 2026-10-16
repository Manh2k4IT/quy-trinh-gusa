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
