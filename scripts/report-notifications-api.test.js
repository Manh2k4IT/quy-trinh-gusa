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
  { id: "direct-payment", userId: "employee", type: "payment", status: "pending", paymentFlow: "accountant", paymentStage: "accounting" },
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
    assert.deepEqual(summary.reports.payment.map((item) => item.id), ["management-payment", "accounting-payment"]);
    assert.deepEqual(Object.keys(summary.reports.online[0]), ["id", "version"]);
  }
  const accountant = await (await request("/api/report-notifications", "accountant")).json();
  assert.deepEqual(Object.keys(accountant.reports), ["payment"]);
  assert.deepEqual(accountant.reports.payment.map((item) => item.id), ["accounting-payment", "direct-payment"]);
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
  assert.deepEqual(payment.reportNotificationSnapshot.items.map((item) => item.id), ["accounting-payment", "direct-payment"]);
  fs.writeFileSync(path.join(directory, "proposals.json"), JSON.stringify([{ ...proposal, status: "approved" }, ...payments]));
  const updated = await (await request("/api/report-notifications", "admin")).json();
  assert.notEqual(updated.reports.personnel[0].version, summary.reports.personnel[0].version);
  assert.deepEqual(updated.reports.payment, summary.reports.payment);
});

test("payment report badges and review queues remain isolated by recipient", async () => {
  for (const role of ["admin", "ceo", "accountant"]) {
    const summary = await (await request("/api/report-notifications", role)).json();
    const report = await (await request("/api/proposals?scope=payment-report", role)).json();
    const expected = role === "accountant" ? ["accounting-payment", "direct-payment"] : ["management-payment", "accounting-payment"];
    assert.deepEqual(report.proposals.map((item) => item.id), expected);
    assert.deepEqual(report.reportNotificationSnapshot.items, summary.reports.payment);
    const queue = await (await request("/api/proposals?scope=review-queue", role)).json();
    assert.deepEqual(queue.proposals.filter((item) => item.type === "payment").map((item) => item.id), role === "accountant" ? ["accounting-payment", "direct-payment"] : ["management-payment"]);
  }
  const beforeAdmin = await (await request("/api/report-notifications", "admin")).json();
  const beforeAccountant = await (await request("/api/report-notifications", "accountant")).json();
  const file = path.join(directory, "proposals.json");
  const original = fs.readFileSync(file, "utf8");
  try {
    const records = JSON.parse(original);
    records.find((item) => item.id === "direct-payment").reason = "Updated direct accountant proposal";
    fs.writeFileSync(file, JSON.stringify(records));
    const afterAdmin = await (await request("/api/report-notifications", "admin")).json();
    const afterAccountant = await (await request("/api/report-notifications", "accountant")).json();
    assert.deepEqual(afterAdmin.reports.payment, beforeAdmin.reports.payment);
    assert.notDeepEqual(afterAccountant.reports.payment, beforeAccountant.reports.payment);
  } finally {
    fs.writeFileSync(file, original);
  }
});

test("signed proposals preserve documents and payment routing", async () => {
  const payload = { type: "leave", date: "2026-10-12", reason: "Test signature", signatureName: "Nguyễn Văn A" };
  const post = (data) => fetch(`${baseUrl}/api/proposals`, {
    method: "POST",
    headers: { Cookie: "gusa_session=employee-session", "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  for (const signatureData of ["", "data:image/svg+xml;base64,AAAA", `data:image/png;base64,${"A".repeat(270000)}`]) {
    const response = await post({ ...payload, signatureData });
    assert.equal(response.status, 400);
    assert.match(await response.text(), /ký/);
  }
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
  const png = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header), chunk("IDAT", require("node:zlib").deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
  const signatureData = `data:image/png;base64,${png.toString("base64")}`;
  for (const signatureName of ["", "   ", "A".repeat(151)]) {
    assert.equal((await post({ ...payload, signatureData, signatureName })).status, 400);
  }
  const response = await post({ ...payload, signatureData });
  assert.equal(response.status, 201);
  const saved = (await response.json()).proposal;
  assert.equal(saved.signatureData, signatureData);
  assert.equal(saved.signatureName, payload.signatureName);
  const loaded = await (await request("/api/proposals", "employee")).json();
  assert.equal(loaded.proposals.find((item) => item.id === saved.id).signatureData, signatureData);
  assert.equal(loaded.proposals.find((item) => item.id === saved.id).signatureName, payload.signatureName);
  const documentUrl = `/api/proposals/${saved.id}/document`;
  const preview = await request(`${documentUrl}?format=html`, "employee");
  assert.equal(preview.status, 200);
  const html = await preview.text();
  assert.ok(html.includes("Nguyễn Văn A"));
  assert.ok(html.includes(signatureData));
  assert.ok(!html.includes('<p class="draft">'));
  const pdf = await request(`${documentUrl}?format=pdf`, "employee");
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.match(pdf.headers.get("content-disposition"), /attachment; filename=".*\.pdf"/);
  const pdfBytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(pdfBytes.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdfBytes.toString("latin1").includes("/Subtype /Image"));
  for (const role of ["admin", "ceo"]) assert.equal((await request(`${documentUrl}?format=pdf`, role)).status, 200);
  for (const role of ["accountant", "inactive", null]) assert.equal((await request(`${documentUrl}?format=pdf`, role)).status, 403);
  const originalProposals = JSON.parse(fs.readFileSync(path.join(directory, "proposals.json"), "utf8"));
  fs.writeFileSync(path.join(directory, "proposals.json"), JSON.stringify([...originalProposals, { ...saved, id: "someone-else", userId: "another-employee" }]));
  assert.equal((await request("/api/proposals/someone-else/document?format=pdf", "employee")).status, 403);
  assert.equal((await request("/api/proposals/missing/document?format=pdf", "employee")).status, 404);
  assert.equal((await request(`${documentUrl}?format=unknown`, "employee")).status, 400);
  async function decide(id, role, changes) {
    return fetch(`${baseUrl}/api/proposals/status`, { method: "POST", headers: { Cookie: `gusa_session=${role}-session`, "Content-Type": "application/json" }, body: JSON.stringify({ id, ...changes }) });
  }
  for (const paymentFlow of ["ceo", "accountant"]) {
    const payment = await post({ ...payload, type: "payment", category: "Không dùng tổng từ client", amount: "1", paymentFlow, signatureData, reason: "", paymentDepartment: "Marketing", paymentItems: [{ description: "Mua văn phòng phẩm", amount: 1000000, document: "Hóa đơn A" }, { description: "Vận chuyển", amount: 250000, document: "" }], paymentAccountName: "Nguyễn Văn A", paymentAccountNumber: "0012345678", paymentBankName: "Ngân hàng A" });
    assert.equal(payment.status, 201);
    const paymentProposal = (await payment.json()).proposal;
    assert.equal(paymentProposal.paymentFlow, paymentFlow);
    assert.equal(paymentProposal.paymentStage, paymentFlow === "ceo" ? "management" : "accounting");
    assert.equal(paymentProposal.signatureData, signatureData);
    assert.equal(paymentProposal.amount, "1250000");
    assert.equal(paymentProposal.paymentAccountNumber, "0012345678");
    assert.equal(paymentProposal.paymentItems.length, 2);
    for (const role of ["admin", "ceo"]) {
      const report = await (await request("/api/proposals?scope=payment-report", role)).json();
      const summary = await (await request("/api/report-notifications", role)).json();
      assert.equal(report.proposals.some((item) => item.id === paymentProposal.id), paymentFlow === "ceo");
      assert.equal(summary.reports.payment.some((item) => item.id === paymentProposal.id), paymentFlow === "ceo");
    }
    const htmlResponse = await request(`/api/proposals/${paymentProposal.id}/document?format=html`, "employee");
    const paymentHtml = await htmlResponse.text();
    assert.ok(paymentHtml.includes("Mẫu số: 05-TT"));
    assert.ok(paymentHtml.includes("Một triệu hai trăm năm mươi nghìn đồng"));
    assert.ok(paymentHtml.includes("0012345678"));
    const url = `/api/proposals/${paymentProposal.id}/document?format=pdf`;
    assert.equal((await request(url, "employee")).status, 200);
    if (paymentFlow === "ceo") {
      assert.equal((await request(url, "accountant")).status, 403);
      assert.equal((await decide(paymentProposal.id, "accountant", { action: "confirm" })).status, 403);
      const approved = await decide(paymentProposal.id, "ceo", { status: "approved" });
      assert.equal(approved.status, 200);
      assert.equal((await approved.json()).proposal.paymentStage, "accounting");
      const accountingSummary = await (await request("/api/report-notifications", "accountant")).json();
      assert.ok(accountingSummary.reports.payment.some((item) => item.id === paymentProposal.id));
    } else {
      assert.equal((await decide(paymentProposal.id, "ceo", { status: "approved" })).status, 409);
    }
    assert.equal((await request(url, "accountant")).status, 200);
    const confirmed = await decide(paymentProposal.id, "accountant", { action: "confirm" });
    assert.equal(confirmed.status, 200);
    const final = (await confirmed.json()).proposal;
    assert.equal(final.paymentStage, "completed");
    assert.equal(final.status, "approved");
  }
  assert.equal((await post({ ...payload, type: "payment", category: "Test", amount: "0", signatureData })).status, 400);
  assert.equal((await post({ ...payload, type: "payment", category: "Test", amount: "100", signatureData, paymentFileName: "bad.pdf", paymentFileData: "invalid" })).status, 400);
  const paymentPayload = { ...payload, type: "payment", category: "Test", amount: "100", signatureData };
  for (const invalid of [{ signatureData: "" }, { signatureName: " " }, { reason: "" }]) {
    assert.equal((await post({ ...paymentPayload, ...invalid })).status, 400);
  }
  for (const invalid of [
    { paymentItems: null },
    { paymentDepartment: "Marketing", paymentItems: [{ description: "A", amount: "1.5" }] },
    { paymentDepartment: "Marketing", paymentItems: [{ description: "A", amount: "10" }], paymentAccountNumber: "001234" },
  ]) assert.equal((await post({ ...paymentPayload, ...invalid })).status, 400);
  const attached = await post({ ...paymentPayload, paymentFlow: "accountant", paymentFileName: "test.txt", paymentFileData: "data:text/plain;base64,dGVzdA==" });
  assert.equal(attached.status, 201);
  const attachedId = (await attached.json()).proposal.id;
  const rejected = await decide(attachedId, "accountant", { action: "accounting-reject", rejectionReason: "Thiếu chứng từ hợp lệ" });
  assert.equal(rejected.status, 200);
  assert.equal((await rejected.json()).proposal.paymentStage, "rejected");
  const management = await post({ ...paymentPayload, paymentFlow: "ceo" });
  const managementId = (await management.json()).proposal.id;
  assert.equal((await decide(managementId, "admin", { status: "rejected" })).status, 200);
  assert.equal((await decide(managementId, "accountant", { action: "confirm" })).status, 409);
  const legacy = await request("/api/proposals/personnel-1/document?format=pdf", "employee");
  assert.equal(legacy.status, 200);
  assert.equal((await request("/api/proposals/management-payment/document?format=pdf", "admin")).status, 200);
});
