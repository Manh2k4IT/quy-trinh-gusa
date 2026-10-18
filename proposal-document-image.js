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

module.exports = { renderPdfPages };
