// Employee salaries (Lương nhân viên): one row per Gmail account that has signed in, kept in sync with the user list.
// Amounts are kept per month; a month with nothing entered carries the latest earlier month forward.
// Admin/CEO only — everyone else can read just their own salary.
const fs = require("fs");

const maxAmount = 10_000_000_000;
// Salary columns, in table order. Deductions are subtracted from the total income.
const fields = [
  { key: "baseSalary", label: "P1" },
  { key: "allowance", label: "Phụ cấp" },
  { key: "p3", label: "P3 định mức" },
  { key: "pdca", label: "Thành viên Ban dự án PDCA" },
  { key: "insurance", label: "Khấu trừ BHXH", deduction: true },
];
// P3 is paid by the KPI result: P3 thực nhận = P3 định mức × % KPI. The KPI % comes from the KPI reports
// unless Admin/CEO typed one for the month; with no KPI at all it counts as 100%.
// Each KPI item caps itself (100%, or more when it may exceed its target); this only guards against typos.
const kpiCap = 200;
const appliedKpi = (entered, auto) => (entered !== null ? entered : auto !== null ? Math.min(auto, kpiCap) : 100);
const totalOf = (amounts) => (fields.some((field) => amounts[field.key] !== null)
  ? fields.reduce((sum, field) => sum + (field.key === "p3" ? amounts.p3Paid || 0 : amounts[field.key] || 0) * (field.deduction ? -1 : 1), 0)
  : null);
const monthPattern = /^\d{4}-\d{2}$/;

function createSalaries({ dataPath, users, getCurrentUser, isManagementUser, sendJson, send, now = () => Date.now(), currentMonth, kpiPercentFor = () => null }) {
  const salariesPath = dataPath("salaries.json");
  const thisMonth = () => (currentMonth ? currentMonth() : new Date(now()).toISOString().slice(0, 7));

  // File shape: { months: { "YYYY-MM": { userId: entry } }, base: { userId: entry } }.
  // Older files were a flat { userId: entry } map without months.
  const readSalaries = () => {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(salariesPath, "utf8")) || {};
    } catch (error) {
      if (error.code === "ENOENT") return { months: {}, base: {} };
      throw error;
    }
    if (data.months && typeof data.months === "object") return { months: data.months, base: data.base || {} };
    // An older entry counts from the month it was entered; one without a date applies to every month.
    const months = {};
    const base = {};
    for (const [userId, entry] of Object.entries(data)) {
      const month = typeof entry?.updatedAt === "string" && monthPattern.test(entry.updatedAt.slice(0, 7)) ? entry.updatedAt.slice(0, 7) : null;
      if (month) (months[month] ||= {})[userId] = entry;
      else base[userId] = entry;
    }
    return { months, base };
  };
  const writeSalaries = (value) => {
    fs.writeFileSync(`${salariesPath}.tmp`, JSON.stringify(value, null, 2));
    fs.renameSync(`${salariesPath}.tmp`, salariesPath);
  };

  // The amounts that apply to a person in a month, and the month they were entered for (null for the old base).
  function resolve(data, userId, month) {
    const months = Object.keys(data.months).filter((key) => key <= month && data.months[key][userId]).sort();
    const from = months.pop();
    if (from) return { entry: data.months[from][userId], from };
    return data.base[userId] ? { entry: data.base[userId], from: null } : { entry: null, from: null };
  }

  function rows(month) {
    const data = readSalaries();
    return [...users.values()]
      .filter((user) => user.status === "active")
      .map((user) => {
        const { entry, from } = resolve(data, user.id, month);
        const saved = entry || {};
        return {
          userId: user.id,
          name: user.name || user.email,
          email: user.email || "",
          picture: user.picture || "",
          role: user.role || "employee",
          ...Object.fromEntries(fields.map((field) => [field.key, Number.isFinite(saved[field.key]) ? saved[field.key] : null])),
          // A typed KPI % belongs to its own month only; it is not carried forward.
          kpiPercent: from === month && Number.isFinite(saved.kpiPercent) ? saved.kpiPercent : null,
          ...(() => { const kpi = kpiPercentFor(user.id, month); const percent = kpi && typeof kpi === "object" ? kpi.percent : kpi ?? null; return { kpiAuto: percent, kpiApproved: kpi && typeof kpi === "object" ? kpi.approved : null }; })(),
          updatedAt: saved.updatedAt || null,
          // Set when the amounts come from an earlier month (or the old undated base) rather than this one.
          inheritedFrom: entry && from !== month ? from || "base" : null,
        };
      })
      .map((row) => {
        const kpiApplied = appliedKpi(row.kpiPercent, row.kpiAuto);
        const p3Paid = row.p3 !== null ? Math.round((row.p3 * kpiApplied) / 100) : null;
        return { ...row, kpiApplied, p3Paid, total: totalOf({ ...row, p3Paid }) };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }

  const amount = (value, label) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Math.round(Number(value));
    if (!Number.isFinite(number) || number < 0 || number > maxAmount) throw new Error(`${label} phải là số tiền từ 0 đến 10 tỷ.`);
    return number;
  };

  const percent = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Math.round(Number(value) * 10) / 10;
    if (!Number.isFinite(number) || number < 0 || number > 300) throw new Error("% KPI phải từ 0 đến 300.");
    return number;
  };

  async function readBody(req) {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 4096) throw Object.assign(new Error("Dữ liệu quá lớn."), { status: 413 });
    }
    return JSON.parse(body || "{}");
  }

  async function handle(req, res) {
    const { pathname, searchParams } = new URL(req.url, "http://localhost");
    const month = monthPattern.test(searchParams.get("month") || "") ? searchParams.get("month") : thisMonth();
    if (pathname === "/api/salaries/me" && req.method === "GET") {
      const me = getCurrentUser(req);
      if (!me || me.status !== "active") return send(res, 403, "Forbidden"), true;
      const row = rows(month).find((item) => item.userId === me.id) || null;
      // P3 waits for the KPI behind it: an unapproved KPI result is not shown, nor the total that depends on it.
      const kpiPending = Boolean(row && row.p3 !== null && row.kpiPercent === null && row.kpiAuto !== null && row.kpiApproved === false);
      return sendJson(res, 200, { month, fields, salary: row && { ...Object.fromEntries(fields.map((field) => [field.key, row[field.key]])), kpiPending, kpiApplied: kpiPending ? null : row.kpiApplied, kpiAuto: kpiPending ? null : row.kpiAuto, kpiApproved: row.kpiApproved, p3Paid: kpiPending ? null : row.p3Paid, total: kpiPending ? null : row.total, updatedAt: row.updatedAt, inheritedFrom: row.inheritedFrom } }), true;
    }
    if (pathname !== "/api/salaries") return false;
    const user = getCurrentUser(req);
    if (!isManagementUser(user) || user.status !== "active") return send(res, 403, "Chỉ Admin/CEO được xem lương nhân viên."), true;
    try {
      if (req.method === "GET") return sendJson(res, 200, { month, fields, rows: rows(month) }), true;
      if (req.method === "POST") {
        const payload = await readBody(req);
        const target = users.get(String(payload.userId || ""));
        if (!target || target.status !== "active") return send(res, 404, "Không tìm thấy tài khoản này."), true;
        const forMonth = monthPattern.test(payload.month || "") ? payload.month : thisMonth();
        const data = readSalaries();
        data.months[forMonth] ||= {};
        data.months[forMonth][target.id] = {
          ...Object.fromEntries(fields.map((field) => [field.key, amount(payload[field.key], field.label)])),
          kpiPercent: percent(payload.kpiPercent),
          updatedAt: new Date(now()).toISOString(),
          updatedBy: user.email || user.name || "",
        };
        writeSalaries(data);
        return sendJson(res, 200, { month: forMonth, row: rows(forMonth).find((row) => row.userId === target.id) }), true;
      }
      return send(res, 405, "Method Not Allowed"), true;
    } catch (error) {
      return send(res, error.status || 400, error.message || "Không lưu được."), true;
    }
  }

  return { handle, rows };
}

module.exports = { createSalaries, fields };
