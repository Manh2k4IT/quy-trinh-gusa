// Supporting documents (photos, PDFs) are converted to JPEG pages under Zalo's 1MB limit.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { fork } = require("node:child_process");
const { createProposalPdf } = require("../proposal-document-pdf");

function convert(buffer, mime) {
  return new Promise((resolve, reject) => {
    const child = fork(path.join(__dirname, "..", "evidence-image-worker.js"), [], { execArgv: ["--max-old-space-size=192"], stdio: ["ignore", "inherit", "inherit", "ipc"] });
    child.once("message", (message) => (message.error ? reject(new Error(message.error)) : resolve(message.pages.map((page) => Buffer.from(page, "base64")))));
    child.once("error", reject);
    child.send({ base64: buffer.toString("base64"), mime });
  });
}

test("a PDF becomes JPEG pages under 1MB", async () => {
  const pdf = await createProposalPdf({ id: "e1", userName: "Nguyễn Văn A", type: "half-day", date: "2026-11-20", reason: "Giấy hẹn", status: "pending" });
  const pages = await convert(pdf, "application/pdf");
  assert.ok(pages.length >= 1);
  for (const page of pages) {
    assert.equal(page.subarray(0, 2).toString("hex"), "ffd8");
    assert.ok(page.length <= 1024 * 1024);
  }
});

test("a large photo is shrunk below 1MB", async () => {
  const mupdf = await import("mupdf");
  // A noisy 3000x4000 PNG stands in for a phone photo well over 1MB.
  const width = 3000;
  const height = 4000;
  const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, width, height], false);
  const samples = pixmap.getPixels();
  let seed = 2463534242;
  for (let index = 0; index < samples.length; index += 1) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    samples[index] = seed & 255;
  }
  const png = Buffer.from(pixmap.asPNG());
  assert.ok(png.length > 1024 * 1024);
  const pages = await convert(png, "image/png");
  assert.equal(pages.length, 1);
  assert.equal(pages[0].subarray(0, 2).toString("hex"), "ffd8");
  assert.ok(pages[0].length <= 1024 * 1024);
});
