// Turns a proposal's supporting document (photo or PDF) into JPEG pages small enough for Zalo (1MB each).
// Runs in a child process so a large photo cannot exhaust the web server's memory.
const MAX_IMAGE_BYTES = 1024 * 1024;
const MAX_PAGES = 3;
const MAX_EDGE = 1600;

process.once("message", async ({ base64, mime }) => {
  try {
    const mupdf = await import("mupdf");
    const document = mupdf.Document.openDocument(Buffer.from(base64, "base64"), mime);
    const pages = [];
    for (let index = 0; index < Math.min(document.countPages(), MAX_PAGES); index += 1) {
      const page = document.loadPage(index);
      const [x0, y0, x1, y1] = page.getBounds();
      // Fit the longest edge to MAX_EDGE, then shrink until the JPEG fits Zalo's limit.
      let scale = Math.min(2, MAX_EDGE / Math.max(1, x1 - x0, y1 - y0));
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
        const image = Buffer.from(pixmap.asJPEG(attempt < 2 ? 85 : 72, false));
        if (image.length <= MAX_IMAGE_BYTES) {
          pages.push(image.toString("base64"));
          break;
        }
        scale *= 0.8;
      }
    }
    process.send({ pages }, () => process.exit(0));
  } catch (error) {
    process.send({ error: error.message }, () => process.exit(1));
  }
});
