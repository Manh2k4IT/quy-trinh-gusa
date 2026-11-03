const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createWorkReports } = require('../work-reports');

test('history lists submitted, late, missed and open periods since each template was created', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gusa-work-history-'));
  const user = { id: 'a', name: 'A', status: 'active' };
  const items = [{ id: 'x', label: 'X', type: 'text' }];
  fs.writeFileSync(path.join(directory, 'work-report-templates.json'), JSON.stringify([
    { id: 'daily', name: 'Ngày', deadline: '18:00', createdAt: '2026-10-30T02:00:00Z', targets: { userIds: ['a'] }, schedule: { frequency: 'daily', weekdays: [1, 2, 3, 4, 5, 6, 7] }, items },
    { id: 'legacy', name: 'Cũ', deadline: '18:00', updatedAt: '2026-11-02T08:00:00Z', targets: { userIds: ['a'] }, schedule: { frequency: 'daily', weekdays: [1, 2, 3, 4, 5, 6, 7] }, items },
    { id: 'weekly', name: 'Tuần', deadline: '18:00', createdAt: '2026-10-20T02:00:00Z', targets: { userIds: ['a'] }, schedule: { frequency: 'weekly', weekday: 6 }, items },
  ]));
  fs.writeFileSync(path.join(directory, 'work-reports.json'), JSON.stringify([
    { id: 'r1', userId: 'a', date: '2026-10-31', templateId: 'daily', templateName: 'Ngày', periodKey: 'D:2026-10-31', late: false, submittedAt: '2026-10-31T09:00:00Z', answers: [] },
    { id: 'r2', userId: 'a', date: '2026-11-01', templateId: 'daily', templateName: 'Ngày', periodKey: 'D:2026-11-01', late: true, submittedAt: '2026-11-01T13:00:00Z', answers: [] },
    { id: 'r3', userId: 'a', date: '2026-10-28', templateId: 'gone', templateName: 'Mẫu đã xóa', periodKey: 'D:2026-10-28', late: false, submittedAt: '2026-10-28T09:00:00Z', answers: [] },
  ]));
  let requestUrl = '/api/work-reports/history';
  let response;
  const reports = createWorkReports({
    dataPath: (name) => path.join(directory, name), users: new Map([['a', user]]), getCurrentUser: () => user, isManagementUser: () => false,
    sendJson: (res, status, body) => { response = { status, body }; }, send: (res, status, body) => { response = { status, body }; },
    getUserKey: (item) => item.id, getLocalDateKey: (date) => (date ? date.toISOString().slice(0, 10) : '2026-11-03'), getLocalMinutes: () => 10 * 60,
  });
  try {
    await reports.handle({ url: requestUrl, method: 'GET' }, {});
    assert.equal(response.status, 200);
    const byKey = Object.fromEntries(response.body.rows.map((row) => [`${row.templateId}|${row.periodKey}`, row.status]));
    assert.equal(byKey['daily|D:2026-11-03'], 'pending');
    assert.equal(byKey['daily|D:2026-11-02'], 'missing');
    assert.equal(byKey['daily|D:2026-11-01'], 'late');
    assert.equal(byKey['daily|D:2026-10-31'], 'submitted');
    assert.equal(byKey['daily|D:2026-10-30'], 'missing');
    assert.equal(byKey['daily|D:2026-10-29'], undefined);
    // One row per week: this week's report is not due until Saturday, last week's was missed.
    assert.equal(byKey['weekly|W:2026-11-02'], undefined);
    assert.equal(byKey['weekly|W:2026-10-26'], 'missing');
    assert.equal(byKey['weekly|W:2026-10-19'], 'missing');
    assert.equal(byKey['gone|D:2026-10-28'], 'submitted');
    // A template saved before createdAt existed counts from its last save, not 30 days back.
    assert.equal(byKey['legacy|D:2026-11-02'], 'missing');
    assert.equal(byKey['legacy|D:2026-11-01'], undefined);
    assert.equal(response.body.rows[0].dueDate, '2026-11-03');
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});

test('overview covers a date range: one row per person, template and period', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gusa-work-range-'));
  const user = { id: 'a', name: 'A', status: 'active' };
  const items = [{ id: 'x', label: 'X', type: 'text' }];
  fs.writeFileSync(path.join(directory, 'work-report-templates.json'), JSON.stringify([
    { id: 'daily', name: 'Ngày', deadline: '18:00', createdAt: '2026-11-01T02:00:00Z', targets: { userIds: ['a'] }, schedule: { frequency: 'daily', weekdays: [1, 2, 3, 4, 5, 6, 7] }, items },
    { id: 'weekly', name: 'Tuần', deadline: '18:00', createdAt: '2026-10-01T02:00:00Z', targets: { userIds: ['a'] }, schedule: { frequency: 'weekly', weekday: 6 }, items },
  ]));
  fs.writeFileSync(path.join(directory, 'work-reports.json'), JSON.stringify([{ id: 'r1', userId: 'a', date: '2026-11-02', templateId: 'daily', templateName: 'Ngày', periodKey: 'D:2026-11-02', late: false, submittedAt: '2026-11-02T09:00:00Z', answers: [] }]));
  let response;
  const reports = createWorkReports({
    dataPath: (name) => path.join(directory, name), users: new Map([['a', user]]), getCurrentUser: () => user, isManagementUser: () => true,
    sendJson: (res, status, body) => { response = { status, body }; }, send: (res, status, body) => { response = { status, body }; },
    getUserKey: (item) => item.id, getLocalDateKey: (date) => (date ? date.toISOString().slice(0, 10) : '2026-11-03'), getLocalMinutes: () => 10 * 60,
  });
  try {
    await reports.handle({ url: '/api/work-reports/overview?from=2026-11-03&to=2026-10-30', method: 'GET' }, {});
    assert.equal(response.body.from, '2026-10-30');
    assert.equal(response.body.to, '2026-11-03');
    const rows = response.body.rows.map((row) => `${row.templateName}|${row.dueDate}|${row.status}`).sort();
    assert.deepEqual(rows, [
      'Ngày|2026-11-01|missing', 'Ngày|2026-11-02|submitted', 'Ngày|2026-11-03|upcoming',
      'Tuần|2026-10-31|missing', 'Tuần|2026-11-07|upcoming',
    ]);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});

test('KPI summary: only KPI templates, submission rate and number items against their target', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gusa-work-kpi-'));
  const people = new Map([['a', { id: 'a', name: 'A', status: 'active' }], ['b', { id: 'b', name: 'B', status: 'active' }]]);
  fs.writeFileSync(path.join(directory, 'work-report-templates.json'), JSON.stringify([
    { id: 'kpi', name: 'KPI bán hàng', kpi: true, deadline: '18:00', createdAt: '2026-11-01T02:00:00Z', targets: { userIds: ['a', 'b'] }, schedule: { frequency: 'daily', weekdays: [1, 2, 3, 4, 5, 6, 7] }, items: [{ id: 'sales', label: 'Doanh thu', type: 'number', target: 100 }, { id: 'note', label: 'Ghi chú', type: 'text' }] },
    { id: 'plain', name: 'Báo cáo thường', deadline: '18:00', createdAt: '2026-11-01T02:00:00Z', targets: { userIds: ['a'] }, schedule: { frequency: 'daily', weekdays: [1, 2, 3, 4, 5, 6, 7] }, items: [{ id: 'x', label: 'X', type: 'number' }] },
  ]));
  const report = (id, date, value, late) => ({ id, userId: 'a', date, templateId: 'kpi', templateName: 'KPI bán hàng', periodKey: `D:${date}`, late, submittedAt: `${date}T09:00:00Z`, answers: [{ itemId: 'sales', type: 'number', value }, { itemId: 'note', type: 'text', value: 'ok' }] });
  fs.writeFileSync(path.join(directory, 'work-reports.json'), JSON.stringify([report('r1', '2026-11-01', 80, false), report('r2', '2026-11-02', 120, true)]));
  let response;
  const build = (viewer, manager) => createWorkReports({
    dataPath: (name) => path.join(directory, name), users: people, getCurrentUser: () => viewer, isManagementUser: () => manager,
    sendJson: (res, status, body) => { response = { status, body }; }, send: (res, status, body) => { response = { status, body }; },
    getUserKey: (item) => item.id, getLocalDateKey: (date) => (date ? date.toISOString().slice(0, 10) : '2026-11-03'), getLocalMinutes: () => 10 * 60,
  });
  try {
    await build(people.get('a'), true).handle({ url: '/api/work-reports/kpi?month=2026-11', method: 'GET' }, {});
    assert.equal(response.body.people.length, 2);
    const a = response.body.people.find((person) => person.userId === 'a');
    assert.deepEqual(a.templates.map((template) => template.templateName), ['KPI bán hàng']);
    const [entry] = a.templates;
    assert.deepEqual([entry.due, entry.submitted, entry.late], [3, 2, 1]);
    assert.deepEqual(entry.metrics, [{ itemId: 'sales', label: 'Doanh thu', count: 2, total: 200, average: 100, target: 100, achieved: 100 }]);
    assert.deepEqual(entry.reports.map((item) => item.values.sales), [80, 120]);
    // The personal Lương & KPI page asks for scope=me: an Admin then sees only themself.
    await build(people.get('a'), true).handle({ url: '/api/work-reports/kpi?month=2026-11&scope=me', method: 'GET' }, {});
    assert.deepEqual(response.body.people.map((person) => person.userId), ['a']);
    assert.equal(response.body.canManage, false);
    // Employees only see their own KPI.
    await build(people.get('b'), false).handle({ url: '/api/work-reports/kpi?month=2026-11', method: 'GET' }, {});
    assert.deepEqual(response.body.people.map((person) => person.userId), ['b']);
    assert.equal(response.body.canManage, false);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});

test('history starts from "Áp dụng từ ngày" when Admin set one, otherwise from the day the template was created', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gusa-work-start-'));
  const person = { id: 'a', name: 'A', status: 'active' };
  const monthly = (id, schedule) => ({ id, name: id, deadline: '21:00', createdAt: '2026-11-03T03:00:00Z', targets: { userIds: ['a'] }, schedule: { frequency: 'monthly', monthDay: 28, ...schedule }, items: [{ id: 'x', label: 'X', type: 'text' }] });
  fs.writeFileSync(path.join(directory, 'work-report-templates.json'), JSON.stringify([
    monthly('backdated', { startDate: '2026-10-01', endDate: '2026-10-30' }),
    monthly('new', {}),
  ]));
  fs.writeFileSync(path.join(directory, 'work-reports.json'), '[]');
  let response;
  const reports = createWorkReports({
    dataPath: (name) => path.join(directory, name), users: new Map([['a', person]]), getCurrentUser: () => person, isManagementUser: () => false,
    sendJson: (res, status, body) => { response = { status, body }; }, send: (res, status, body) => { response = { status, body }; },
    getUserKey: (item) => item.id, getLocalDateKey: (date) => (date ? date.toISOString().slice(0, 10) : '2026-11-03'), getLocalMinutes: () => 10 * 60,
  });
  try {
    await reports.handle({ url: '/api/work-reports/history', method: 'GET' }, {});
    assert.deepEqual(response.body.rows.map((row) => [row.templateId, row.periodKey, row.status]), [['backdated', 'M:2026-10', 'missing']]);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});

test('a report past its deadline stays "overdue" while its period runs, then becomes "missing"', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gusa-work-overdue-'));
  const person = { id: 'a', name: 'A', status: 'active' };
  fs.writeFileSync(path.join(directory, 'work-report-templates.json'), JSON.stringify([
    { id: 'kpi', name: 'KPI', deadline: '21:00', createdAt: '2026-11-01T00:00:00Z', targets: { userIds: ['a'] }, schedule: { frequency: 'monthly', monthDay: 28, openDay: 27 }, items: [{ id: 'x', label: 'X', type: 'text' }] },
  ]));
  fs.writeFileSync(path.join(directory, 'work-reports.json'), '[]');
  let today = '2026-11-29';
  let response;
  const reports = createWorkReports({
    dataPath: (name) => path.join(directory, name), users: new Map([['a', person]]), getCurrentUser: () => person, isManagementUser: () => true,
    sendJson: (res, status, body) => { response = { status, body }; }, send: (res, status, body) => { response = { status, body }; },
    getUserKey: (item) => item.id, getLocalDateKey: (date) => (date ? date.toISOString().slice(0, 10) : today), getLocalMinutes: () => 10 * 60,
  });
  const statuses = async (url) => { await reports.handle({ url, method: 'GET' }, {}); return response.body.rows.filter((row) => row.periodLabel === 'Tháng 11/2026').map((row) => row.status); };
  try {
    assert.deepEqual(await statuses('/api/work-reports/history'), ['overdue']);
    assert.deepEqual(await statuses('/api/work-reports/overview?from=2026-11-28&to=2026-11-29'), ['overdue']);
    today = '2026-12-01';
    assert.deepEqual(await statuses('/api/work-reports/history'), ['missing']);
    assert.deepEqual(await statuses('/api/work-reports/overview?from=2026-11-28&to=2026-11-30'), ['missing']);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});
