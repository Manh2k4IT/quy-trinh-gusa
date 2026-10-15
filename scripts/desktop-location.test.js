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
    require: (name) => name === 'electron' ? electron : require(name),
    process: { platform: 'win32' },
    console,
    URL,
    __dirname: path.resolve(__dirname, '..', 'desktop'),
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8'), context);
  vm.runInContext('configureAppPermissions()', context);
  return { handlers, permissions, opened };
}

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
