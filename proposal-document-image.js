const MAX_IMAGE_BYTES = 1024 * 1024;
const MAX_PAGES = 3;
const SCALES = [2, 1.6, 1.3, 1];

async function renderPdfPages(pdfBuffer) {
  const mupdf = await import("mupdf");
  const document = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
  const pages = [];
  const pageCount = Math.min(document.countPages(), MAX_PAGES);
  for (let index = 0; index < pageCount; index += 1) {
    const page = document.loadPage(index);
    // Giảm dần độ phân giải cho tới khi ảnh vừa giới hạn 1MB của Zalo.
    for (const scale of SCALES) {
      const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
      const image = Buffer.from(pixmap.asJPEG(85, false));
      if (image.length <= MAX_IMAGE_BYTES || scale === SCALES.at(-1)) {
        if (image.length <= MAX_IMAGE_BYTES) pages.push(image);
        break;
      }
    }
  }
  return pages;
}

// Render in a child process so a memory spike cannot crash the web server.
function renderProposalPages(proposal, { timeoutMs = 60000 } = {}) {
  const { fork } = require("node:child_process");
  const path = require("node:path");
  const { latePhotoData, paymentFileData, ...documentFields } = proposal;
  return new Promise((resolve, reject) => {
    const child = fork(path.join(__dirname, "proposal-image-worker.js"), [], { execArgv: ["--max-old-space-size=192"], stdio: ["ignore", "inherit", "inherit", "ipc"] });
    let settled = false;
    const finish = (error, pages) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!child.killed) child.kill();
      if (error) reject(error); else resolve(pages);
    };
    const timer = setTimeout(() => finish(new Error("Tạo ảnh đơn quá thời gian cho phép.")), timeoutMs);
    child.once("message", (message) => message.error
      ? finish(new Error(message.error))
      : finish(null, message.pages.map((page) => Buffer.from(page, "base64"))));
    child.once("error", finish);
    child.once("exit", (code, signal) => finish(new Error(`Tiến trình tạo ảnh đơn dừng đột ngột (mã ${code ?? signal}).`)));
    child.send(documentFields);
  });
}

module.exports = { renderPdfPages, renderProposalPages };
