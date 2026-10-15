const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadDesktop() {
  const handlers = new Map();
  const permissions = {};
  const opened = [];
  const electron = {
    app: {
      requestSingleInstanceLock: () => true,
      whenReady: () => ({ then: () => {} }),
      on: () => {},
      getPath: () => 'unused',
    },
    ipcMain: { handle: (name, handler) => handlers.set(name, handler), on: () => {} },
    session: { defaultSession: {
      setPermissionRequestHandler: (handler) => { permissions.request = handler; },
      setPermissionCheckHandler: (handler) => { permissions.check = handler; },
    } },
    shell: { openExternal: async (url) => { opened.push(url); } },
  };
  const context = vm.createContext({
    require: (name) => name === 'electron' ? electron : name === './location'
      ? { getWindowsPosition: async () => ({ ok: true, position: { coords: { latitude: 10, longitude: 106, accuracy: 100 }, timestamp: 1 } }) }
      : name === './printing' ? { previewDocument: async () => ({ canceled: false }) }
      : require(name),
    process: { platform: 'win32' },
    console,
    URL,
    __dirname: path.resolve(__dirname, '..', 'desktop'),
  });

  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8'), context);
  vm.runInContext('configureAppPermissions()', context);
  return { handlers, permissions, opened };
}

test('only trusted app frames can request native Windows coordinates', async () => {
  const { handlers } = loadDesktop();
  const handler = handlers.get('app:get-location');
  await assert.rejects(handler({ senderFrame: { url: 'https://untrusted.example' } }));
  const result = await handler({ senderFrame: { url: 'https://quytrinh.gusa.vn/proposals.html' } });
  assert.equal(result.ok, true);
  assert.equal(result.position.coords.latitude, 10);
});

test('native location validates coordinates and preserves provider errors', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'location.js'), 'utf8');
  for (const result of [
    { ok: true, position: { coords: { latitude: 10, longitude: 106, accuracy: 100 }, timestamp: 1 } },
    { ok: false, error: { code: 1, message: 'Denied' } },
    { ok: true, position: { coords: { latitude: 999, longitude: 106, accuracy: 100 }, timestamp: 1 } },
  ]) {
    const context = {
      require: (name) => name === 'node:child_process' ? {
        execFile: (executable, args, options, callback) => {
          assert.ok(args.at(-1).includes('app.asar.unpacked'));
          assert.equal(options.windowsHide, true);
          callback(null, JSON.stringify(result));
        },
      } : require(name),
      process: { env: {} },
      __dirname: 'C:\\test\\app.asar\\desktop',
      module: { exports: {} },
    };
    vm.runInNewContext(source, context);
    const request = context.module.exports.getWindowsPosition();
    if (result.position?.coords.latitude === 999) await assert.rejects(request);
    else assert.deepEqual(JSON.parse(JSON.stringify(await request)), result);
  }
});

test('untrusted frames cannot request a PDF preview', async () => {
  const { handlers } = loadDesktop();
  await assert.rejects(handlers.get('app:preview-document')(
    { senderFrame: { url: 'https://untrusted.example' } }, '<h1>Test</h1>'));
});

test('desktop permits location and notifications only for the configured origin', () => {
  const { permissions } = loadDesktop();
  for (const permission of ['geolocation', 'notifications', 'camera']) {
    for (const origin of ['https://quytrinh.gusa.vn', 'https://untrusted.example']) {
      const expected = permission !== 'camera' && origin === 'https://quytrinh.gusa.vn';
      assert.equal(permissions.check(null, permission, origin), expected);
      let result;
      permissions.request({ getURL: () => origin }, permission, (allowed) => { result = allowed; }, {});
      assert.equal(result, expected);
    }
  }
});

test('only trusted app frames can open Windows location settings', async () => {
  const { handlers, opened } = loadDesktop();
  const handler = handlers.get('app:open-location-settings');
  await assert.rejects(handler({ senderFrame: { url: 'https://untrusted.example' } }));
  assert.equal(opened.length, 0);
  assert.equal(await handler({ senderFrame: { url: 'https://quytrinh.gusa.vn/proposals.html' } }), true);
  assert.deepEqual(opened, ['ms-settings:privacy-location']);
});
