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

test.before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gusa-announcements-test-'));
  const users = {};
  const sessions = {};
  for (const role of ['admin', 'employee']) {
    users[role] = { id: role, name: `${role} name`, email: `${role}@example.test`, role, status: 'active' };
    sessions[`${role}-session`] = { userId: role, createdAt: Date.now() };
  }
  for (const [file, value] of Object.entries({ 'announcements.json': [], 'users.json': users, 'sessions.json': sessions, 'attendance.json': {}, 'proposals.json': [], 'push-devices.json': [] })) {
    fs.writeFileSync(path.join(directory, file), JSON.stringify(value));
  }
  const port = await new Promise((resolve) => {
    const listener = net.createServer();
    listener.listen(0, '127.0.0.1', () => { const assigned = listener.address().port; listener.close(() => resolve(assigned)); });
  });
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['server.js'], {
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

test('everyone reads announcements, only Admin/CEO post or delete, and new ones reach the bell', async () => {
  assert.equal((await request('/api/announcements', null)).status, 403);
  const empty = await (await request('/api/announcements', 'employee')).json();
  assert.deepEqual(empty, { announcements: [], canManage: false });

  assert.equal((await request('/api/announcements', 'employee', { method: 'POST', payload: { title: 'X', content: 'Y' } })).status, 403);
  assert.equal((await request('/api/announcements', 'admin', { method: 'POST', payload: { title: '', content: 'Y' } })).status, 400);
  const created = await request('/api/announcements', 'admin', { method: 'POST', payload: { title: 'Lịch nghỉ Tết', content: 'Nghỉ từ 1/1.', important: true } });
  assert.equal(created.status, 201);
  const { announcement } = await created.json();
  await request('/api/announcements', 'admin', { method: 'POST', payload: { title: 'Ghim', content: 'Nội quy', pinned: true } });

  const list = await (await request('/api/announcements', 'employee')).json();
  assert.deepEqual(list.announcements.map((item) => item.title), ['Ghim', 'Lịch nghỉ Tết']);
  assert.equal((await (await request('/api/announcements', 'admin')).json()).canManage, true);

  const bell = (await (await request('/api/notifications', 'employee')).json()).items.filter((item) => item.id.startsWith('announcement-'));
  assert.equal(bell.length, 2);
  assert.equal(bell.find((item) => item.text === 'Lịch nghỉ Tết').title, 'Thông báo chung · Quan trọng');
  const authorBell = (await (await request('/api/notifications', 'admin')).json()).items.filter((item) => item.id.startsWith('announcement-'));
  assert.equal(authorBell.length, 0);

  assert.equal((await request(`/api/announcements/${announcement.id}`, 'employee', { method: 'DELETE' })).status, 403);
  assert.equal((await request(`/api/announcements/${announcement.id}`, 'admin', { method: 'DELETE' })).status, 200);
  assert.equal((await request(`/api/announcements/${announcement.id}`, 'admin', { method: 'DELETE' })).status, 404);
  assert.deepEqual((await (await request('/api/announcements', 'employee')).json()).announcements.map((item) => item.title), ['Ghim']);
  assert.equal((await request('/announcements.json', null)).status, 404);
});
