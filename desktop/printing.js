const { BrowserWindow, dialog, shell } = require("electron");
const fs = require("node:fs");

async function previewDocument(owner, html) {
  if (typeof html !== "string" || !html.trim() || Buffer.byteLength(html, "utf8") > 10 * 1024 * 1024) {
    throw new Error("Nội dung bản in không hợp lệ hoặc vượt quá 10 MB.");
  }
  const { canceled, filePath } = await dialog.showSaveDialog(owner, {
    title: "Lưu PDF để xem bản in",
    defaultPath: "Gusa-Don.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (canceled || !filePath) return { canceled: true };

  const preview = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false },
  });
  try {
    preview.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    const policy = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; font-src data:;">';
    await preview.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(policy + html)}`);
    const pdf = await preview.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: "A4" });
    await fs.promises.writeFile(filePath, pdf);
    const error = await shell.openPath(filePath);
    if (error) throw new Error(`PDF đã lưu nhưng không mở được: ${error}`);
    return { canceled: false };
  } finally {
    preview.destroy();
  }
}

module.exports = { previewDocument };
