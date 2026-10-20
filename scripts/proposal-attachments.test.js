const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createAttachmentStore } = require("../proposal-attachments");

test("migrates inline attachments out of proposals.json", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attach-"));
  const proposalsPath = path.join(dir, "proposals.json");
  const photo = `data:image/png;base64,${"A".repeat(5000)}`;
  fs.writeFileSync(proposalsPath, JSON.stringify([{ id: "p1", type: "late", latePhotoData: photo }, { id: "p2", type: "leave" }], null, 2));
  const store = createAttachmentStore(dir);
  assert.equal(store.migrateFile(proposalsPath), 1);
  const saved = JSON.parse(fs.readFileSync(proposalsPath, "utf8"));
  assert.equal(saved[0].latePhotoData, undefined);
  assert.equal(saved[0].hasLatePhoto, true);
  assert.ok(fs.statSync(proposalsPath).size < 1000);
  assert.equal(store.read("p1", "late"), photo);
  assert.equal(store.withUrls(saved[0]).latePhotoData, "/api/proposals/p1/attachment/late");
  assert.equal(store.withData(saved[0]).latePhotoData, photo);
  assert.equal(store.migrateFile(proposalsPath), 0);
  assert.equal(store.read("../x", "late"), "");
});
