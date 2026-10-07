const crypto = require("node:crypto");

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}

function reportItem(id, data) {
  return { id, version: crypto.createHash("sha256").update(JSON.stringify(canonicalValue(data))).digest("hex") };
}

function proposalReportItems(proposals) {
  return proposals.map((proposal) => reportItem(proposal.id, proposal));
}

function attendanceReportItems(activeUsers, attendance, proposals) {
  const reports = { online: [], late: [], overview: [] };
  const lateReviews = new Map();
  for (const proposal of proposals) {
    if (proposal.type !== "late" || !["approved", "rejected"].includes(proposal.status)) continue;
    const key = `${proposal.userId}:${proposal.date}`;
    lateReviews.set(key, proposal.status);
  }
  for (const user of activeUsers) {
    for (const [date, record] of Object.entries(attendance[user.id] || {})) {
      const id = `${user.id}:${date}`;
      const data = { record, name: user.name || user.email, email: user.email };
      reports.overview.push(reportItem(id, data));
      if (record.workMode === "online" || record.onlineProof) reports.online.push(reportItem(id, data));
      if (record.late) reports.late.push(reportItem(id, { ...data, reviewStatus: lateReviews.get(id) || "" }));
    }
  }
  return reports;
}

module.exports = { proposalReportItems, attendanceReportItems };
