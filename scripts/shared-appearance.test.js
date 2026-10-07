const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "admin-menu.js"), "utf8");
const bootstrap = source.slice(0, source.indexOf("function initializeBrowserNavigation"));

function createAppearance(values = {}) {
  const storage = new Map(Object.entries(values));
  const properties = {};
  const handlers = {};
  const controls = {
    theme: { setAttribute: (name, value) => { controls.theme[name] = value; }, classList: { toggle() {} } },
    audio: { setAttribute: (name, value) => { controls.audio[name] = value; }, classList: { toggle() {} } },
    palette: { dataset: { themePrimary: "#75483f" }, setAttribute: (name, value) => { controls.palette[name] = value; } },
    themeStatus: {},
  };
  const appended = [];
  const document = {
    body: { dataset: {} },
    documentElement: { style: { setProperty: (name, value) => { properties[name] = value; } } },
    head: { append: (element) => appended.push(element) },
    createElement: () => ({ dataset: {}, setAttribute() {} }),
    querySelector: (selector) => selector === "[data-interface-theme-status]" ? controls.themeStatus : selector === ".workspace" ? { prepend: (element) => appended.push(element) } : null,
    querySelectorAll: (selector) => selector === "[data-interface-theme-toggle]" ? [controls.theme] : selector === "[data-theme-primary]" ? [controls.palette] : selector === "[data-audio-permission-button]" ? [controls.audio] : [],
  };
  const errors = [];
  vm.runInNewContext(bootstrap, {
    document, localStorage: { getItem: (key) => storage.get(key) || null },
    window: { addEventListener: (name, handler) => { handlers[name] = handler; } },
    console: { error: (...args) => errors.push(args) },
  });
  return { storage, properties, document, handlers, controls, errors, appended };
}

test("shared pages apply persisted appearance and controls", () => {
  const app = createAppearance({
    "gusa-theme": "dark",
    "gusa-palette": JSON.stringify({ primary: "#75483f", surface: "#f5eeeb" }),
    "gusa-proposal-audio-enabled": "false",
  });
  assert.equal(app.document.body.dataset.theme, "dark");
  assert.equal(app.properties["--navy"], "#75483f");
  assert.equal(app.properties["--blue-100"], "#f5eeeb");
  assert.equal(app.properties["--active"], "#f5eeeb");
  assert.equal(app.controls.theme["aria-checked"], "true");
  assert.equal(app.controls.palette["aria-pressed"], "true");
  assert.equal(app.controls.audio["aria-checked"], "false");
});

test("changes from other tabs and history restore update current appearance", () => {
  const app = createAppearance();
  assert.equal(app.document.body.dataset.theme, "light");
  app.storage.set("gusa-theme", "dark");
  app.handlers.storage({ key: "gusa-theme" });
  assert.equal(app.document.body.dataset.theme, "dark");
  app.storage.set("gusa-theme", "light");
  app.handlers.pageshow();
  assert.equal(app.document.body.dataset.theme, "light");
  app.storage.set("gusa-palette", JSON.stringify({ primary: "#247a58", surface: "#e9f5ef" }));
  app.handlers.storage({ key: "gusa-palette" });
  assert.equal(app.properties["--navy"], "#247a58");
});

test("invalid saved palettes show an explicit error without overwriting storage", () => {
  for (const palette of ["not-json", '{"primary":"invalid","surface":"#ffffff"}']) {
    const app = createAppearance({ "gusa-palette": palette });
    assert.equal(app.errors.length, 1);
    assert.equal(app.storage.get("gusa-palette"), palette);
    assert.ok(app.appended.some((element) => element.textContent?.includes("Không đọc được cài đặt")));
  }
});
