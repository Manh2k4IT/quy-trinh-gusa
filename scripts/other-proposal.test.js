// "Other" proposals (business trips…): a named, multi-day proposal that marks attendance once approved.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const zlib = require("node:zlib");
const { spawn } = require("node:child_process");

let server;
let directory;
let baseUrl;

function signaturePng() {
  function chunk(type, bytes) {
    const data = Buffer.concat([Buffer.from(type), bytes]);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const result = Buffer.alloc(bytes.length + 12);
    result.writeUInt32BE(bytes.length);
    data.copy(result, 4);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
    return result;
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(600);
  header.writeUInt32BE(200, 4);
  header[8] = 8;
  header[9] = 6;
  const pixels = Buffer.alloc((600 * 4 + 1) * 200);
  for (let x = 20; x < 160; x++) {
    const offset = (600 * 4 + 1) * 80 + 1 + x * 4;
    pixels[offset + 2] = 120;
    pixels[offset + 3] = 255;
  }
  const png = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

test.before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "gusa-other-proposal-test-"));
  const users = {};
  const sessions = {};
  for (const role of ["admin", "employee"]) {
    users[role] = { id: role, name: role, email: `${role}@example.test`, role, status: "active" };
    sessions[`${role}-session`] = { userId: role, createdAt: Date.now() };
  }
  fs.writeFileSync(path.join(directory, "users.json"), JSON.stringify(users));
  fs.writeFileSync(path.join(directory, "sessions.json"), JSON.stringify(sessions));
  fs.writeFileSync(path.join(directory, "proposals.json"), "[]");
  fs.writeFileSync(path.join(directory, "attendance.json"), JSON.stringify({
    employee: { "2026-11-12": { date: "2026-11-12", status: "completed", workMode: "office", checkIn: "2026-11-12T01:30:00Z", checkOut: "2026-11-12T10:30:00Z" } },
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
    env: { ...process.env, PORT: String(port), DATA_DIR: directory, ALLOW_LOCAL_DEV: "false", NODE_ENV: "production", GOOGLE_CLIENT_ID: "test-client-id", GOOGLE_CLIENT_SECRET: "test-client-secret" },
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

const call = (url, role, body) => fetch(`${baseUrl}${url}`, {
  method: body ? "POST" : "GET",
  headers: { Cookie: `gusa_session=${role}-session`, ...(body ? { "Content-Type": "application/json" } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

test("an approved other proposal marks every day of its range in attendance", async () => {
  const payload = { type: "other", dateFrom: "2026-11-12", dateTo: "2026-11-14", date: "2026-11-12", reason: "Gặp đối tác", signatureName: "Nguyễn Văn A", signatureData: signaturePng() };
  const missingSubject = await call("/api/proposals", "employee", payload);
  assert.equal(missingSubject.status, 400);
  assert.match(await missingSubject.text(), /tên đề xuất/);

  const created = await call("/api/proposals", "employee", { ...payload, subject: "  Đi công tác Hà Nội  " });
  assert.equal(created.status, 201);
  const { proposal } = await created.json();
  assert.equal(proposal.subject, "Đi công tác Hà Nội");
  assert.equal(proposal.dateFrom, "2026-11-12");
  assert.equal(proposal.dateTo, "2026-11-14");

  const html = await (await call(`/api/proposals/${proposal.id}/document?format=html`, "employee")).text();
  assert.ok(html.includes("ĐƠN ĐỀ XUẤT ĐI CÔNG TÁC HÀ NỘI"));

  assert.equal((await call("/api/proposals/status", "admin", { id: proposal.id, status: "approved" })).status, 200);
  const attendance = JSON.parse(fs.readFileSync(path.join(directory, "attendance.json"), "utf8")).employee;
  for (const date of ["2026-11-12", "2026-11-13", "2026-11-14"]) {
    assert.equal(attendance[date].status, "other", date);
    assert.equal(attendance[date].otherSubject, "Đi công tác Hà Nội", date);
    assert.equal(attendance[date].checkIn, undefined, date);
  }
});

test("the attendance overview can return a day range instead of a month", async () => {
  const days = async (query) => Object.keys((await (await call(`/api/attendance-overview?${query}`, "admin")).json()).users.find((user) => user.id === "employee").records).sort();
  assert.deepEqual(await days("from=2026-11-13&to=2026-11-14&report=online"), ["2026-11-13", "2026-11-14"]);
  assert.deepEqual(await days("from=2026-11-12&to=2026-11-12&report=online"), ["2026-11-12"]);
  // An invalid or reversed range falls back to the month.
  assert.deepEqual(await days("month=2026-11&from=2026-11-14&to=2026-11-12"), ["2026-11-12", "2026-11-13", "2026-11-14"]);
});

test("admins can set or clear the other status on a day", async () => {
  const set = await call("/api/attendance-overview/status", "admin", { userId: "employee", date: "2026-11-14", status: "present" });
  assert.equal(set.status, 200);
  assert.equal((await set.json()).record.otherSubject, undefined);
  const manual = await call("/api/attendance-overview/status", "admin", { userId: "employee", date: "2026-11-20", status: "other" });
  assert.equal(manual.status, 200);
  assert.equal((await manual.json()).record.status, "other");
});
