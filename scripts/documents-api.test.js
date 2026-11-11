// Kho tài liệu: Admin/CEO upload and delete files; every active user lists and downloads them.
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

test.before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "gusa-documents-test-"));
  const users = {};
  const sessions = {};
  for (const role of ["admin", "employee"]) {
    users[role] = { id: role, name: role, email: `${role}@example.test`, role, status: "active" };
    sessions[`${role}-session`] = { userId: role, createdAt: Date.now() };
  }
  users.pending = { id: "pending", role: "employee", status: "pending" };
  sessions["pending-session"] = { userId: "pending", createdAt: Date.now() };
  fs.writeFileSync(path.join(directory, "users.json"), JSON.stringify(users));
  fs.writeFileSync(path.join(directory, "sessions.json"), JSON.stringify(sessions));
  // Start empty: the server otherwise seeds documents.json from a local copy in the project folder.
  fs.writeFileSync(path.join(directory, "documents.json"), "[]");
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

const cookie = (role) => ({ Cookie: `gusa_session=${role}-session` });
const upload = (role, name, body, details = {}) => fetch(`${baseUrl}/api/documents`, {
  method: "POST",
  headers: {
    ...cookie(role),
    "Content-Type": "application/octet-stream",
    "X-File-Name": encodeURIComponent(name),
    "X-Document-Title": encodeURIComponent(details.title || ""),
    "X-Document-Category": encodeURIComponent(details.category || ""),
    "X-Document-Description": encodeURIComponent(details.description || ""),
  },
  body,
});

test("only Admin/CEO upload; everyone active lists and downloads", async () => {
  assert.equal((await upload("employee", "noi-quy.pdf", "%PDF-1.4 test")).status, 403);
  assert.equal((await upload("admin", "virus.exe", "MZ")).status, 400);
  assert.equal((await upload("admin", "rong.pdf", "")).status, 400);

  const created = await upload("admin", "Nội quy công ty.pdf", "%PDF-1.4 test", { title: "Nội quy 2026", category: "Quy định - Nội quy", description: "Bản mới nhất" });
  assert.equal(created.status, 201);
  const { document } = await created.json();
  assert.equal(document.title, "Nội quy 2026");
  assert.equal(document.category, "Quy định - Nội quy");
  assert.equal(document.name, "Nội quy công ty.pdf");
  assert.equal(document.size, 13);

  const listed = await (await fetch(`${baseUrl}/api/documents`, { headers: cookie("employee") })).json();
  assert.equal(listed.canManage, false);
  assert.deepEqual(listed.documents.map((item) => item.id), [document.id]);
  assert.equal((await fetch(`${baseUrl}/api/documents`, { headers: cookie("pending") })).status, 403);

  const viewed = await fetch(`${baseUrl}/api/documents/files/${document.file}`, { headers: cookie("employee") });
  assert.equal(viewed.status, 200);
  assert.match(viewed.headers.get("content-disposition"), /^inline/);
  assert.equal(await viewed.text(), "%PDF-1.4 test");
  const downloaded = await fetch(`${baseUrl}/api/documents/files/${document.file}?download=1`, { headers: cookie("employee") });
  assert.match(downloaded.headers.get("content-disposition"), /^attachment; .*filename\*=UTF-8''N%E1%BB%99i%20quy/);
  assert.equal((await fetch(`${baseUrl}/api/documents/files/${document.file}`)).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/documents/files/..%2Fusers.json`, { headers: cookie("employee") })).status, 404);

  assert.equal((await fetch(`${baseUrl}/api/documents/${document.id}`, { method: "DELETE", headers: cookie("employee") })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/documents/${document.id}`, { method: "DELETE", headers: cookie("admin") })).status, 200);
  assert.equal((await (await fetch(`${baseUrl}/api/documents`, { headers: cookie("admin") })).json()).documents.length, 0);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(fs.existsSync(path.join(directory, "document-files", document.file)), false);
});

test("uploads get a first-page preview when the format allows it", async () => {
  const { createProposalPdf } = require("../proposal-document-pdf");
  const pdf = await createProposalPdf({ id: "p1", userName: "Nguyễn Văn A", type: "leave", date: "2026-11-11", reason: "Thử ảnh xem trước", status: "pending" });
  const created = await upload("admin", "mau-don.pdf", pdf, { title: "Mẫu đơn", category: "Biểu mẫu" });
  assert.equal(created.status, 201);
  const { document } = await created.json();
  assert.ok(document.thumb);
  const legacy = await (await upload("admin", "cu.doc", "binary", { category: "Khác" })).json();

  const listed = (await (await fetch(`${baseUrl}/api/documents`, { headers: cookie("employee") })).json()).documents;
  assert.equal(listed.find((item) => item.id === document.id).hasPreview, true);
  assert.equal(listed.find((item) => item.id === legacy.document.id).hasPreview, false);

  const thumb = await fetch(`${baseUrl}/api/documents/thumbs/${document.id}`, { headers: cookie("employee") });
  assert.equal(thumb.status, 200);
  assert.equal(thumb.headers.get("content-type"), "image/jpeg");
  assert.equal(Buffer.from(await thumb.arrayBuffer()).subarray(0, 2).toString("hex"), "ffd8");
  assert.equal((await fetch(`${baseUrl}/api/documents/thumbs/${legacy.document.id}`, { headers: cookie("employee") })).status, 404);
  assert.equal((await fetch(`${baseUrl}/api/documents/thumbs/${document.id}`)).status, 403);

  // A document saved before previews existed gets one on first request.
  const listPath = path.join(directory, "documents.json");
  const saved = JSON.parse(fs.readFileSync(listPath, "utf8"));
  fs.rmSync(path.join(directory, "document-files", document.thumb));
  fs.writeFileSync(listPath, JSON.stringify(saved.map(({ thumb: _thumb, ...item }) => item)));
  const backfilled = await fetch(`${baseUrl}/api/documents/thumbs/${document.id}`, { headers: cookie("employee") });
  assert.equal(backfilled.status, 200);
  assert.ok(JSON.parse(fs.readFileSync(listPath, "utf8")).find((item) => item.id === document.id).thumb);

  assert.equal((await fetch(`${baseUrl}/api/documents/${document.id}`, { method: "DELETE", headers: cookie("admin") })).status, 200);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(fs.existsSync(path.join(directory, "document-files", document.thumb)), false);
});

test("Admin/CEO can edit details and replace the file", async () => {
  const { document } = await (await upload("admin", "ban-dau.txt", "phien ban 1", { title: "Bản đầu", category: "Hướng dẫn", description: "Mô tả cũ" })).json();
  const edit = (role, headers, body) => fetch(`${baseUrl}/api/documents/${document.id}`, { method: "PUT", headers: { ...cookie(role), ...headers }, body });
  const details = (title, category, description) => ({ "X-Document-Title": encodeURIComponent(title), "X-Document-Category": encodeURIComponent(category), "X-Document-Description": encodeURIComponent(description) });

  assert.equal((await edit("employee", details("Hack", "Khác", ""))).status, 403);
  assert.equal((await edit("admin", details("", "Khác", ""))).status, 400);

  const renamed = await edit("admin", details("Bản đã sửa", "Biểu mẫu", ""));
  assert.equal(renamed.status, 200);
  const afterRename = (await renamed.json()).document;
  assert.equal(afterRename.title, "Bản đã sửa");
  assert.equal(afterRename.category, "Biểu mẫu");
  assert.equal(afterRename.description, undefined);
  assert.equal(afterRename.file, document.file);

  const replaced = await edit("admin", { ...details("Bản đã sửa", "Biểu mẫu", "Có file mới"), "X-File-Name": encodeURIComponent("ban-moi.csv"), "Content-Type": "text/csv" }, "a,b\n1,2");
  assert.equal(replaced.status, 200);
  const afterReplace = (await replaced.json()).document;
  assert.notEqual(afterReplace.file, document.file);
  assert.equal(afterReplace.name, "ban-moi.csv");
  assert.equal(afterReplace.createdAt, document.createdAt);
  assert.equal(await (await fetch(`${baseUrl}/api/documents/files/${afterReplace.file}`, { headers: cookie("employee") })).text(), "a,b\n1,2");
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(fs.existsSync(path.join(directory, "document-files", document.file)), false);

  assert.equal((await edit("admin", { ...details("X", "Khác", ""), "X-File-Name": encodeURIComponent("bad.exe") }, "MZ")).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/documents/khong-co`, { method: "PUT", headers: { ...cookie("admin"), ...details("X", "Khác", "") } })).status, 404);
});

test("the server module and the library data are not served as static files", async () => {
  assert.notEqual((await fetch(`${baseUrl}/documents.js`, { headers: cookie("admin") })).status, 200);
  assert.notEqual((await fetch(`${baseUrl}/documents.json`, { headers: cookie("admin") })).status, 200);
  assert.equal((await fetch(`${baseUrl}/document-library.js`, { headers: cookie("admin") })).status, 200);
  assert.equal((await fetch(`${baseUrl}/documents.html`, { headers: cookie("employee") })).status, 200);
});
