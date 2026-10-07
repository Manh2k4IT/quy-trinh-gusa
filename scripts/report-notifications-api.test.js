const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

let server;
let directory;
let baseUrl;
const proposal = { id: "personnel-1", userId: "employee", type: "leave", status: "pending", date: "2026-10-07" };
const payments = [
  { id: "management-payment", userId: "employee", type: "payment", status: "pending", paymentFlow: "ceo", paymentStage: "management" },
  { id: "accounting-payment", userId: "employee", type: "payment", status: "pending", paymentFlow: "ceo", paymentStage: "accounting" },
];

test.before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "gusa-report-notifications-test-"));
  const users = {};
  const sessions = {};
  for (const role of ["admin", "ceo", "accountant", "employee"]) {
    users[role] = { id: role, name: role, email: `${role}@example.test`, role, status: "active" };
    sessions[`${role}-session`] = { userId: role, createdAt: Date.now() };
  }
  users.inactive = { id: "inactive", role: "admin", status: "pending" };
  sessions["inactive-session"] = { userId: "inactive", createdAt: Date.now() };
  fs.writeFileSync(path.join(directory, "users.json"), JSON.stringify(users));
  fs.writeFileSync(path.join(directory, "sessions.json"), JSON.stringify(sessions));
  fs.writeFileSync(path.join(directory, "proposals.json"), JSON.stringify([proposal, ...payments]));
  fs.writeFileSync(path.join(directory, "attendance.json"), JSON.stringify({
    employee: { "2026-10-07": { date: "2026-10-07", workMode: "online", late: true, checkIn: "2026-10-07T03:00:00Z" } },
  }));
  for (const file of ["organization-chart.json", "organization-profiles.json", "organization-members.json", "payment-template.json"]) {
    fs.writeFileSync(path.join(directory, file), "{}");
  }
  const port = await new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.on("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const assignedPort = listener.address().port;
      listener.close(() => resolve(assignedPort));
    });
  });
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, PORT: String(port), DATA_DIR: directory, ALLOW_LOCAL_DEV: "false", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Test server did not start.")), 20000);
    server.on("error", (error) => { clearTimeout(timeout); reject(error); });
    server.on("exit", (code) => { clearTimeout(timeout); reject(new Error(`Test server exited: ${code}`)); });
    server.stdout.on("data", (data) => {
      if (data.toString().includes("Gusa Quy Trinh:")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
});

test.after(async () => {
  if (server && server.exitCode === null) {
    await new Promise((resolve) => {
      server.once("exit", resolve);
      server.kill();
    });
  }
  if (directory) fs.rmSync(directory, { recursive: true });
});

async function request(url, role) {
  return fetch(`${baseUrl}${url}`, { headers: role ? { Cookie: `gusa_session=${role}-session` } : {} });
}

test("summary API exposes only authorized reports and no report contents", async () => {
  for (const role of ["admin", "ceo"]) {
    const response = await request("/api/report-notifications", role);
    assert.equal(response.status, 200);
    const summary = await response.json();
    assert.equal(summary.accountId, role);
    assert.deepEqual(Object.keys(summary.reports), ["online", "late", "overview", "personnel", "payment"]);
    assert.equal(summary.reports.payment.length, 2);
    assert.deepEqual(Object.keys(summary.reports.online[0]), ["id", "version"]);
  }
  const accountant = await (await request("/api/report-notifications", "accountant")).json();
  assert.deepEqual(Object.keys(accountant.reports), ["payment"]);
  assert.deepEqual(accountant.reports.payment.map((item) => item.id), ["accounting-payment"]);
  for (const role of ["employee", "inactive", null]) {
    assert.equal((await request("/api/report-notifications", role)).status, 403);
  }
});

test("report loads carry matching snapshots and updates change their versions", async () => {
  const summary = await (await request("/api/report-notifications", "admin")).json();
  for (const reportKey of ["online", "late", "overview"]) {
    const result = await (await request(`/api/attendance-overview?month=2026-10&report=${reportKey}`, "admin")).json();
    assert.deepEqual(result.reportNotificationSnapshot, { accountId: "admin", reportKey, items: summary.reports[reportKey] });
  }
  const personnel = await (await request("/api/proposals?scope=all", "admin")).json();
  assert.deepEqual(personnel.reportNotificationSnapshot.items, summary.reports.personnel);
  const payment = await (await request("/api/proposals?scope=payment-report", "accountant")).json();
  assert.deepEqual(payment.reportNotificationSnapshot.items.map((item) => item.id), ["accounting-payment"]);
  fs.writeFileSync(path.join(directory, "proposals.json"), JSON.stringify([{ ...proposal, status: "approved" }, ...payments]));
  const updated = await (await request("/api/report-notifications", "admin")).json();
  assert.notEqual(updated.reports.personnel[0].version, summary.reports.personnel[0].version);
  assert.deepEqual(updated.reports.payment, summary.reports.payment);
});
