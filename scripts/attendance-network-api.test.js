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
const day = '2026-10-15';
const roles = ['admin', 'ceo', 'employee', 'accountant', 'inactive'];

async function startServer() {
  const port = await new Promise((resolve) => {
    const listener = net.createServer();
    listener.listen(0, '127.0.0.1', () => {
      const assigned = listener.address().port;
      listener.close(() => resolve(assigned));
    });
  });
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['--require', path.join(directory, 'clock.cjs'), 'server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), DATA_DIR: directory, ALLOW_LOCAL_DEV: 'false', NODE_ENV: 'production', ATTENDANCE_TRUST_PROXY_HOPS: '2' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Test server did not start')), 20000);
    const done = (error) => {
      clearTimeout(timeout);
      if (error) reject(error); else resolve();
    };
    server.once('error', done);
    server.once('exit', (code) => done(new Error(`Test server exited: ${code}`)));
    server.stdout.on('data', (data) => { if (data.toString().includes('Gusa Quy Trinh:')) done(); });
  });
}

async function stopServer() {
  if (server && server.exitCode === null) {
    await new Promise((resolve) => { server.once('exit', resolve); server.kill(); });
  }
}

test.before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gusa-attendance-network-test-'));
  const users = {};
  const sessions = {};
  for (const role of roles) {
    users[role] = { id: role, name: role, email: `${role}@example.test`, role: role === 'inactive' ? 'admin' : role, status: role === 'inactive' ? 'pending' : 'active' };
    sessions[`${role}-session`] = { userId: role, createdAt: Date.now() };
  }
  for (const [file, value] of Object.entries({
    'users.json': users, 'sessions.json': sessions, 'attendance.json': {},
    'proposals.json': [], 'organization-chart.json': {}, 'organization-members.json': {},
    'organization-profiles.json': {}, 'payment-template.json': {}, 'push-devices.json': [],
  })) fs.writeFileSync(path.join(directory, file), JSON.stringify(value));
  fs.writeFileSync(path.join(directory, 'clock.txt'), `${day}T01:00:00Z`);
  fs.writeFileSync(path.join(directory, 'clock.cjs'), `
    const fs = require('node:fs');
    const RealDate = Date;
    global.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [fs.readFileSync(${JSON.stringify(path.join(directory, 'clock.txt'))}, 'utf8')])); }
    };
  `);
  await startServer();
});

test.after(async () => {
  await stopServer();
  if (directory) fs.rmSync(directory, { recursive: true });
});

function request(url, role = 'admin', { method = 'GET', payload, ip = '8.8.8.8' } = {}) {
  return fetch(`${baseUrl}${url}`, {
    method,
    headers: { ...(role ? { Cookie: `gusa_session=${role}-session` } : {}), ...(ip ? { 'X-Forwarded-For': `${ip}, 172.67.216.127` } : {}), 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

function resetRecords(records = {}) {
  fs.writeFileSync(path.join(directory, 'attendance.json'), JSON.stringify(records));
  fs.writeFileSync(path.join(directory, 'clock.txt'), `${day}T01:00:00Z`);
}

async function setIps(allowedIps) {
  const response = await request('/api/attendance-network', 'admin', { method: 'POST', payload: { allowedIps } });
  assert.equal(response.status, 200);
}

test('only active Admin/CEO can read or change IP configuration; invalid saves preserve it', async () => {
  for (const role of ['admin', 'ceo']) {
    assert.equal((await request('/api/attendance-network', role)).status, 200);
    assert.equal((await request('/api/attendance-network', role, { method: 'POST', payload: { allowedIps: ['8.8.8.8'] } })).status, 200);
  }
  for (const role of ['employee', 'accountant', 'inactive', null]) {
    assert.equal((await request('/api/attendance-network', role)).status, 403);
    assert.equal((await request('/api/attendance-network', role, { method: 'POST', payload: { allowedIps: [] } })).status, 403);
  }
  assert.equal((await request('/api/attendance', 'inactive', { method: 'POST', payload: { action: 'check-in', mode: 'office' } })).status, 403);
  assert.equal((await request('/api/attendance-network', 'admin', { method: 'POST', payload: { allowedIps: ['192.168.1.1'] } })).status, 400);
  assert.deepEqual((await (await request('/api/attendance-network')).json()).allowedIps, ['8.8.8.8']);
  assert.equal((await request('/attendance-network.json')).status, 403);
  assert.equal((await request('/attendance-network.json.tmp')).status, 403);
  assert.equal((await request('/ATTENDANCE-NETWORK.JSON')).status, 403);
});

test('empty list preserves unrestricted office attendance, including half-day shifts', async () => {
  await setIps([]);
  resetRecords();
  assert.equal((await request('/api/attendance', 'employee', { method: 'POST', ip: '1.1.1.1', payload: { action: 'check-in', mode: 'office' } })).status, 200);
  resetRecords();
  fs.writeFileSync(path.join(directory, 'clock.txt'), `${day}T06:00:00Z`);
  assert.equal((await request('/api/attendance', 'employee', { method: 'POST', ip: '1.1.1.1', payload: { action: 'check-in', mode: 'office', attendanceType: 'half-day-afternoon' } })).status, 200);
});

function setClock(localTime) {
  // localTime is Asia/Ho_Chi_Minh (UTC+7) on the test day.
  const [hours, minutes] = localTime.split(':').map(Number);
  const utc = new Date(Date.UTC(2026, 9, 15, hours - 7, minutes));
  fs.writeFileSync(path.join(directory, 'clock.txt'), utc.toISOString());
}

const benThanhPoint = { latitude: 10.7725, longitude: 106.698, radiusMeters: 150 };
const nearBenThanh = { latitude: 10.7729, longitude: 106.6982, accuracy: 20 };
const farFromBenThanh = { latitude: 10.7579, longitude: 106.7054, accuracy: 20 };

test('only active Admin/CEO can read or save the Bến Thành point, and invalid points are rejected', async () => {
  for (const role of ['employee', 'accountant', 'inactive', null]) {
    assert.equal((await request('/api/attendance-sites', role)).status, 403);
    assert.equal((await request('/api/attendance-sites', role, { method: 'POST', payload: { site: 'ben-thanh', point: benThanhPoint } })).status, 403);
  }
  assert.equal((await request('/api/attendance-sites', 'ceo', { method: 'POST', payload: { site: 'hcm', point: benThanhPoint } })).status, 400);
  for (const benThanh of [{ latitude: 91, longitude: 106 }, { latitude: 10, longitude: 106, radiusMeters: 5 }, { latitude: 'x', longitude: 106 }]) {
    assert.equal((await request('/api/attendance-sites', 'ceo', { method: 'POST', payload: { site: 'ben-thanh', point: benThanh } })).status, 400);
  }
  const saved = await request('/api/attendance-sites', 'ceo', { method: 'POST', payload: { site: 'ben-thanh', point: benThanhPoint } });
  assert.equal(saved.status, 200);
  assert.deepEqual((await (await request('/api/attendance-sites', 'admin')).json()).sites['ben-thanh'], benThanhPoint);
  assert.equal((await request('/attendance-sites.json', null)).status, 404);
});

test('Bến Thành check-in uses GPS and its own late time', async () => {
  await setIps(['1.1.1.1']);
  await request('/api/attendance-sites', 'admin', { method: 'POST', payload: { site: 'ben-thanh', point: null } });
  resetRecords();
  setClock('09:10');
  const checkIn = (location, site = 'ben-thanh') => request('/api/attendance', 'employee', { method: 'POST', ip: '9.9.9.9', payload: { action: 'check-in', mode: 'office', site, location } });

  let response = await checkIn(nearBenThanh);
  assert.equal(response.status, 403);
  assert.match((await response.json()).message, /chưa lưu vị trí/);

  await request('/api/attendance-sites', 'admin', { method: 'POST', payload: { site: 'ben-thanh', point: benThanhPoint } });
  response = await checkIn(undefined);
  assert.equal(response.status, 403);
  response = await checkIn(farFromBenThanh);
  assert.equal(response.status, 403);
  assert.match((await response.json()).message, /cách điểm chấm công Bến Thành/);

  response = await checkIn(nearBenThanh);
  assert.equal(response.status, 200);
  const { record } = await response.json();
  assert.equal(record.site, 'ben-thanh');
  assert.equal(record.lateMinutes, 10);
  assert.equal(typeof record.siteCheckIn.distanceMeters, 'number');

  // The same time at Quận 4 is late from 08:30, from any network and without GPS.
  resetRecords();
  setClock('09:10');
  response = await request('/api/attendance', 'employee', { method: 'POST', ip: '9.9.9.9', payload: { action: 'check-in', mode: 'office' } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).record.lateMinutes, 40);
  await setIps([]);
});

test('Bến Thành check-out opens at 17:00 (13:00 for the morning shift) and needs GPS again', async () => {
  await request('/api/attendance-sites', 'admin', { method: 'POST', payload: { site: 'ben-thanh', point: benThanhPoint } });
  const attend = (action, payload = {}) => request('/api/attendance', 'employee', { method: 'POST', payload: { action, mode: 'office', site: 'ben-thanh', location: nearBenThanh, ...payload } });

  resetRecords();
  setClock('08:50');
  assert.equal((await attend('check-in')).status, 200);
  setClock('16:55');
  assert.equal((await attend('check-out')).status, 400);
  setClock('17:05');
  assert.equal((await attend('check-out', { location: undefined })).status, 403);
  assert.equal((await attend('check-out', { location: farFromBenThanh })).status, 403);
  const done = await attend('check-out', { site: 'q4' });
  assert.equal(done.status, 200);
  assert.equal((await done.json()).record.status, 'completed');

  resetRecords();
  setClock('08:50');
  assert.equal((await attend('check-in', { attendanceType: 'half-day-morning' })).status, 200);
  setClock('13:01');
  assert.equal((await attend('check-out')).status, 200);

  // Quận 4 check-out opens at 17:25.
  resetRecords();
  setClock('08:00');
  assert.equal((await request('/api/attendance', 'employee', { method: 'POST', payload: { action: 'check-in', mode: 'office' } })).status, 200);
  setClock('17:24');
  assert.equal((await request('/api/attendance', 'employee', { method: 'POST', payload: { action: 'check-out', mode: 'office' } })).status, 400);
  setClock('17:25');
  assert.equal((await request('/api/attendance', 'employee', { method: 'POST', payload: { action: 'check-out', mode: 'office' } })).status, 200);
});

test('Quận 4 needs neither GPS nor the office network, even with an IP list and a saved point', async () => {
  await setIps(['1.1.1.1']);
  assert.equal((await request('/api/attendance-sites', 'admin', { method: 'POST', payload: { site: 'q4', point: { latitude: 10.7579, longitude: 106.7054, radiusMeters: 150 } } })).status, 200);
  resetRecords();
  setClock('08:00');
  try {
    const response = await request('/api/attendance', 'employee', { method: 'POST', ip: '9.9.9.9', payload: { action: 'check-in', mode: 'office' } });
    assert.equal(response.status, 200);
    const { record } = await response.json();
    assert.equal(record.site, undefined);
    assert.equal(record.siteCheckIn, undefined);
    setClock('17:35');
    assert.equal((await request('/api/attendance', 'employee', { method: 'POST', ip: '9.9.9.9', payload: { action: 'check-out', mode: 'office' } })).status, 200);
  } finally {
    await request('/api/attendance-sites', 'admin', { method: 'POST', payload: { site: 'q4', point: null } });
    await setIps([]);
  }
});

test('Admin marking a day "Đã công" fills the missing check-out so the day counts', async () => {
  resetRecords();
  setClock('08:10');
  assert.equal((await request('/api/attendance', 'employee', { method: 'POST', payload: { action: 'check-in', mode: 'office' } })).status, 200);
  const mark = (status) => request('/api/attendance-overview/status', 'admin', { method: 'POST', payload: { userId: 'employee', date: day, status } });
  let { record } = await (await mark('present')).json();
  assert.equal(record.status, 'completed');
  assert.equal(new Date(record.checkIn).toISOString().slice(11, 16), '01:10');
  // Quận 4 shift ends 17:25 (10:25 UTC).
  assert.equal(new Date(record.checkOut).toISOString().slice(11, 16), '10:25');
  assert.equal(record.checkOutByAdmin, true);
  // A day without any check-in starts at the shift start, so it is not late.
  ({ record } = await (await mark('absent')).json());
  assert.equal(record.checkIn, undefined);
  ({ record } = await (await mark('present')).json());
  assert.equal(new Date(record.checkIn).toISOString().slice(11, 16), '01:30');
  assert.equal(record.checkInByAdmin, true);
  // Back to "working": checked in, no check-out.
  ({ record } = await (await mark('working')).json());
  assert.deepEqual([record.status, typeof record.checkIn, record.checkOut, record.checkOutByAdmin], ['working', 'string', undefined, undefined]);
});

test('Admin/CEO can clear a late mark while the day still counts as worked', async () => {
  resetRecords();
  setClock('09:00');
  const checkIn = await request('/api/attendance', 'employee', { method: 'POST', payload: { action: 'check-in', mode: 'office' } });
  assert.equal((await checkIn.json()).record.lateMinutes, 30);
  const waive = (role, payload = { userId: 'employee', date: day }) => request('/api/attendance-overview/late-waive', role, { method: 'POST', payload });

  for (const role of ['employee', 'accountant', 'inactive', null]) assert.equal((await waive(role)).status, 403);
  assert.equal((await waive('ceo', { userId: 'nobody', date: day })).status, 400);
  const response = await waive('ceo');
  assert.equal(response.status, 200);
  const { record } = await response.json();
  assert.equal(record.late, false);
  assert.equal(record.lateMinutes, undefined);
  assert.equal(record.lateWaived.minutes, 30);
  assert.equal(typeof record.checkIn, 'string');
  assert.equal((await waive('admin')).status, 404);
});
