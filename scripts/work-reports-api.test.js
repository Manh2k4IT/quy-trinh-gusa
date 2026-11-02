const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

let directory;
let server;
let baseUrl;
const day = '2026-11-03';

function setClock(localTime) {
  const [hours, minutes] = localTime.split(':').map(Number);
  fs.writeFileSync(path.join(directory, 'clock.txt'), new Date(Date.UTC(2026, 10, 3, hours - 7, minutes)).toISOString());
}
const clockIso = () => fs.readFileSync(path.join(directory, 'clock.txt'), 'utf8');
const photo = (label, capturedAt = clockIso()) => ({ data: `data:image/jpeg;base64,${Buffer.from(`photo-${label}`).toString('base64')}`, capturedAt });

test.before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gusa-work-reports-test-'));
  const users = {};
  const sessions = {};
  for (const role of ['admin', 'employee', 'staff', 'accountant']) {
    users[role] = { id: role, name: `${role} name`, email: `${role}@example.test`, role: role === 'staff' ? 'employee' : role, status: 'active' };
    sessions[`${role}-session`] = { userId: role, createdAt: Date.now() };
  }
  const files = {
    'work-report-templates.json': [], 'work-reports.json': [], 'work-report-structure.json': {},
    'users.json': users, 'sessions.json': sessions, 'attendance.json': {}, 'proposals.json': [], 'push-devices.json': [],
    'organization-chart.json': { nodes: [{ id: 'root', parentId: null, name: 'GIÁM ĐỐC' }, { id: 'kho', parentId: 'root', name: 'KHO VẬN' }] },
    'organization-members.json': { kho: [{ id: 'm1', name: 'Staff', title: 'Thủ kho', email: 'STAFF@example.test', status: 'working' }] },
  };
  for (const [file, value] of Object.entries(files)) fs.writeFileSync(path.join(directory, file), JSON.stringify(value));
  setClock('08:00');
  fs.writeFileSync(path.join(directory, 'clock.cjs'), `
    const fs = require('node:fs');
    const RealDate = Date;
    const read = () => new RealDate(fs.readFileSync(${JSON.stringify(path.join(directory, 'clock.txt'))}, 'utf8'));
    global.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [read()])); } static now() { return read().getTime(); } };
  `);
  const port = await new Promise((resolve) => {
    const listener = net.createServer();
    listener.listen(0, '127.0.0.1', () => { const assigned = listener.address().port; listener.close(() => resolve(assigned)); });
  });
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['--require', path.join(directory, 'clock.cjs'), 'server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), DATA_DIR: directory, ALLOW_LOCAL_DEV: 'false', NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Test server did not start')), 20000);
    server.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Test server exited: ${code}`)); });
    server.stdout.on('data', (data) => { if (data.toString().includes('Gusa Quy Trinh:')) { clearTimeout(timeout); resolve(); } });
  });
});

test.after(async () => {
  if (server && server.exitCode === null) await new Promise((resolve) => { server.once('exit', resolve); server.kill(); });
  if (directory) fs.rmSync(directory, { recursive: true });
});

const request = (url, role, { method = 'GET', payload } = {}) => fetch(`${baseUrl}${url}`, {
  method,
  headers: { ...(role ? { Cookie: `gusa_session=${role}-session` } : {}), 'Content-Type': 'application/json' },
  body: payload === undefined ? undefined : JSON.stringify(payload),
});
const json = async (response) => {
  const text = await response.text();
  let body = text;
  try { body = JSON.parse(text); } catch {}
  return { status: response.status, body };
};

test('templates, check-out gate, photo rules, late flag and overview', async () => {
  assert.equal((await json(await request('/api/work-reports/today', 'employee'))).body.items.length, 0);
  assert.equal((await request('/api/work-reports', 'employee', { method: 'POST', payload: { answers: [] } })).status, 404);

  const items = [
    { id: 'tidy', label: 'Dọn kho', type: 'check', required: true },
    { id: 'rolls', label: 'Số cây vải xuất', type: 'number', required: true },
    { id: 'shelf', label: 'Ảnh kệ hàng', type: 'photo', required: true, minPhotos: 1 },
  ];
  assert.equal((await request('/api/work-reports/templates', 'employee', { method: 'POST', payload: { name: 'X', targets: { userIds: ['employee'] }, items } })).status, 403);
  assert.equal((await request('/api/work-reports/templates', 'admin', { method: 'POST', payload: { name: 'Không áp dụng ai', items } })).status, 400);
  assert.equal((await request('/api/work-reports/templates', 'admin', { method: 'POST', payload: { name: 'Báo cáo cá nhân', targets: { userIds: ['employee'] }, items } })).status, 201);
  // Admin/CEO build departments and positions, then place people in them.
  assert.equal((await request('/api/work-reports/departments', 'employee', { method: 'POST', payload: { name: 'KHO VẬN' } })).status, 403);
  const department = (await json(await request('/api/work-reports/departments', 'admin', { method: 'POST', payload: { name: 'KHO VẬN' } }))).body.departments[0];
  assert.equal((await request('/api/work-reports/departments', 'admin', { method: 'POST', payload: { name: 'kho vận' } })).status, 400);
  const position = (await json(await request('/api/work-reports/positions', 'admin', { method: 'POST', payload: { name: 'Thủ kho', departmentId: department.id } }))).body.positions[0];
  assert.equal((await request('/api/work-reports/assignments', 'admin', { method: 'POST', payload: { userId: 'staff', departmentId: department.id, positionId: 'nope' } })).status, 400);
  assert.equal((await request('/api/work-reports/assignments', 'admin', { method: 'POST', payload: { userId: 'staff', departmentId: department.id, positionId: position.id } })).status, 200);
  assert.deepEqual((await json(await request('/api/work-reports/structure', 'admin'))).body.assignments.staff, { departmentId: department.id, positionId: position.id });
  assert.equal((await request('/api/work-reports/templates', 'admin', { method: 'POST', payload: { name: 'Báo cáo thủ kho', deadline: '17:00', targets: { departmentIds: [department.id], positionIds: [position.id] }, items } })).status, 201);
  assert.equal((await json(await request('/api/work-reports/today', 'employee'))).body.items[0].template.name, 'Báo cáo cá nhân');
  assert.equal((await json(await request('/api/work-reports/today', 'staff'))).body.items[0].template.name, 'Báo cáo thủ kho');
  assert.equal((await json(await request('/api/work-reports/today', 'accountant'))).body.items.length, 0);
  const bell = (await json(await request('/api/notifications', 'staff'))).body.items.filter((item) => item.id.startsWith('work-report-'));
  assert.equal(bell.length, 1);
  assert.equal(bell[0].title, 'Báo cáo công việc chưa nộp');

  // Check-out waits for the report.
  assert.equal((await request('/api/attendance', 'employee', { method: 'POST', payload: { action: 'check-in', mode: 'office' } })).status, 200);
  setClock('17:40');
  const blocked = await json(await request('/api/attendance', 'employee', { method: 'POST', payload: { action: 'check-out', mode: 'office' } }));
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.needsWorkReport, true);

  const submit = async (role, answers) => json(await request('/api/work-reports', role, { method: 'POST', payload: { answers } }));
  const answers = (shelfPhotos) => [{ itemId: 'tidy', checked: true }, { itemId: 'rolls', value: 12 }, { itemId: 'shelf', photos: shelfPhotos }];
  assert.equal((await submit('employee', [{ itemId: 'tidy', checked: true }])).status, 400);
  const stale = await submit('employee', answers([photo('a', new Date(Date.parse(clockIso()) - 20 * 60 * 1000).toISOString())]));
  assert.equal(stale.status, 400);
  assert.match(stale.body, /15 phút/);
  const created = await submit('employee', answers([photo('a')]));
  assert.equal(created.status, 201);
  const report = created.body.report;
  assert.equal(report.late, false);
  assert.equal(report.answers.find((answer) => answer.itemId === 'rolls').value, 12);
  const photoUrl = report.answers.find((answer) => answer.itemId === 'shelf').photos[0].url;
  assert.equal((await request(photoUrl, 'employee')).status, 200);
  assert.equal((await request(photoUrl, 'admin')).status, 200);
  assert.equal((await request(photoUrl, 'staff')).status, 404);
  assert.equal((await request(`/api/work-reports/${report.id}`, 'staff')).status, 404);

  // The same photo cannot be reused by anyone; resubmitting can keep already saved photos.
  const duplicate = await submit('staff', answers([photo('a')]));
  assert.equal(duplicate.status, 400);
  assert.match(duplicate.body, /trùng/);
  const kept = await submit('employee', [{ itemId: 'tidy', checked: true }, { itemId: 'rolls', value: 15 }, { itemId: 'shelf', photos: [{ keep: report.answers[2].photos[0].file }] }]);
  assert.equal(kept.status, 200);
  assert.equal(kept.body.report.id, report.id);

  assert.equal((await request('/api/attendance', 'employee', { method: 'POST', payload: { action: 'check-out', mode: 'office' } })).status, 200);

  const late = await submit('staff', answers([photo('b')]));
  assert.equal(late.status, 201);
  assert.equal(late.body.report.late, true);

  assert.equal((await request('/api/work-reports/overview', 'employee')).status, 403);
  const { rows } = (await json(await request(`/api/work-reports/overview?date=${day}`, 'admin'))).body;
  assert.deepEqual(rows.map((row) => [row.userId, row.status]).sort(), [['employee', 'submitted'], ['staff', 'late']]);
  assert.equal((await json(await request('/api/notifications', 'staff'))).body.items.filter((item) => item.id.startsWith('work-report-')).length, 0);
  assert.equal(rows.find((row) => row.userId === 'staff').department, 'KHO VẬN');
  assert.equal((await request('/work-reports.js', null)).status, 404);

  // Removing the position frees the person, so the position-specific template no longer applies.
  assert.equal((await request(`/api/work-reports/positions/${position.id}`, 'admin', { method: 'DELETE' })).status, 200);
  assert.equal((await json(await request('/api/work-reports/today', 'staff'))).body.items.length, 0);
});

test('file items accept documents, refuse other types and download under the original name', async () => {
  const items = [{ id: 'doc', label: 'Bảng kê', type: 'file', required: true }];
  assert.equal((await request('/api/work-reports/templates', 'admin', { method: 'POST', payload: { name: 'Nộp chứng từ', targets: { userIds: ['accountant'] }, items } })).status, 201);
  const file = (name, body = 'hello') => ({ name, data: `data:application/octet-stream;base64,${Buffer.from(body).toString('base64')}` });
  const submit = async (files) => json(await request('/api/work-reports', 'accountant', { method: 'POST', payload: { answers: [{ itemId: 'doc', files }] } }));
  assert.equal((await submit([])).status, 400);
  const refused = await submit([file('virus.exe')]);
  assert.equal(refused.status, 400);
  assert.match(refused.body, /không được hỗ trợ/);
  const created = await submit([file('Bảng kê tháng 11.pdf', '%PDF-1.4 test')]);
  assert.equal(created.status, 201);
  const saved = created.body.report.answers[0].files[0];
  assert.equal(saved.name, 'Bảng kê tháng 11.pdf');
  const download = await request(saved.url, 'accountant');
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /filename\*=UTF-8''B%E1%BA%A3ng/);
  assert.equal(await download.text(), '%PDF-1.4 test');
  assert.equal((await request(saved.url, 'staff')).status, 404);
});

test('links and mixed items: a number with a required file and an optional note', async () => {
  const items = [
    { id: 'sales', label: 'Doanh thu', type: 'number', required: true, extras: [{ type: 'file', required: true }, { type: 'text' }, { type: 'number' }] },
    { id: 'post', label: 'Bài đăng', type: 'link', required: true },
  ];
  const created = await json(await request('/api/work-reports/templates', 'admin', { method: 'POST', payload: { name: 'Báo cáo kết hợp', targets: { userIds: ['admin'] }, items } }));
  assert.equal(created.status, 201);
  // Unknown extras are dropped; the rest are kept with their own "required" flag.
  assert.deepEqual(created.body.template.items[0].extras, [{ type: 'file', required: true }, { type: 'text', required: false }]);
  const submit = async (answers) => json(await request('/api/work-reports', 'admin', { method: 'POST', payload: { templateId: created.body.template.id, answers } }));
  const file = { name: 'bang-ke.xlsx', data: `data:application/octet-stream;base64,${Buffer.from('sheet').toString('base64')}` };
  const missingFile = await submit([{ itemId: 'sales', value: 1200000 }, { itemId: 'post', link: 'https://facebook.com/gusa/posts/1' }]);
  assert.equal(missingFile.status, 400);
  assert.match(missingFile.body, /file/);
  const badLink = await submit([{ itemId: 'sales', value: 1200000, files: [file] }, { itemId: 'post', link: 'facebook.com/gusa' }]);
  assert.equal(badLink.status, 400);
  assert.match(badLink.body, /Link/);
  const done = await submit([{ itemId: 'sales', value: 1200000, files: [file], note: 'Khách sỉ' }, { itemId: 'post', link: 'https://facebook.com/gusa/posts/1' }]);
  assert.equal(done.status, 201);
  const [sales, post] = done.body.report.answers;
  assert.equal(sales.value, 1200000);
  assert.equal(sales.note, 'Khách sỉ');
  assert.equal(sales.files[0].name, 'bang-ke.xlsx');
  assert.match(sales.files[0].url, /\/files\//);
  assert.deepEqual(sales.extras, ['file', 'text']);
  assert.equal(post.link, 'https://facebook.com/gusa/posts/1');
});
