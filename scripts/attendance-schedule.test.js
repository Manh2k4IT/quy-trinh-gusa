const test = require('node:test');
const assert = require('node:assert/strict');
const { getCheckoutMinutes, formatShiftTime } = require('../attendance-schedule');

test('admin can check out online at 17:10', () => {
  assert.equal(getCheckoutMinutes('admin', 'q4', 'full-day', 'online'), 17 * 60 + 10);
  assert.equal(formatShiftTime(getCheckoutMinutes('admin', 'q4', 'full-day', 'online')), '17:10');
});

test('admin check-out override applies to office locations and employees keep normal hours', () => {
  assert.equal(getCheckoutMinutes('admin', 'q4', 'full-day', 'office'), 17 * 60 + 10);
  assert.equal(getCheckoutMinutes('admin', 'ben-thanh', 'full-day', 'office'), 17 * 60 + 10);
  assert.equal(getCheckoutMinutes('employee', 'q4', 'full-day', 'office'), 17 * 60 + 25);
  assert.equal(getCheckoutMinutes('employee', 'ben-thanh', 'full-day', 'online'), 17 * 60);
});
