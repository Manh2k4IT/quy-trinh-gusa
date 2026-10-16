const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

function assertPng(file, size) {
  const png = fs.readFileSync(path.join(root, file));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
}

test('Android launcher images include every density and adaptive foreground', () => {
  for (const [density, size, foreground] of [
    ['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216],
    ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432],
  ]) {
    const directory = path.join('android', 'app', 'src', 'main', 'res', `mipmap-${density}`);
    assertPng(path.join(directory, 'ic_launcher.png'), size);
    assertPng(path.join(directory, 'ic_launcher_round.png'), size);
    assertPng(path.join(directory, 'ic_launcher_foreground.png'), foreground);
  }
});

test('iOS icon and desktop preview have the required dimensions', () => {
  assertPng(path.join('desktop', 'icons', 'app.png'), 512);
  const directory = path.join('ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  const contents = JSON.parse(fs.readFileSync(path.join(root, directory, 'Contents.json'), 'utf8'));
  for (const image of contents.images) assertPng(path.join(directory, image.filename), 1024);
});

test('pinned website icons and favicon use explicit platform sizes', () => {
  for (const [file, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180], ['favicon.png', 32]]) {
    assertPng(path.join('app-icons', file), size);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ['192x192', '512x512']);
  for (const icon of manifest.icons) {
    assertPng(icon.src.split('?')[0].slice(1), Number(icon.sizes.split('x')[0]));
  }
});

test('Windows icon contains valid PNG frames at all shell sizes and is used for packaging', () => {
  const icon = fs.readFileSync(path.join(root, 'desktop', 'icons', 'app.ico'));
  assert.equal(icon.readUInt16LE(0), 0);
  assert.equal(icon.readUInt16LE(2), 1);
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  assert.equal(icon.readUInt16LE(4), sizes.length);
  for (const [i, size] of sizes.entries()) {
    const entry = 6 + i * 16;
    assert.equal(icon[entry] || 256, size);
    assert.equal(icon[entry + 1] || 256, size);
    const length = icon.readUInt32LE(entry + 8);
    const offset = icon.readUInt32LE(entry + 12);
    assert.ok(offset + length <= icon.length);
    const png = icon.subarray(offset, offset + length);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  const { build } = require('../package.json');
  assert.equal(build.win.icon, 'desktop/icons/app.ico');
  assert.equal(build.nsis.installerIcon, build.win.icon);
  assert.equal(build.nsis.uninstallerIcon, build.win.icon);
});
