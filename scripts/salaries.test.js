const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSalaries } = require('../salaries');

test('salaries: Admin/CEO only, one row per active Gmail account, amounts validated and saved', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gusa-salaries-'));
  const users = new Map([
    ['admin', { id: 'admin', name: 'Admin', email: 'admin@gmail.com', role: 'admin', status: 'active' }],
    ['staff', { id: 'staff', name: 'Bình', email: 'binh@gmail.com', role: 'employee', status: 'active' }],
    ['waiting', { id: 'waiting', name: 'Chờ duyệt', email: 'cho@gmail.com', role: 'employee', status: 'pending' }],
  ]);
  let viewer = users.get('staff');
  let response;
  const salaries = createSalaries({
    dataPath: (name) => path.join(directory, name), users, getCurrentUser: () => viewer, isManagementUser: (user) => ['admin', 'ceo'].includes(user?.role),
    sendJson: (res, status, body) => { response = { status, body }; }, send: (res, status, body) => { response = { status, body }; },
  });
  const call = (method, payload) => salaries.handle(Object.assign((async function* () { if (payload) yield JSON.stringify(payload); })(), { url: '/api/salaries', method }), {});
  try {
    await call('GET');
    assert.equal(response.status, 403);
    await call('POST', { userId: 'staff', baseSalary: 1 });
    assert.equal(response.status, 403);

    viewer = users.get('admin');
    await call('GET');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.rows.map((row) => [row.email, row.baseSalary, row.allowance]), [['admin@gmail.com', null, null], ['binh@gmail.com', null, null]]);

    await call('POST', { userId: 'staff', baseSalary: 8000000, allowance: '1500000' });
    assert.equal(response.status, 200);
    assert.deepEqual([response.body.row.baseSalary, response.body.row.allowance], [8000000, 1500000]);
    await call('POST', { userId: 'staff', baseSalary: -5 });
    assert.equal(response.status, 400);
    await call('POST', { userId: 'waiting', baseSalary: 1 });
    assert.equal(response.status, 404);

    // Each person reads only their own salary (for the Lương & KPI page).
    viewer = users.get("staff");
    await salaries.handle(Object.assign((async function* () {})(), { url: "/api/salaries/me", method: "GET" }), {});
    assert.deepEqual([response.status, response.body.salary.baseSalary, response.body.salary.allowance], [200, 8000000, 1500000]);
    viewer = users.get("admin");
    await salaries.handle(Object.assign((async function* () {})(), { url: "/api/salaries/me", method: "GET" }), {});
    assert.deepEqual(response.body.salary, { baseSalary: null, allowance: null, updatedAt: null });

    // A new Gmail account shows up on its own, with empty amounts; saved salaries stay.
    users.set('new', { id: 'new', name: 'An', email: 'an@gmail.com', role: 'employee', status: 'active' });
    await call('GET');
    assert.deepEqual(response.body.rows.map((row) => [row.email, row.baseSalary]), [['admin@gmail.com', null], ['an@gmail.com', null], ['binh@gmail.com', 8000000]]);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});
