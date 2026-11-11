// Company document library: Admin/CEO upload files into categories; every active user can browse and download them.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const fileTypes = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
};
const storedFilePattern = /^[\w-]+\.(pdf|docx?|xlsx?|pptx?|txt|csv|jpe?g|png|webp|gif|zip|rar|7z|mp4|mp3)$/;
const inlineExtensions = /^(pdf|jpe?g|png|webp|gif|mp4|mp3)$/;
const FILE_LIMIT = 50 * 1024 * 1024;
// Formats MuPDF can render a first-page preview of (legacy .doc/.xls/.ppt, archives and media cannot).
const thumbnailTypes = {
  pdf: "application/pdf",
  docx: fileTypes.docx,
  xlsx: fileTypes.xlsx,
  pptx: fileTypes.pptx,
  txt: "text/plain",
  csv: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
};
const thumbnailFor = (file) => file.replace(/\.[^.]+$/, "-thumb.jpg");

// Renders in a child process with its own memory cap; resolves false when the file has no preview.
function renderThumbnail(source, target, extension, { timeoutMs = 45000 } = {}) {
  const type = thumbnailTypes[extension];
  if (!type) return Promise.resolve(false);
  const { fork } = require("node:child_process");
  return new Promise((resolve) => {
    const child = fork(path.join(__dirname, "document-thumbnail-worker.js"), [], { execArgv: ["--max-old-space-size=192"], stdio: ["ignore", "inherit", "inherit", "ipc"] });
    let settled = false;
    const finish = (ok, reason) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!child.killed) child.kill();
      if (!ok) {
        if (reason) console.warn(`Document thumbnail skipped (${extension}): ${reason}`);
        fs.rm(target, { force: true }, () => {});
      }
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false, "timeout"), timeoutMs);
    child.once("message", (message) => finish(Boolean(message.ok) && fs.existsSync(target), message.error));
    child.once("error", (error) => finish(false, error.message));
    child.once("exit", (code) => finish(false, `worker exited (${code})`));
    child.send({ source, target, type });
  });
}

function createDocuments({ dataPath, getCurrentUser, isManagementUser, sendJson, send, getUserKey }) {
  const listPath = dataPath("documents.json");
  const fileDirectory = () => dataPath("document-files");
  const getDocuments = () => {
    try {
      const saved = JSON.parse(fs.readFileSync(listPath, "utf8"));
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      if (error.code !== "ENOENT") console.error("Documents read failed:", error.message);
      return [];
    }
  };
  const saveDocuments = (documents) => {
    fs.writeFileSync(`${listPath}.tmp`, JSON.stringify(documents, null, 2));
    fs.renameSync(`${listPath}.tmp`, listPath);
  };
  const header = (req, name, limit) => {
    let value = "";
    try { value = decodeURIComponent(String(req.headers[name] || "")); } catch {}
    return value.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, limit);
  };
  const isActive = (user) => user && user.status === "active";

  function list(req, res) {
    const currentUser = getCurrentUser(req);
    if (!isActive(currentUser)) return send(res, 403, "Forbidden");
    const documents = getDocuments().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map(({ thumbFailed, ...item }) => ({ ...item, hasPreview: Boolean(item.thumb) || (!thumbFailed && Boolean(thumbnailTypes[path.extname(item.file || "").slice(1).toLowerCase()])) }));
    sendJson(res, 200, { documents, canManage: isManagementUser(currentUser) });
  }

  // Streams the request body into a new stored file and renders its preview.
  // Throws { status, message } when the file is rejected.
  async function receiveFile(req) {
    const name = path.basename(header(req, "x-file-name", 180).replace(/\\/g, "/")).replace(/["<>|*?:]/g, "").trim();
    const extension = path.extname(name).slice(1).toLowerCase();
    const reject = (status, message) => Object.assign(new Error(message), { status });
    if (!name || !Object.hasOwn(fileTypes, extension)) throw reject(400, "Định dạng file chưa được hỗ trợ (PDF, Word, Excel, PowerPoint, TXT, CSV, ảnh, ZIP, RAR, 7Z, MP4, MP3).");
    if (Number(req.headers["content-length"] || 0) > FILE_LIMIT) throw reject(413, "File quá lớn (tối đa 50MB).");
    const file = `${crypto.randomUUID()}.${extension}`;
    const target = path.join(fileDirectory(), file);
    fs.mkdirSync(fileDirectory(), { recursive: true });
    const output = fs.createWriteStream(target);
    let writeError = null;
    output.on("error", (error) => { writeError = error; });
    let size = 0;
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > FILE_LIMIT) throw reject(413, "File quá lớn (tối đa 50MB).");
        if (writeError) throw writeError;
        if (!output.write(chunk)) await new Promise((resolve) => { output.once("drain", resolve); output.once("error", resolve); });
      }
      await new Promise((resolve, done) => output.end((error) => (error ? done(error) : resolve())));
    } catch (error) {
      output.destroy();
      fs.rm(target, { force: true }, () => {});
      throw error.status ? error : reject(500, "Không lưu được file.");
    }
    if (!size) {
      fs.rm(target, { force: true }, () => {});
      throw reject(400, "File rỗng.");
    }
    const thumb = thumbnailFor(file);
    const hasThumb = await renderThumbnail(target, path.join(fileDirectory(), thumb), extension);
    return { file, name, size, ...(hasThumb ? { thumb } : thumbnailTypes[extension] ? { thumbFailed: true } : {}) };
  }
  const removeStoredFile = (file) => {
    if (!storedFilePattern.test(file || "")) return;
    fs.rm(path.join(fileDirectory(), file), { force: true }, () => {});
    fs.rm(path.join(fileDirectory(), thumbnailFor(file)), { force: true }, () => {});
  };

  // The file is the request body; its name and details travel in headers so one request creates the entry.
  async function create(req, res) {
    const currentUser = getCurrentUser(req);
    if (!isActive(currentUser) || !isManagementUser(currentUser)) return send(res, 403, "Chỉ Admin/CEO được thêm tài liệu.");
    let stored;
    try {
      stored = await receiveFile(req);
    } catch (error) {
      return send(res, error.status || 500, error.message);
    }
    const document = {
      id: crypto.randomUUID(),
      title: header(req, "x-document-title", 150) || stored.name.replace(/\.[^.]+$/, ""),
      category: header(req, "x-document-category", 60) || "Khác",
      ...(header(req, "x-document-description", 500) ? { description: header(req, "x-document-description", 500) } : {}),
      ...stored,
      uploadedBy: getUserKey(currentUser),
      uploaderName: currentUser.name || currentUser.email || "",
      createdAt: new Date().toISOString(),
    };
    saveDocuments([document, ...getDocuments()]);
    sendJson(res, 201, { document });
  }

  // Edits the details; a request carrying X-File-Name also replaces the file (the old one is deleted).
  async function update(req, res, id) {
    const currentUser = getCurrentUser(req);
    if (!isActive(currentUser) || !isManagementUser(currentUser)) return send(res, 403, "Chỉ Admin/CEO được sửa tài liệu.");
    const existing = getDocuments().find((item) => item.id === id);
    if (!existing) {
      req.resume();
      return send(res, 404, "Không tìm thấy tài liệu.");
    }
    const title = header(req, "x-document-title", 150);
    if (!title) {
      req.resume();
      return send(res, 400, "Vui lòng nhập tên tài liệu.");
    }
    let stored = null;
    if (req.headers["x-file-name"]) {
      try {
        stored = await receiveFile(req);
      } catch (error) {
        return send(res, error.status || 500, error.message);
      }
    } else {
      for await (const _chunk of req) { /* no new file: ignore any body */ }
    }
    const description = header(req, "x-document-description", 500);
    let updated = null;
    saveDocuments(getDocuments().map((item) => {
      if (item.id !== id) return item;
      const { description: _oldDescription, ...rest } = item;
      const base = stored ? (({ thumb: _thumb, thumbFailed: _failed, ...keep }) => keep)(rest) : rest;
      updated = {
        ...base,
        title,
        category: header(req, "x-document-category", 60) || "Khác",
        ...(description ? { description } : {}),
        ...(stored || {}),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name || currentUser.email || "",
      };
      return updated;
    }));
    if (!updated) {
      if (stored) removeStoredFile(stored.file);
      return send(res, 404, "Không tìm thấy tài liệu.");
    }
    if (stored) removeStoredFile(existing.file);
    sendJson(res, 200, { document: updated });
  }

  function remove(req, res, id) {
    const currentUser = getCurrentUser(req);
    if (!isActive(currentUser) || !isManagementUser(currentUser)) return send(res, 403, "Chỉ Admin/CEO được xóa tài liệu.");
    const documents = getDocuments();
    const document = documents.find((item) => item.id === id);
    if (!document) return send(res, 404, "Không tìm thấy tài liệu.");
    saveDocuments(documents.filter((item) => item.id !== id));
    removeStoredFile(document.file);
    sendJson(res, 200, { deleted: true });
  }

  function serveFile(req, res, file) {
    const currentUser = getCurrentUser(req);
    if (!isActive(currentUser)) return send(res, 403, "Forbidden");
    if (!storedFilePattern.test(file)) return send(res, 404, "Not found");
    const document = getDocuments().find((item) => item.file === file);
    const location = path.join(fileDirectory(), file);
    if (!document || !fs.existsSync(location)) return send(res, 404, "Not found");
    const extension = path.extname(file).slice(1).toLowerCase();
    const inline = inlineExtensions.test(extension) && new URL(req.url, "http://localhost").searchParams.get("download") !== "1";
    const name = document.name || file;
    res.writeHead(200, {
      "Content-Type": fileTypes[extension] || "application/octet-stream",
      "Content-Length": fs.statSync(location).size,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });
    fs.createReadStream(location).pipe(res);
  }

  const pendingThumbnails = new Map();
  async function serveThumbnail(req, res, id) {
    const currentUser = getCurrentUser(req);
    if (!isActive(currentUser)) return send(res, 403, "Forbidden");
    let document = getDocuments().find((item) => item.id === id);
    if (!document || !storedFilePattern.test(document.file || "")) return send(res, 404, "Not found");
    const thumb = thumbnailFor(document.file);
    const location = path.join(fileDirectory(), thumb);
    if (!document.thumb && !document.thumbFailed) {
      if (!pendingThumbnails.has(id)) {
        const extension = path.extname(document.file).slice(1).toLowerCase();
        pendingThumbnails.set(id, renderThumbnail(path.join(fileDirectory(), document.file), location, extension).then((ok) => {
          saveDocuments(getDocuments().map((item) => (item.id === id ? { ...item, ...(ok ? { thumb } : { thumbFailed: true }) } : item)));
          return ok;
        }).finally(() => pendingThumbnails.delete(id)));
      }
      await pendingThumbnails.get(id);
      document = getDocuments().find((item) => item.id === id);
    }
    if (!document?.thumb || !fs.existsSync(location)) return send(res, 404, "Not found");
    res.writeHead(200, { "Content-Type": "image/jpeg", "Content-Length": fs.statSync(location).size, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" });
    fs.createReadStream(location).pipe(res);
  }

  // Returns true when the request was a document-library API call.
  async function handle(req, res) {
    const pathname = req.url.split("?")[0];
    if (pathname === "/api/documents" && req.method === "GET") { list(req, res); return true; }
    if (pathname === "/api/documents" && req.method === "POST") { await create(req, res); return true; }
    if (pathname.startsWith("/api/documents/thumbs/") && req.method === "GET") { await serveThumbnail(req, res, decodeURIComponent(pathname.slice("/api/documents/thumbs/".length))); return true; }
    if (pathname.startsWith("/api/documents/files/") && req.method === "GET") { serveFile(req, res, decodeURIComponent(pathname.slice("/api/documents/files/".length))); return true; }
    if (/^\/api\/documents\/[\w-]+$/.test(pathname) && req.method === "PUT") { await update(req, res, pathname.slice("/api/documents/".length)); return true; }
    if (pathname.startsWith("/api/documents/") && req.method === "DELETE") { remove(req, res, decodeURIComponent(pathname.slice("/api/documents/".length))); return true; }
    return false;
  }

  return { handle, dataFiles: ["documents.json", "documents.json.tmp"] };
}

module.exports = { createDocuments };
