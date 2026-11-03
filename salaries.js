// Employee salaries (Lương nhân viên): one row per Gmail account that has signed in, kept in sync with the user list.
// Admin/CEO only — salaries are never sent to anyone else.
const fs = require("fs");

const maxAmount = 10_000_000_000;

function createSalaries({ dataPath, users, getCurrentUser, isManagementUser, sendJson, send, now = () => Date.now() }) {
  const salariesPath = dataPath("salaries.json");

  const readSalaries = () => {
    try {
      return JSON.parse(fs.readFileSync(salariesPath, "utf8")) || {};
    } catch (error) {
      if (error.code === "ENOENT") return {};
      throw error;
    }
  };
  const writeSalaries = (value) => {
    fs.writeFileSync(`${salariesPath}.tmp`, JSON.stringify(value, null, 2));
    fs.renameSync(`${salariesPath}.tmp`, salariesPath);
  };

  // Every active account, with its salary if one was entered; new accounts appear with empty amounts.
  function rows() {
    const salaries = readSalaries();
    return [...users.values()]
      .filter((user) => user.status === "active")
      .map((user) => {
        const saved = salaries[user.id] || {};
        return {
          userId: user.id,
          name: user.name || user.email,
          email: user.email || "",
          picture: user.picture || "",
          role: user.role || "employee",
          baseSalary: Number.isFinite(saved.baseSalary) ? saved.baseSalary : null,
          allowance: Number.isFinite(saved.allowance) ? saved.allowance : null,
          updatedAt: saved.updatedAt || null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }

  const amount = (value, label) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Math.round(Number(value));
    if (!Number.isFinite(number) || number < 0 || number > maxAmount) throw new Error(`${label} phải là số tiền từ 0 đến 10 tỷ.`);
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
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname === "/api/salaries/me" && req.method === "GET") {
      const me = getCurrentUser(req);
      if (!me || me.status !== "active") return send(res, 403, "Forbidden"), true;
      const row = rows().find((item) => item.userId === me.id) || null;
      return sendJson(res, 200, { salary: row && { baseSalary: row.baseSalary, allowance: row.allowance, updatedAt: row.updatedAt } }), true;
    }
    if (pathname !== "/api/salaries") return false;
    const user = getCurrentUser(req);
    if (!isManagementUser(user) || user.status !== "active") return send(res, 403, "Chỉ Admin/CEO được xem lương nhân viên."), true;
    try {
      if (req.method === "GET") return sendJson(res, 200, { rows: rows() }), true;
      if (req.method === "POST") {
        const payload = await readBody(req);
        const target = users.get(String(payload.userId || ""));
        if (!target || target.status !== "active") return send(res, 404, "Không tìm thấy tài khoản này."), true;
        const salaries = readSalaries();
        salaries[target.id] = {
          baseSalary: amount(payload.baseSalary, "Lương cơ bản"),
          allowance: amount(payload.allowance, "Phụ cấp"),
          updatedAt: new Date(now()).toISOString(),
          updatedBy: user.email || user.name || "",
        };
        writeSalaries(salaries);
        return sendJson(res, 200, { row: rows().find((row) => row.userId === target.id) }), true;
      }
      return send(res, 405, "Method Not Allowed"), true;
    } catch (error) {
      return send(res, error.status || 400, error.message || "Không lưu được."), true;
    }
  }

  return { handle, rows };
}

module.exports = { createSalaries };
