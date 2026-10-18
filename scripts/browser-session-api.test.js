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

async function startServer() {
  const port = await new Promise((resolve) => {
    const listener = net.createServer();
    listener.listen(0, '127.0.0.1', () => {
      const port = listener.address().port;
      listener.close(() => resolve(port));
    });
  });
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), DATA_DIR: directory, ALLOW_LOCAL_DEV: 'false', NODE_ENV: 'production' },
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

function request(url, session) {
  return fetch(`${baseUrl}${url}`, {
    redirect: 'manual',
    headers: session ? { Cookie: `gusa_session=${session}` } : {},
  });
}

test.before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gusa-browser-session-test-'));
  const users = {
    active: { id: 'active', email: 'active@example.test', status: 'active', role: 'employee' },
    pending: { id: 'pending', email: 'pending@example.test', status: 'pending', role: 'employee' },
  };
  const sessions = {
    active: { userId: 'active', createdAt: Date.now() },
    pending: { userId: 'pending', createdAt: Date.now() },
    expired: { userId: 'active', createdAt: Date.now() - 11 * 365 * 24 * 60 * 60 * 1000 },
  };
  for (const [file, value] of Object.entries({ 'users.json': users, 'sessions.json': sessions, 'push-devices.json': [] })) {
    fs.writeFileSync(path.join(directory, file), JSON.stringify(value));
  }
  await startServer();
});

test.after(async () => {
  await stopServer();
  if (directory) fs.rmSync(directory, { recursive: true });
});

test('returning authenticated browser opens the app while guests and expired sessions see login', async () => {
  for (const url of ['/', '/index.html', '/?source=homescreen']) {
    const response = await request(url, 'active');
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/organization-chart.html');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  const pending = await request('/', 'pending');
  assert.equal(pending.headers.get('location'), '/pending.html');
  for (const session of [undefined, 'unknown', 'expired']) {
    const response = await request('/', session);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /data-action="login"/);
  }
});

test('saved browser session survives server restart and logout invalidates it', async () => {
  await stopServer();
  await startServer();
  assert.equal((await request('/', 'active')).status, 302);
  const logout = await request('/auth/logout', 'active');
  assert.match(logout.headers.get('set-cookie'), /gusa_session=;.*HttpOnly.*Max-Age=0/);
  assert.equal((await request('/', 'active')).status, 200);
  await stopServer();
  await startServer();
  assert.equal((await request('/', 'active')).status, 200);
});

test('HTML pages include new tab and home-screen icons and manifest serves actual icon files', async () => {
  for (const url of ['/', '/pending.html']) {
    const response = await request(url);
    const html = await response.text();
    assert.match(html, /rel="manifest" href="\/manifest.webmanifest"/);
    assert.match(html, /rel="icon"[^>]+\/app-icons\/favicon.png/);
    assert.match(html, /rel="apple-touch-icon"[^>]+\/app-icons\/apple-touch-icon.png/);
  }
  const response = await request('/manifest.webmanifest');
  const manifest = await response.json();
  for (const icon of manifest.icons) {
    const response = await request(icon.src);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /image\/png/);
    const png = Buffer.from(await response.arrayBuffer());
    assert.equal(png.readUInt32BE(16), Number(icon.sizes.split('x')[0]));
  }
});

test('push worker receives public configuration before its classic bundle', async () => {
  const response = await request('/firebase-messaging-sw.js');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /javascript/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const script = await response.text();
  assert.ok(script.startsWith('self.GUSA_FIREBASE_WEB_CONFIG = '));
  const config = JSON.parse(script.slice(script.indexOf(' = ') + 3, script.indexOf(';\n')));
  assert.ok(Object.hasOwn(config, 'firebase'));
  assert.equal(Object.hasOwn(config, 'private_key'), false);
});
