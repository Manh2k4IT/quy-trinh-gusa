const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const source = server.slice(server.indexOf('async function sendProposalStatusPush('),
  server.indexOf('async function updateProposalStatus('));

for (const kind of ['created', 'approved', 'rejected', 'accounting-confirmed']) {
  test(`${kind} push uses the Gusa logo for Firebase-displayed browser notifications`, async () => {
    const messages = [];
    const proposal = {
      id: 'p1', userId: 'reviewer', userName: 'Test',
      type: kind === 'accounting-confirmed' ? 'payment' : 'leave',
      status: kind === 'rejected' ? 'rejected' : 'approved',
    };
    const context = {
      users: new Map([['reviewer', { id: 'reviewer', status: 'active' }]]),
      getAttendanceUserKey: (user) => user.id,
      isManagementUser: () => true,
      needsAccountingReview: () => false,
      getPaymentFlow: () => 'ceo',
      getPaymentStage: () => 'completed',
      getPushDevices: () => [{ token: 'test-token', userId: 'reviewer', platform: 'web' }],
      getFirebaseMessaging: () => ({ send: async (message) => messages.push(message) }),
      console: { log() {}, warn() {}, error: (...args) => assert.fail(args.join(' ')) },
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    if (kind === 'created') await context.sendProposalCreatedPush(proposal);
    else await context.sendProposalStatusPush(proposal);
    assert.equal(messages.length, 1);
    const message = messages[0];
    assert.equal(message.webpush.notification.icon, 'https://quytrinh.gusa.vn/app-icons/icon-192.png');
    assert.equal(message.webpush.fcmOptions.link, message.data.url);
    assert.equal(message.data.url, kind === 'created'
      ? 'https://quytrinh.gusa.vn/proposal-report.html'
      : kind === 'accounting-confirmed'
        ? 'https://quytrinh.gusa.vn/proposal-report.html?type=payment'
        : 'https://quytrinh.gusa.vn/proposals.html');
    assert.ok(message.notification.title);
    assert.ok(message.android.notification.sound);
    assert.ok(message.apns.payload.aps.sound);
  });
}

for (const type of ['late', 'early-leave', 'half-day', 'leave', 'unauthorized-leave', 'payment']) {
  test(`new ${type} proposal opens the reviewer report for web and native recipients`, async () => {
    const messages = [];
    const devices = ['web', 'android', 'ios'].map((platform) => ({
      token: `${platform}-token`, userId: 'reviewer', platform,
    }));
    const context = {
      users: new Map([['reviewer', { id: 'reviewer', status: 'active' }]]),
      getAttendanceUserKey: (user) => user.id,
      isManagementUser: () => true,
      needsAccountingReview: () => false,
      getPaymentFlow: () => 'ceo',
      getPaymentStage: () => 'pending',
      getPushDevices: () => devices,
      getFirebaseMessaging: () => ({ send: async (message) => messages.push(message) }),
      console: { log() {}, warn() {}, error: (...args) => assert.fail(args.join(' ')) },
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    await context.sendProposalCreatedPush({ id: 'p1', type, userName: 'Test' });
    assert.equal(messages.length, devices.length);
    const expectedUrl = `https://quytrinh.gusa.vn/proposal-report.html${type === 'payment' ? '?type=payment' : ''}`;
    for (const message of messages) {
      assert.equal(message.data.url, expectedUrl);
      assert.equal(message.webpush.fcmOptions.link, expectedUrl);
    }
  });
}
