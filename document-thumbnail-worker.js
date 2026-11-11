// Renders the first page of a library document to a small JPEG. Runs in a child process so a large
// or malformed file cannot exhaust the web server's memory.
const fs = require("node:fs");

const THUMB_WIDTH = 480;

process.once("message", async ({ source, target, type }) => {
  try {
    const mupdf = await import("mupdf");
    const document = mupdf.Document.openDocument(fs.readFileSync(source), type);
    if (document.countPages() < 1) throw new Error("Tài liệu không có trang nào.");
    const page = document.loadPage(0);
    const [x0, , x1] = page.getBounds();
    const scale = Math.min(2, Math.max(0.1, THUMB_WIDTH / Math.max(1, x1 - x0)));
    const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
    fs.writeFileSync(target, Buffer.from(pixmap.asJPEG(80, false)));
    process.send({ ok: true }, () => process.exit(0));
  } catch (error) {
    process.send({ error: error.message }, () => process.exit(1));
  }
});
