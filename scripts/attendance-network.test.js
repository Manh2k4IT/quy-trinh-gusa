const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { normalizeIp, validateAllowedIps, getRequestIp, needsOfficeNetwork } = require('../attendance-network');

test('IP lists normalize IPv6 and mapped IPv4, reject private/invalid values and deduplicate', () => {
  assert.equal(normalizeIp('::ffff:8.8.8.8'), '8.8.8.8');
  assert.equal(normalizeIp('::ffff:808:808'), '8.8.8.8');
  assert.deepEqual(validateAllowedIps(['8.8.8.8', '::ffff:8.8.8.8', '2606:4700:4700:0000::1111']), ['8.8.8.8', '2606:4700:4700::1111']);
  for (const ip of ['192.168.1.1', '10.0.0.1', '127.0.0.1', '100.64.0.1', '172.16.0.1', '169.254.1.1',
    '::1', 'fc00::1', 'fe80::1', '2001:db8::1', '::ffff:192.168.1.1', 'Wi-Fi', 'https://8.8.8.8', '8.8.8.8/24', null]) {
    assert.throws(() => validateAllowedIps([ip]));
  }
  assert.throws(() => validateAllowedIps('8.8.8.8'));
  assert.throws(() => validateAllowedIps(Array(101).fill('8.8.8.8')));
  assert.deepEqual(validateAllowedIps([]), []);
});

test('request IP ignores untrusted forwarded headers and selects only the configured proxy boundary', () => {
  const req = { socket: { remoteAddress: '::ffff:1.1.1.1' }, headers: { 'x-forwarded-for': '8.8.8.8, 9.9.9.9' } };
  assert.equal(getRequestIp(req, 0), '1.1.1.1');
  assert.equal(getRequestIp(req, 1), '9.9.9.9');
  assert.equal(getRequestIp(req, 2), '8.8.8.8');
  assert.equal(getRequestIp(req, 3), '');
  assert.equal(getRequestIp({ headers: {}, socket: {} }, 1), '');
  assert.equal(getRequestIp({ headers: { 'x-forwarded-for': '8.8.8.8, invalid' } }, 1), '');
});

test('office checkout checks stored mode instead of a client-supplied online mode', () => {
  assert.equal(needsOfficeNetwork('check-in', 'office', {}), true);
  assert.equal(needsOfficeNetwork('check-in', 'online', {}), false);
  assert.equal(needsOfficeNetwork('check-out', 'online', { workMode: 'office' }), true);
  assert.equal(needsOfficeNetwork('check-out', 'online', {}), true);
  assert.equal(needsOfficeNetwork('check-out', 'office', { workMode: 'online' }), false);
});

async function loadClient(role, failSave = false) {
  const calls = [];
  const listeners = {};
  const input = { value: '', disabled: true };
  const status = { textContent: '' };
  const current = { textContent: '' };
  const save = { disabled: true };
  const add = { disabled: true, addEventListener: (event, handler) => { listeners.add = handler; } };
  const form = { addEventListener: (event, handler) => { listeners.submit = handler; } };
  const elements = {
    '[data-attendance-network-form]': form,
    '[data-attendance-network-ips]': input,
    '[data-attendance-save-network]': save,
    '[data-attendance-add-current-ip]': add,
    '[data-attendance-network-status]': status,
    '[data-attendance-current-ip]': current,
  };
  const panel = { hidden: true, querySelector: (selector) => elements[selector] };
  const source = fs.readFileSync(path.join(__dirname, '..', 'attendance-network-settings.js'), 'utf8');
  const context = {
    document: { querySelector: () => panel },
    console: { error: () => {} },
    fetch: async (url, options = {}) => {
      calls.push({ url, ...options });
      const failure = failSave && options.method === 'POST';
      return { ok: !failure, json: async () => url === '/api/me'
        ? { user: { role, status: 'active' } }
        : failure ? { message: 'IP không hợp lệ' }
          : { allowedIps: options.body ? JSON.parse(options.body).allowedIps : [], currentIp: '8.8.8.8' } };
    },
  };
  await vm.runInNewContext(source, context);
  return { panel, input, status, save, listeners, calls };
}

test('only management sees settings; adding current IP requires explicit save', async () => {
  for (const role of ['employee', 'accountant']) {
    const client = await loadClient(role);
    assert.equal(client.panel.hidden, true);
    assert.deepEqual(client.calls.map((call) => call.url), ['/api/me']);
  }
  for (const role of ['admin', 'ceo']) {
    const client = await loadClient(role);
    assert.equal(client.panel.hidden, false);
    assert.equal(client.input.disabled, false);
    client.listeners.add();
    assert.equal(client.input.value, '8.8.8.8');
    assert.equal(client.calls.length, 2);
    await client.listeners.submit({ preventDefault() {} });
    assert.deepEqual(JSON.parse(client.calls.at(-1).body), { allowedIps: ['8.8.8.8'] });
    assert.match(client.status.textContent, /Đang giới hạn/);
  }
});

test('save failures are visible and preserve the edited list', async () => {
  const client = await loadClient('admin', true);
  client.input.value = 'invalid';
  await client.listeners.submit({ preventDefault() {} });
  assert.equal(client.status.textContent, 'IP không hợp lệ');
  assert.equal(client.input.value, 'invalid');
  assert.equal(client.save.disabled, false);
});
