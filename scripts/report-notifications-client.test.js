const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "report-notifications.js"), "utf8");

function createClient(summary, withCards = true) {
  const storage = new Map();
  const handlers = {};
  const errors = [];
  const status = { hidden: true, addEventListener() {} };
  const count = { textContent: "" };
  const badge = { hidden: true, querySelector: () => count, setAttribute() {} };
  const classes = new Set();
  const card = {
    dataset: { reportKey: "personnel" },
    querySelector: () => badge,
    classList: {
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
      remove: (name) => classes.delete(name),
    },
  };
  let currentSummary = summary;
  let fail = false;
  let poll;
  let pollInterval;
  const document = {
    hidden: false,
    querySelector: () => withCards ? status : null,
    querySelectorAll: (selector) => {
      if (!withCards) return [];
      if (selector === "[data-report-unread]") return [badge];
      return [card];
    },
    addEventListener: (name, handler) => { handlers[name] = handler; },
  };
  const window = {
    addEventListener: (name, handler) => { handlers[name] = handler; },
    setInterval: (handler, interval) => { poll = handler; pollInterval = interval; },
  };
  vm.runInNewContext(source, {
    window, document,
    localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    console: { error: (...args) => errors.push(args) },
    fetch: async () => ({ ok: !fail, status: fail ? 500 : 200, json: async () => currentSummary }),
  });
  return {
    window, document, storage, badge, count, status, errors, handlers,
    setSummary: (value) => { currentSummary = value; },
    setFailure: (value) => { fail = value; },
    poll: () => poll(),
    pollInterval: () => pollInterval,
    settle: () => new Promise((resolve) => setImmediate(resolve)),
  };
}

test("badges count unseen entries once, clear after viewing, and reappear on edits", async () => {
  const items = [{ id: "p1", version: "v1" }, { id: "p2", version: "v1" }];
  const client = createClient({ accountId: "admin", reports: { personnel: items } });
  await client.settle();
  assert.equal(client.pollInterval(), 15000);
  assert.equal(client.count.textContent, "2");
  assert.equal(client.badge.hidden, false);
  client.window.GusaReportNotifications.markSeen({ accountId: "admin", reportKey: "personnel", items });
  client.poll();
  await client.settle();
  assert.equal(client.badge.hidden, true);
  client.setSummary({ accountId: "admin", reports: { personnel: [{ id: "p1", version: "v2" }, items[1], { id: "p3", version: "v1" }] } });
  client.poll();
  await client.settle();
  assert.equal(client.count.textContent, "2");
  client.poll();
  await client.settle();
  assert.equal(client.count.textContent, "2");
});

test("read state is independent per account and report and is not saved in hidden tabs", async () => {
  const items = [{ id: "p1", version: "v1" }];
  const client = createClient({ accountId: "admin", reports: { personnel: items } });
  await client.settle();
  client.window.GusaReportNotifications.markSeen({ accountId: "admin", reportKey: "payment", items });
  client.poll();
  await client.settle();
  assert.equal(client.badge.hidden, false);
  client.document.hidden = true;
  client.window.GusaReportNotifications.markSeen({ accountId: "admin", reportKey: "personnel", items });
  assert.equal(client.storage.has("gusa-report-seen:admin:personnel"), false);
  client.document.hidden = false;
  client.window.GusaReportNotifications.markSeen({ accountId: "admin", reportKey: "personnel", items });
  client.setSummary({ accountId: "another-admin", reports: { personnel: items } });
  client.poll();
  await client.settle();
  assert.equal(client.badge.hidden, false);
});

test("load failures show an explicit error, preserve read state, and can recover", async () => {
  const items = [{ id: "p1", version: "v1" }];
  const client = createClient({ accountId: "admin", reports: { personnel: items } });
  await client.settle();
  client.window.GusaReportNotifications.markSeen({ accountId: "admin", reportKey: "personnel", items });
  const saved = client.storage.get("gusa-report-seen:admin:personnel");
  client.setFailure(true);
  client.poll();
  await client.settle();
  assert.equal(client.status.hidden, false);
  assert.equal(client.errors.length, 1);
  assert.equal(client.storage.get("gusa-report-seen:admin:personnel"), saved);
  client.setFailure(false);
  client.poll();
  await client.settle();
  assert.equal(client.status.hidden, true);
  assert.equal(client.badge.hidden, true);
});

test("other tabs clearing read state update the badge, and large counts are capped visually", async () => {
  const items = Array.from({ length: 101 }, (_, index) => ({ id: `p${index}`, version: "v1" }));
  const client = createClient({ accountId: "admin", reports: { personnel: items } });
  await client.settle();
  assert.equal(client.count.textContent, "99+");
  client.window.GusaReportNotifications.markSeen({ accountId: "admin", reportKey: "personnel", items });
  client.handlers.storage({ key: "gusa-report-seen:admin:personnel" });
  assert.equal(client.badge.hidden, true);
});

test("a report loaded in the background becomes seen only when displayed", () => {
  const client = createClient(null, false);
  const snapshot = { accountId: "admin", reportKey: "personnel", items: [{ id: "p1", version: "v1" }] };
  client.document.hidden = true;
  client.window.GusaReportNotifications.markSeen(snapshot);
  assert.equal(client.storage.size, 0);
  client.document.hidden = false;
  client.handlers.visibilitychange();
  assert.equal(client.storage.get("gusa-report-seen:admin:personnel"), '{"p1":"v1"}');
});
