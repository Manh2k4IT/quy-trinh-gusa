const fs = require("node:fs");
const path = require("node:path");

const FIELDS = { payment: "paymentFileData", late: "latePhotoData" };
const ID_PATTERN = /^[A-Za-z0-9-]{1,80}$/;

function createAttachmentStore(dataDirectory) {
  const directory = path.join(dataDirectory, "attachments");

  function filePath(id, kind) {
    if (!ID_PATTERN.test(String(id)) || !FIELDS[kind]) return null;
    return path.join(directory, `${id}.${kind}.txt`);
  }

  function save(id, kind, dataUrl) {
    const target = filePath(id, kind);
    if (!target || typeof dataUrl !== "string" || !dataUrl) return false;
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(target, dataUrl);
    return true;
  }

  function read(id, kind) {
    const target = filePath(id, kind);
    try { return target ? fs.readFileSync(target, "utf8") : ""; } catch { return ""; }
  }

  // Moves inline base64 attachments out of a proposal and returns the lightweight copy.
  function externalize(proposal) {
    let changed = false;
    const light = { ...proposal };
    for (const [kind, field] of Object.entries(FIELDS)) {
      const value = light[field];
      if (typeof value === "string" && value.startsWith("data:")) {
        if (!save(light.id, kind, value)) continue;
        light[`has${kind === "payment" ? "PaymentFile" : "LatePhoto"}`] = true;
        delete light[field];
        changed = true;
      }
    }
    return { proposal: light, changed };
  }

  function migrateFile(proposalsPath) {
    let raw;
    try { raw = fs.readFileSync(proposalsPath, "utf8"); } catch { return 0; }
    if (!raw.includes('"paymentFileData": "data:') && !raw.includes('"latePhotoData": "data:')) return 0;
    const list = JSON.parse(raw);
    raw = null;
    if (!Array.isArray(list)) return 0;
    let moved = 0;
    const next = list.map((item) => {
      const { proposal, changed } = externalize(item);
      if (changed) moved += 1;
      return proposal;
    });
    if (moved) {
      fs.writeFileSync(`${proposalsPath}.tmp`, JSON.stringify(next, null, 2));
      fs.renameSync(`${proposalsPath}.tmp`, proposalsPath);
    }
    return moved;
  }

  // Public shape for API responses: attachment fields become same-origin URLs.
  function withUrls(proposal) {
    const result = { ...proposal };
    if (proposal.hasPaymentFile) result.paymentFileData = `/api/proposals/${proposal.id}/attachment/payment`;
    if (proposal.hasLatePhoto) result.latePhotoData = `/api/proposals/${proposal.id}/attachment/late`;
    return result;
  }

  // Full shape for document/Zalo rendering: reads the stored data back in.
  function withData(proposal) {
    const result = { ...proposal };
    if (proposal.hasPaymentFile) result.paymentFileData = read(proposal.id, "payment");
    if (proposal.hasLatePhoto) result.latePhotoData = read(proposal.id, "late");
    return result;
  }

  return { save, read, externalize, migrateFile, withUrls, withData, FIELDS };
}

module.exports = { createAttachmentStore };
