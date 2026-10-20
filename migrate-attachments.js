const fs = require("node:fs");
const path = require("node:path");
const { createAttachmentStore } = require("./proposal-attachments");

const dataDirectory = process.env.DATA_DIR || (process.env.RENDER ? "/var/data" : process.cwd());
const proposalsPath = path.join(dataDirectory, "proposals.json");

try {
  const moved = createAttachmentStore(dataDirectory).migrateFile(proposalsPath);
  const size = fs.existsSync(proposalsPath) ? (fs.statSync(proposalsPath).size / 1048576).toFixed(2) : "0";
  console.log(`Attachment migration: moved ${moved} proposal(s); proposals.json is now ${size}MB.`);
} catch (error) {
  console.error("Attachment migration failed:", error.message);
}
