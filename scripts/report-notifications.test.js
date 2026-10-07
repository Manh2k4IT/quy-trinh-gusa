const test = require("node:test");
const assert = require("node:assert/strict");
const { proposalReportItems, attendanceReportItems } = require("../report-notification-data");

test("proposal versions detect edits and reviews without depending on property order", () => {
  const proposal = { id: "p1", type: "leave", status: "pending", reason: "initial" };
  const item = proposalReportItems([proposal])[0];
  assert.deepEqual(proposalReportItems([{ reason: "initial", status: "pending", type: "leave", id: "p1" }])[0], item);
  assert.notEqual(proposalReportItems([{ ...proposal, status: "approved" }])[0].version, item.version);
  assert.notEqual(proposalReportItems([{ ...proposal, reason: "edited" }])[0].version, item.version);
  assert.equal(item.id, "p1");
});

test("attendance entries are grouped by report across all dates", () => {
  const users = [{ id: "u1", name: "User" }];
  const attendance = { u1: {
    "2026-09-01": { status: "online", workMode: "online" },
    "2026-10-01": { workMode: "office", late: true },
    "2026-10-02": { workMode: "online", late: true },
  }, hiddenUser: { "2026-10-01": { workMode: "online" } } };
  const reports = attendanceReportItems(users, attendance, []);
  assert.equal(reports.overview.length, 3);
  assert.equal(reports.online.length, 2);
  assert.equal(reports.late.length, 2);
  assert.equal(reports.online[0].id, "u1:2026-09-01");
});

test("check-out and late review changes update report versions", () => {
  const users = [{ id: "u1", name: "User" }];
  const record = { workMode: "online", late: true, checkIn: "2026-10-01T03:00:00Z" };
  const attendance = { u1: { "2026-10-01": record } };
  const before = attendanceReportItems(users, attendance, []);
  const reviewed = attendanceReportItems(users, attendance, [{ type: "late", userId: "u1", date: "2026-10-01", status: "approved" }]);
  assert.notEqual(reviewed.late[0].version, before.late[0].version);
  assert.equal(reviewed.online[0].version, before.online[0].version);
  record.checkOut = "2026-10-01T11:00:00Z";
  const after = attendanceReportItems(users, attendance, []);
  for (const key of ["online", "late", "overview"]) assert.notEqual(after[key][0].version, before[key][0].version);
});
