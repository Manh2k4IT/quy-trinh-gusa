const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createWorkReports, periodOf } = require('../work-reports');

test('schedules: chosen weekdays, weekly and monthly periods, and an active date range', () => {
  const daily = { schedule: { frequency: 'daily', weekdays: [1, 2, 3, 4, 5, 6] } };
  assert.equal(periodOf(daily, '2026-11-03').key, 'D:2026-11-03');
  assert.equal(periodOf(daily, '2026-11-08'), null);

  const weekly = { schedule: { frequency: 'weekly', weekday: 6 } };
  assert.deepEqual([periodOf(weekly, '2026-11-03').key, periodOf(weekly, '2026-11-03').dueDate], ['W:2026-11-02', '2026-11-07']);
  assert.equal(periodOf(weekly, '2026-11-08').key, 'W:2026-11-02');

  const monthly = { schedule: { frequency: 'monthly', monthDay: 31 } };
  assert.deepEqual([periodOf(monthly, '2026-11-15').key, periodOf(monthly, '2026-11-15').dueDate], ['M:2026-11', '2026-11-30']);

  const ranged = { schedule: { frequency: 'daily', weekdays: [1, 2, 3, 4, 5, 6, 7], startDate: '2026-11-05', endDate: '2026-11-20' } };
  assert.equal(periodOf(ranged, '2026-11-04'), null);
  assert.equal(periodOf(ranged, '2026-11-05').key, 'D:2026-11-05');
  assert.equal(periodOf(ranged, '2026-11-21'), null);
});

test('reminders go once, within the hour before the deadline, only to people who have not submitted', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gusa-work-reminders-'));
  const users = new Map([['a', { id: 'a', name: 'A', status: 'active' }], ['b', { id: 'b', name: 'B', status: 'active' }]]);
  fs.writeFileSync(path.join(directory, 'work-report-templates.json'), JSON.stringify([
    { id: 't1', name: 'Báo cáo ngày', deadline: '18:00', targets: { userIds: ['a', 'b'] }, schedule: { frequency: 'daily', weekdays: [1, 2, 3, 4, 5, 6, 7] }, items: [{ id: 'x', label: 'X', type: 'text' }] },
    { id: 't2', name: 'Báo cáo tuần', deadline: '18:00', targets: { userIds: ['a'] }, schedule: { frequency: 'weekly', weekday: 6 }, items: [{ id: 'x', label: 'X', type: 'text' }] },
  ]));
  fs.writeFileSync(path.join(directory, 'work-reports.json'), JSON.stringify([{ id: 'r1', userId: 'b', date: '2026-11-03', templateId: 't1', periodKey: 'D:2026-11-03', answers: [] }]));
  let minutes = 16 * 60 + 30;
  const sent = [];
  const reports = createWorkReports({
    dataPath: (name) => path.join(directory, name), users, getCurrentUser: () => null, isManagementUser: () => false, sendJson() {}, send() {},
    getUserKey: (user) => user.id, getLocalDateKey: () => '2026-11-03', getLocalMinutes: () => minutes,
    notify: async (recipients, message) => { sent.push([recipients.map((user) => user.id), message.body]); },
  });
  try {
    assert.equal(await reports.sendReminders(), 0);
    minutes = 17 * 60 + 5;
    assert.equal(await reports.sendReminders(), 1);
    assert.deepEqual(sent[0][0], ['a']);
    assert.match(sent[0][1], /Báo cáo ngày/);
    assert.equal(await reports.sendReminders(), 0);
    // The weekly report is due on Saturday, so it is neither reminded nor blocking on Tuesday.
    assert.equal(reports.notificationsFor(users.get('a')).length, 1);
    assert.match(reports.checkoutBlock(users.get('a')), /Báo cáo ngày/);
    assert.equal(reports.checkoutBlock(users.get('b')), null);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});

test('weekly and monthly reports can open for input only from a set day', async () => {
  const monthly = { schedule: { frequency: 'monthly', monthDay: 28, openDay: 25 } };
  assert.equal(periodOf(monthly, '2026-11-03').opensOn, '2026-11-25');
  assert.equal(periodOf({ schedule: { frequency: 'monthly', monthDay: 28 } }, '2026-11-03').opensOn, undefined);
  assert.equal(periodOf({ schedule: { frequency: 'weekly', weekday: 6, openWeekday: 5 } }, '2026-11-03').opensOn, '2026-11-06');

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gusa-work-open-'));
  const person = { id: 'a', name: 'A', status: 'active' };
  fs.writeFileSync(path.join(directory, 'work-report-templates.json'), JSON.stringify([
    { id: 'kpi', name: 'KPI tháng', deadline: '21:00', createdAt: '2026-11-01T00:00:00Z', targets: { userIds: ['a'] }, schedule: { frequency: 'monthly', monthDay: 28, openDay: 25 }, items: [{ id: 'sales', label: 'Doanh thu', type: 'number', required: true }] },
  ]));
  fs.writeFileSync(path.join(directory, 'work-reports.json'), '[]');
  let today = '2026-11-03';
  let response;
  const reports = createWorkReports({
    dataPath: (name) => path.join(directory, name), users: new Map([['a', person]]), getCurrentUser: () => person, isManagementUser: () => false,
    sendJson: (res, status, body) => { response = { status, body }; }, send: (res, status, body) => { response = { status, body }; },
    getUserKey: (item) => item.id, getLocalDateKey: () => today, getLocalMinutes: () => 10 * 60,
  });
  const submit = () => reports.handle(Object.assign((async function* () { yield JSON.stringify({ templateId: 'kpi', answers: [{ itemId: 'sales', value: 100 }] }); })(), { url: '/api/work-reports', method: 'POST' }), {});
  try {
    await submit();
    assert.equal(response.status, 409);
    assert.match(response.body, /mở nhập từ ngày 25\/11/);
    today = '2026-11-25';
    await submit();
    assert.equal(response.status, 201);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});
