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
    currentMonth: () => '2026-11',
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
    // Total income = P1 + allowance + P3 + PDCA − social insurance.
    await call('POST', { userId: 'staff', baseSalary: 8000000, allowance: '1500000', p3: 2000000, pdca: 500000, insurance: 840000 });
    assert.deepEqual([response.body.row.p3, response.body.row.pdca, response.body.row.insurance, response.body.row.total], [2000000, 500000, 840000, 11160000]);
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
    assert.deepEqual(response.body.salary, { baseSalary: null, allowance: null, p3: null, pdca: null, insurance: null, kpiPending: false, kpiApplied: 100, kpiAuto: null, kpiApproved: null, p3Paid: null, total: null, updatedAt: null, inheritedFrom: null });

    // A new Gmail account shows up on its own, with empty amounts; saved salaries stay.
    users.set('new', { id: 'new', name: 'An', email: 'an@gmail.com', role: 'employee', status: 'active' });
    await call('GET');
    assert.deepEqual(response.body.rows.map((row) => [row.email, row.baseSalary]), [['admin@gmail.com', null], ['an@gmail.com', null], ['binh@gmail.com', 8000000]]);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});

test("salaries are kept per month and a month without its own entry carries the latest earlier one", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gusa-salaries-month-"));
  const users = new Map([
    ["admin", { id: "admin", name: "Admin", email: "admin@gmail.com", role: "admin", status: "active" }],
    ["staff", { id: "staff", name: "Bình", email: "binh@gmail.com", role: "employee", status: "active" }],
  ]);
  // An older file without months: its amounts are the base for every month.
  fs.writeFileSync(path.join(directory, "salaries.json"), JSON.stringify({ staff: { baseSalary: 7000000, allowance: 500000 }, admin: { baseSalary: 20000000, allowance: 0, updatedAt: "2026-11-03T03:00:00Z" } }));
  let viewer = users.get("admin");
  let response;
  const salaries = createSalaries({
    dataPath: (name) => path.join(directory, name), users, getCurrentUser: () => viewer, isManagementUser: (user) => ["admin", "ceo"].includes(user?.role),
    sendJson: (res, status, body) => { response = { status, body }; }, send: (res, status, body) => { response = { status, body }; },
    currentMonth: () => "2026-11",
  });
  const call = (method, url, payload) => salaries.handle(Object.assign((async function* () { if (payload) yield JSON.stringify(payload); })(), { url, method }), {});
  const staffRow = async (month) => { await call("GET", `/api/salaries?month=${month}`); return response.body.rows.find((row) => row.userId === "staff"); };
  try {
    assert.deepEqual(await staffRow("2026-10").then((row) => [row.baseSalary, row.inheritedFrom]), [7000000, "base"]);
    await call("POST", "/api/salaries", { userId: "staff", month: "2026-11", baseSalary: 8000000, allowance: 1000000 });
    assert.equal(response.body.month, "2026-11");
    assert.deepEqual(await staffRow("2026-11").then((row) => [row.baseSalary, row.allowance, row.inheritedFrom]), [8000000, 1000000, null]);
    assert.deepEqual(await staffRow("2026-12").then((row) => [row.baseSalary, row.inheritedFrom]), [8000000, "2026-11"]);
    assert.deepEqual(await staffRow("2026-10").then((row) => [row.baseSalary, row.inheritedFrom]), [7000000, "base"]);
    await call("POST", "/api/salaries", { userId: "staff", month: "2026-12", baseSalary: 9000000, allowance: 0 });
    assert.deepEqual(await staffRow("2026-11").then((row) => row.baseSalary), 8000000);
    assert.deepEqual(await staffRow("2027-01").then((row) => [row.baseSalary, row.inheritedFrom]), [9000000, "2026-12"]);
    // An older entry with a date counts from the month it was entered.
    const adminRow = async (month) => { await call("GET", `/api/salaries?month=${month}`); return response.body.rows.find((row) => row.userId === "admin"); };
    assert.deepEqual(await adminRow("2026-10").then((row) => row.baseSalary), null);
    assert.deepEqual(await adminRow("2026-11").then((row) => [row.baseSalary, row.inheritedFrom]), [20000000, null]);
    assert.deepEqual(await adminRow("2026-12").then((row) => [row.baseSalary, row.inheritedFrom]), [20000000, "2026-11"]);
    // The employee reads their own salary for the month they pick.
    viewer = users.get("staff");
    await call("GET", "/api/salaries/me?month=2026-12");
    assert.deepEqual([response.body.month, response.body.salary.baseSalary, response.body.salary.inheritedFrom], ["2026-12", 9000000, null]);
    await call("GET", "/api/salaries/me");
    assert.deepEqual([response.body.month, response.body.salary.baseSalary], ["2026-11", 8000000]);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});

test("P3 is paid by the KPI result: from the KPI reports (each item caps itself), a typed % for the month, or 100% without KPI", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gusa-salaries-kpi-"));
  const users = new Map([["admin", { id: "admin", name: "Admin", email: "admin@gmail.com", role: "admin", status: "active" }], ["staff", { id: "staff", name: "Bình", email: "binh@gmail.com", role: "employee", status: "active" }]]);
  const kpi = { "staff|2026-11": 80, "staff|2026-12": 150 };
  let response;
  const salaries = createSalaries({
    dataPath: (name) => path.join(directory, name), users, getCurrentUser: () => users.get("admin"), isManagementUser: (user) => user?.role === "admin",
    sendJson: (res, status, body) => { response = { status, body }; }, send: (res, status, body) => { response = { status, body }; },
    currentMonth: () => "2026-11", kpiPercentFor: (userId, month) => kpi[`${userId}|${month}`] ?? null,
  });
  const call = (method, url, payload) => salaries.handle(Object.assign((async function* () { if (payload) yield JSON.stringify(payload); })(), { url, method }), {});
  const staff = async (month) => { await call("GET", `/api/salaries?month=${month}`); const row = response.body.rows.find((item) => item.userId === "staff"); return [row.kpiAuto, row.kpiApplied, row.p3Paid, row.total]; };
  try {
    await call("POST", "/api/salaries", { userId: "staff", month: "2026-11", baseSalary: 8000000, allowance: 1500000, p3: 2000000, pdca: 500000, insurance: 840000 });
    // 8.000.000 + 1.500.000 + (2.000.000 × 80%) + 500.000 − 840.000
    assert.deepEqual(await staff("2026-11"), [80, 80, 1600000, 10760000]);
    assert.deepEqual(await staff("2026-12"), [150, 150, 3000000, 12160000]);
    assert.deepEqual(await staff("2027-01"), [null, 100, 2000000, 11160000]);
    await call("POST", "/api/salaries", { userId: "staff", month: "2026-11", baseSalary: 8000000, allowance: 1500000, p3: 2000000, pdca: 500000, insurance: 840000, kpiPercent: 120 });
    assert.deepEqual(await staff("2026-11"), [80, 120, 2400000, 11560000]);
    // A typed % stays with its month.
    assert.deepEqual(await staff("2026-12"), [150, 150, 3000000, 12160000]);
    await call("POST", "/api/salaries", { userId: "staff", month: "2026-11", kpiPercent: 500 });
    assert.equal(response.status, 400);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});

test("until the KPI is approved, the person sees P3 paid and the total as pending (unless Admin/CEO typed the %)", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gusa-salaries-pending-"));
  const users = new Map([["admin", { id: "admin", name: "Admin", role: "admin", status: "active" }], ["staff", { id: "staff", name: "Bình", role: "employee", status: "active" }]]);
  let viewer = users.get("admin");
  let kpi = { percent: 80, approved: false };
  let response;
  const salaries = createSalaries({
    dataPath: (name) => path.join(directory, name), users, getCurrentUser: () => viewer, isManagementUser: (user) => user?.role === "admin",
    sendJson: (res, status, body) => { response = { status, body }; }, send: (res, status, body) => { response = { status, body }; },
    currentMonth: () => "2026-11", kpiPercentFor: (userId) => (userId === "staff" ? kpi : null),
  });
  const call = (method, url, payload) => salaries.handle(Object.assign((async function* () { if (payload) yield JSON.stringify(payload); })(), { url, method }), {});
  const mine = async () => { viewer = users.get("staff"); await call("GET", "/api/salaries/me?month=2026-11"); const { salary } = response.body; return [salary.kpiPending, salary.p3Paid, salary.total, salary.kpiAuto]; };
  try {
    await call("POST", "/api/salaries", { userId: "staff", month: "2026-11", baseSalary: 8000000, p3: 2000000 });
    // Admin still sees the provisional numbers.
    assert.deepEqual([response.body.row.kpiApproved, response.body.row.p3Paid], [false, 1600000]);
    assert.deepEqual(await mine(), [true, null, null, null]);
    kpi = { percent: 80, approved: true };
    assert.deepEqual(await mine(), [false, 1600000, 9600000, 80]);
    kpi = { percent: 80, approved: false };
    viewer = users.get("admin");
    await call("POST", "/api/salaries", { userId: "staff", month: "2026-11", baseSalary: 8000000, p3: 2000000, kpiPercent: 90 });
    assert.deepEqual(await mine(), [false, 1800000, 9800000, 80]);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});
