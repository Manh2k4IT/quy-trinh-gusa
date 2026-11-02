const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeIp, validateAllowedIps, getRequestIp, needsOfficeNetwork, getOfficeNetwork, isAllowedOfficeIp } = require('../attendance-network');

test('IPv6 /64 allows different office devices, not adjacent networks or invalid ranges', () => {
  const network = '2402:800:6370:b5c8::/64';
  const desktop = '2402:800:6370:b5c8:2c78:af15:42d4:6c18';
  const phone = '2402:800:6370:b5c8:20d0:e79f:cc2:c727';
  assert.equal(getOfficeNetwork(desktop), network);
  assert.equal(getOfficeNetwork('2606:4700::1111'), '2606:4700::/64');
  assert.equal(getOfficeNetwork('8.8.8.8'), '8.8.8.8');
  assert.equal(getOfficeNetwork(''), '');
  assert.deepEqual(validateAllowedIps([`${desktop}/64`, network]), [network]);
  for (const ip of [desktop, phone, '2402:800:6370:b5c8::', '2402:800:6370:b5c8:ffff:ffff:ffff:ffff']) {
    assert.equal(isAllowedOfficeIp(ip, [network]), true);
  }
  for (const ip of ['', 'invalid', '8.8.8.8', '2402:800:6370:b5c7:ffff:ffff:ffff:ffff', '2402:800:6370:b5c9::']) {
    assert.equal(isAllowedOfficeIp(ip, [network]), false);
  }
  assert.equal(isAllowedOfficeIp(phone, [desktop]), false);
  assert.equal(isAllowedOfficeIp('::ffff:8.8.8.8', ['8.8.8.8']), true);
  for (const value of ['2402:800::/0', '2402:800::/47', '2402:800::/65', '2402:800::/64/64', 'fe80::/64', 'fc00::/64', '2001:db8::/64', '8.8.8.8/64']) {
    assert.throws(() => validateAllowedIps([value]));
  }
});

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
