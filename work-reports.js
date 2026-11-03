const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// Work reports: Admin/CEO define templates (with a daily, weekly or monthly schedule) for
// departments, positions or people; employees fill them in with camera photos; managers follow up.
const itemTypes = ["check", "number", "text", "select", "photo", "file", "link"];
// Inputs an item can carry next to its main one, e.g. a number with a file attached.
const extraTypes = ["photo", "file", "link", "text"];
const extraLabels = { photo: "Ảnh", file: "File", link: "Link", text: "Ghi chú" };
const frequencies = ["daily", "weekly", "monthly"];
const weekdayNames = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
const maxPhotosPerItem = 6;
const maxPhotoBytes = 3 * 1024 * 1024;
const maxFilesPerItem = 3;
const maxFileBytes = 8 * 1024 * 1024;
// Documents people may attach to a "file" item, by extension.
const fileTypes = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", txt: "text/plain", csv: "text/csv", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", zip: "application/zip" };
const photoFreshnessMs = 15 * 60 * 1000;
const reminderLeadMinutes = 60;

// ---- Calendar helpers on "YYYY-MM-DD" keys (already in the company's time zone). ----
const parseDay = (key) => new Date(`${key}T00:00:00Z`);
const dayKey = (date) => date.toISOString().slice(0, 10);
const addDays = (key, days) => { const date = parseDay(key); date.setUTCDate(date.getUTCDate() + days); return dayKey(date); };
const isoWeekday = (key) => parseDay(key).getUTCDay() || 7;
const daysInMonth = (key) => new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).getUTCDate();
const shortDate = (key) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

// The reporting period a template covers on a given day, or null when it does not apply that day.
function periodOf(template, date) {
  const schedule = template.schedule || { frequency: "daily", weekdays: [1, 2, 3, 4, 5, 6, 7] };
  if ((schedule.startDate && date < schedule.startDate) || (schedule.endDate && date > schedule.endDate)) return null;
  if (schedule.frequency === "weekly") {
    const start = addDays(date, 1 - isoWeekday(date));
    const dueDate = addDays(start, (schedule.weekday || 6) - 1);
    const opensOn = schedule.openWeekday ? addDays(start, schedule.openWeekday - 1) : null;
    return { key: `W:${start}`, dueDate, label: `Tuần ${shortDate(start)} – ${shortDate(addDays(start, 6))}`, dueLabel: `${weekdayNames[schedule.weekday || 6]} ${shortDate(dueDate)}`, ...(opensOn ? { opensOn } : {}) };
  }
  if (schedule.frequency === "monthly") {
    const month = date.slice(0, 7);
    const dueDate = `${month}-${String(Math.min(schedule.monthDay || 28, daysInMonth(date))).padStart(2, "0")}`;
    const opensOn = schedule.openDay ? `${month}-${String(Math.min(schedule.openDay, daysInMonth(date))).padStart(2, "0")}` : null;
    return { key: `M:${month}`, dueDate, label: `Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`, dueLabel: `ngày ${shortDate(dueDate)}`, ...(opensOn && opensOn <= dueDate ? { opensOn } : {}) };
  }
  const weekdays = schedule.weekdays?.length ? schedule.weekdays : [1, 2, 3, 4, 5, 6, 7];
  if (!weekdays.includes(isoWeekday(date))) return null;
  return { key: `D:${date}`, dueDate: date, label: `Ngày ${shortDate(date)}`, dueLabel: "hôm nay" };
}

function createWorkReports({ dataPath, users, getCurrentUser, isManagementUser, sendJson, send, getUserKey, getLocalDateKey, getLocalMinutes, notify = async () => {}, now = () => Date.now() }) {
  const templatesPath = dataPath("work-report-templates.json");
  const reportsPath = dataPath("work-reports.json");
  const structurePath = dataPath("work-report-structure.json");
  const filesDirectory = dataPath("work-report-files");
  // Admin/CEO approve each person's KPI per template and month, or send it back for changes.
  const approvalsPath = dataPath("work-report-kpi-approvals.json");
  const text = (value, max) => String(value ?? "").trim().slice(0, max);

  const readJson = (file, fallback) => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return fallback;
      throw error;
    }
  };
  const writeJson = (file, value) => {
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2));
    fs.renameSync(`${file}.tmp`, file);
  };
  // Older templates targeted org-chart nodes and had no schedule; read them as daily with empty lists.
  const getTemplates = () => (readJson(templatesPath, []) || []).map((template) => ({
    ...template,
    targets: { departmentIds: [], positionIds: [], userIds: [], ...template.targets },
    schedule: template.schedule || { frequency: "daily", weekdays: [1, 2, 3, 4, 5, 6, 7] },
    requireBeforeCheckout: template.requireBeforeCheckout !== false,
  }));
  const getReports = () => (readJson(reportsPath, []) || []).map((report) => ({ ...report, periodKey: report.periodKey || `D:${report.date}` }));
  function getStructure() {
    const saved = readJson(structurePath, {}) || {};
    return { departments: saved.departments || [], positions: saved.positions || [], assignments: saved.assignments || {} };
  }
  const saveStructure = (structure) => writeJson(structurePath, structure);
  const activeUsers = () => [...users.values()].filter((user) => user.status === "active");

  async function readBody(req, limit) {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > limit) throw Object.assign(new Error("Dữ liệu gửi lên quá lớn."), { status: 413 });
    }
    return JSON.parse(body || "{}");
  }

  // ---- Who receives which template ----
  function matches(template, user, structure) {
    const key = getUserKey(user);
    const { departmentIds, positionIds, userIds } = template.targets;
    if (userIds.includes(key)) return true;
    const place = structure.assignments[key];
    if (!place || (!departmentIds.length && !positionIds.length)) return false;
    return (!departmentIds.length || departmentIds.includes(place.departmentId)) && (!positionIds.length || positionIds.includes(place.positionId));
  }
  const templatesFor = (user, templates = getTemplates(), structure = getStructure()) => templates.filter((template) => matches(template, user, structure));

  function placeOf(user, structure) {
    const place = structure.assignments[getUserKey(user)];
    const department = structure.departments.find((item) => item.id === place?.departmentId);
    const position = structure.positions.find((item) => item.id === place?.positionId);
    return { department: department?.name || "Chưa xếp phòng ban", title: position?.name || "" };
  }

  const deadlineMinutes = (deadline) => {
    const [hours, minutes] = String(deadline || "21:00").split(":").map(Number);
    return hours * 60 + minutes;
  };
  // First day a template counts: its "Áp dụng từ ngày" when Admin set one, otherwise the day it was created
  // (templates saved before createdAt existed start from their last save).
  const startsOn = (template) => {
    if (template.schedule?.startDate) return template.schedule.startDate;
    const since = template.createdAt || template.updatedAt;
    return since ? getLocalDateKey(new Date(since)) : null;
  };
  // Not submitted and past its deadline: still "overdue" while the period runs (a late report is accepted), "missing" once it is over.
  const unsubmittedLate = (template, period, today) => (periodOf(template, today)?.key === period.key ? "overdue" : "missing");
  const getApprovals = () => readJson(approvalsPath, {}) || {};
  const approvalKey = (userKey, templateId, month) => `${userKey}|${templateId}|${month}`;
  // The month a report counts toward: the month its period is due.
  const reportMonth = (template, report) => (periodOf(template, report.date)?.dueDate || report.date || "").slice(0, 7);
  // A decision holds until the report is changed after it; then the KPI waits for approval again.
  function approvalFor(approvals, userKey, template, month, reports) {
    const saved = approvals[approvalKey(userKey, template.id, month)];
    if (!saved) return { status: "pending" };
    const changed = reports.some((report) => report.userId === userKey && report.templateId === template.id && (report.updatedAt || report.submittedAt || "") > saved.at && reportMonth(template, report) === month);
    return changed ? { status: "pending", resubmittedAfter: saved.status } : saved;
  }
  // KPI reports sent back for changes: they can be submitted again even after their period has passed.
  function revisionDue(user, { templates, structure, reports } = {}) {
    const key = getUserKey(user);
    const approvals = getApprovals();
    const allReports = reports || getReports();
    return templatesFor(user, templates || getTemplates(), structure || getStructure()).filter((template) => template.kpi).flatMap((template) => Object.entries(approvals)
      .filter(([approval, saved]) => approval.startsWith(`${key}|${template.id}|`) && saved.status === "revision")
      .flatMap(([approval, saved]) => {
        const month = approval.split("|")[2];
        const report = allReports.filter((item) => item.userId === key && item.templateId === template.id && reportMonth(template, item) === month)
          .sort((a, b) => (b.updatedAt || b.submittedAt || "").localeCompare(a.updatedAt || a.submittedAt || ""))[0];
        if (!report || (report.updatedAt || report.submittedAt || "") > saved.at) return [];
        const period = periodOf(template, report.date);
        return period ? [{ template, period, report, revision: { note: saved.note || "", at: saved.at, by: saved.by || "" } }] : [];
      }));
  }
  // Today's reports plus the ones sent back for changes, each period once.
  function openItems(user, date = getLocalDateKey(), context = {}) {
    const items = dueToday(user, date, context);
    for (const extra of revisionDue(user, context)) {
      const same = items.find((item) => item.template.id === extra.template.id && item.period.key === extra.period.key);
      if (same) same.revision = extra.revision;
      else items.push(extra);
    }
    return items;
  }
  const isLate = (template, period, date = getLocalDateKey()) => date > period.dueDate || (date === period.dueDate && getLocalMinutes() > deadlineMinutes(template.deadline));

  // Every template that applies to the user today, with its period and this period's report.
  function dueToday(user, date = getLocalDateKey(), { templates, structure, reports } = {}) {
    const key = getUserKey(user);
    const allReports = reports || getReports();
    return templatesFor(user, templates || getTemplates(), structure || getStructure()).flatMap((template) => {
      const period = periodOf(template, date);
      if (!period) return [];
      const report = allReports.find((item) => item.userId === key && item.templateId === template.id && item.periodKey === period.key) || null;
      return [{ template, period, report }];
    });
  }

  // ---- Templates ----
  function validateTemplate(payload) {
    const name = text(payload.name, 120);
    if (!name) throw new Error("Vui lòng nhập tên mẫu báo cáo.");
    const deadline = /^([01]\d|2[0-3]):[0-5]\d$/.test(payload.deadline) ? payload.deadline : "21:00";
    const list = (values, max) => [...new Set((Array.isArray(values) ? values : []).map((value) => text(value, max)).filter(Boolean))];
    const targets = { departmentIds: list(payload.targets?.departmentIds, 80), positionIds: list(payload.targets?.positionIds, 80), userIds: list(payload.targets?.userIds, 160) };
    if (!targets.departmentIds.length && !targets.positionIds.length && !targets.userIds.length) throw new Error("Chọn ít nhất một phòng ban, vị trí hoặc nhân viên áp dụng mẫu này.");
    const input = payload.schedule || {};
    const frequency = frequencies.includes(input.frequency) ? input.frequency : "daily";
    const validDate = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : "");
    const schedule = { frequency, startDate: validDate(input.startDate), endDate: validDate(input.endDate) };
    if (schedule.startDate && schedule.endDate && schedule.endDate < schedule.startDate) throw new Error("Ngày kết thúc phải sau ngày bắt đầu.");
    if (frequency === "daily") {
      schedule.weekdays = [...new Set((Array.isArray(input.weekdays) ? input.weekdays : [1, 2, 3, 4, 5, 6, 7]).map(Number).filter((day) => day >= 1 && day <= 7))].sort();
      if (!schedule.weekdays.length) throw new Error("Chọn ít nhất một ngày trong tuần cần nộp báo cáo.");
    } else if (frequency === "weekly") {
      schedule.weekday = Math.min(7, Math.max(1, Math.round(Number(input.weekday) || 6)));
      // Optional: input opens only from this weekday; left empty the whole week is open.
      const openWeekday = Math.round(Number(input.openWeekday) || 0);
      if (openWeekday) {
        if (openWeekday < 1 || openWeekday > schedule.weekday) throw new Error("Ngày mở nhập phải trước hoặc trùng ngày hạn nộp trong tuần.");
        schedule.openWeekday = openWeekday;
      }
    } else {
      schedule.monthDay = Math.min(31, Math.max(1, Math.round(Number(input.monthDay) || 28)));
      // Optional: input opens only from this day of the month; left empty the whole month is open.
      const openDay = Math.round(Number(input.openDay) || 0);
      if (openDay) {
        if (openDay < 1 || openDay > schedule.monthDay) throw new Error("Ngày mở nhập phải trước hoặc trùng ngày hạn nộp trong tháng.");
        schedule.openDay = openDay;
      }
    }
    const items = (Array.isArray(payload.items) ? payload.items : []).slice(0, 40).map((item) => {
      const type = itemTypes.includes(item.type) ? item.type : "text";
      const label = text(item.label, 200);
      if (!label) throw new Error("Mỗi mục báo cáo cần có tên.");
      const options = type === "select" ? list(item.options, 80) : [];
      if (type === "select" && options.length < 2) throw new Error(`Mục "${label}" cần ít nhất 2 lựa chọn.`);
      return {
        id: /^[\w-]{1,40}$/.test(item.id || "") ? item.id : crypto.randomUUID().slice(0, 8),
        label,
        type,
        required: Boolean(item.required),
        ...(type === "select" ? { options } : {}),
        ...(type === "photo" ? { minPhotos: Math.max(1, Math.min(maxPhotosPerItem, Math.round(Number(item.minPhotos) || 1))) } : {}),
        ...(type === "file" ? { minFiles: Math.max(1, Math.min(maxFilesPerItem, Math.round(Number(item.minFiles) || 1))) } : {}),
        ...(type === "number" && Number(item.target) > 0 ? { target: Number(item.target) } : {}),
        ...(type === "number" && item.kpiType === "ratio" ? { kpiType: "ratio" } : {}),
        ...(type === "number" && Number(item.weight) > 0 ? { weight: Math.min(1000, Number(item.weight)) } : {}),
        // Above 100: points keep growing past the target, up to this completion rate.
        ...(type === "number" && Number(item.maxRate) > 100 ? { maxRate: Math.min(300, Number(item.maxRate)) } : {}),
        extras: [...new Map((Array.isArray(item.extras) ? item.extras : []).filter((extra) => extraTypes.includes(extra?.type) && extra.type !== type).map((extra) => [extra.type, { type: extra.type, required: Boolean(extra.required) }])).values()],
        hint: text(item.hint, 200),
      };
    });
    if (!items.length) throw new Error("Mẫu báo cáo cần ít nhất một mục.");
    return { name, deadline, requireBeforeCheckout: payload.requireBeforeCheckout !== false, kpi: payload.kpi === true, targets, schedule, items };
  }

  // ---- Reports ----
  const publicReport = (report) => report && ({
    ...report,
    answers: report.answers.map((answer) => ({
      ...answer,
      ...(answer.photos ? { photos: answer.photos.map((photo) => ({ ...photo, url: `/api/work-reports/${report.id}/photos/${photo.file}` })) } : {}),
      ...(answer.files ? { files: answer.files.map((file) => ({ ...file, url: `/api/work-reports/${report.id}/files/${file.file}` })) } : {}),
    })),
  });

  function savePhoto(reportId, itemId, index, dataUrl) {
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
    if (!match) throw new Error("Ảnh không hợp lệ. Vui lòng chụp lại.");
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > maxPhotoBytes) throw new Error("Ảnh quá lớn hoặc bị lỗi. Vui lòng chụp lại.");
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    return { file: `${reportId}-${itemId}-${index}-${sha256.slice(0, 10)}.${match[1] === "jpeg" ? "jpg" : match[1]}`, sha256, bytes };
  }

  async function submitReport(req, res, user) {
    const payload = await readBody(req, 30 * 1024 * 1024);
    const reports = getReports();
    const due = openItems(user, getLocalDateKey(), { reports });
    if (!due.length) return send(res, 404, "Hôm nay bạn không có mẫu báo cáo công việc cần nộp.");
    const entry = payload.templateId
      ? due.find((item) => item.template.id === payload.templateId && (!payload.periodKey || item.period.key === payload.periodKey))
      : due[0];
    if (!entry) return send(res, 404, "Mẫu báo cáo này không áp dụng cho bạn hôm nay.");
    const { template, period, report: existing } = entry;
    if (period.opensOn && getLocalDateKey() < period.opensOn) return send(res, 409, `Báo cáo "${template.name}" mở nhập từ ngày ${shortDate(period.opensOn)}.`);
    const reportId = existing?.id || crypto.randomUUID();
    const answersIn = new Map((Array.isArray(payload.answers) ? payload.answers : []).map((answer) => [answer.itemId, answer]));
    const usedHashes = new Set(reports.filter((report) => report.id !== reportId).flatMap((report) => report.answers.flatMap((answer) => (answer.photos || []).map((photo) => photo.sha256))));
    const keptPhotos = new Map((existing?.answers || []).flatMap((answer) => [...(answer.photos || []), ...(answer.files || [])].map((photo) => [photo.file, photo])));
    const newFiles = [];
    const answers = [];
    // Each item has a main input plus optional extras (photo, file, link, note); each part is checked on its own.
    const readPart = (item, answer, type, required, isExtra) => {
      const what = isExtra ? `${extraLabels[type].toLowerCase()} kèm theo mục "${item.label}"` : `mục "${item.label}"`;
      if (type === "check") {
        const checked = answer.checked === true;
        if (required && !checked) throw new Error(`Vui lòng hoàn thành ${what}.`);
        return { checked };
      }
      if (type === "number") {
        const hasValue = answer.value !== undefined && answer.value !== null && answer.value !== "";
        const value = Number(answer.value);
        if (hasValue && !Number.isFinite(value)) throw new Error(`Mục "${item.label}" phải là số.`);
        if (required && !hasValue) throw new Error(`Vui lòng nhập ${what}.`);
        if (item.kpiType === "ratio" && !isExtra) {
          const hasTotal = answer.total !== undefined && answer.total !== null && answer.total !== "";
          const total = Number(answer.total);
          if (hasTotal && !(Number.isFinite(total) && total > 0)) throw new Error(`"Tổng" của mục "${item.label}" phải là số lớn hơn 0.`);
          if (hasValue && !hasTotal) throw new Error(`Vui lòng nhập "Tổng" cho mục "${item.label}".`);
          if (hasTotal && hasValue && value > total) throw new Error(`Giá trị của mục "${item.label}" không được lớn hơn "Tổng".`);
          return { value: hasValue ? value : null, total: hasTotal ? total : null };
        }
        return { value: hasValue ? value : null };
      }
      if (type === "select") {
        const value = text(answer.value, 80);
        if (value && !item.options.includes(value)) throw new Error(`Lựa chọn của mục "${item.label}" không hợp lệ.`);
        if (required && !value) throw new Error(`Vui lòng chọn ${what}.`);
        return { value };
      }
      if (type === "text") {
        const key = isExtra ? "note" : "value";
        const value = text(answer[key], 2000);
        if (required && !value) throw new Error(`Vui lòng nhập ${what}.`);
        return { [key]: value };
      }
      if (type === "link") {
        const link = text(answer.link, 500);
        let valid = false;
        try { valid = ["http:", "https:"].includes(new URL(link).protocol); } catch {}
        if (link && !valid) throw new Error(`Link ở ${what} không hợp lệ. Hãy dán đường dẫn bắt đầu bằng http:// hoặc https://`);
        if (required && !link) throw new Error(`Vui lòng dán ${what}.`);
        return { link };
      }
      if (type === "file") {
        const files = [];
        for (const [index, upload] of (Array.isArray(answer.files) ? answer.files.slice(0, maxFilesPerItem) : []).entries()) {
          if (upload?.keep && keptPhotos.has(upload.keep)) {
            files.push(keptPhotos.get(upload.keep));
            continue;
          }
          const name = text(upload?.name, 150).replace(/[\\/:*?"<>|\r\n]/g, "_");
          const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
          const match = /^data:[^;,]*;base64,([A-Za-z0-9+/=]+)$/.exec(String(upload?.data || ""));
          if (!fileTypes[extension] || !match) throw new Error(`File "${name || "không tên"}" ở ${what} không được hỗ trợ. Chỉ nhận PDF, Word, Excel, PowerPoint, ảnh, TXT, CSV hoặc ZIP.`);
          const bytes = Buffer.from(match[1], "base64");
          if (!bytes.length || bytes.length > maxFileBytes) throw new Error(`File "${name}" quá lớn (tối đa 8 MB).`);
          const stored = `${reportId}-${item.id}-${now().toString(36)}${index}.${extension}`;
          newFiles.push({ file: stored, bytes });
          files.push({ file: stored, name, size: bytes.length });
        }
        const minimum = isExtra ? 1 : item.minFiles || 1;
        if (required && files.length < minimum) throw new Error(`${isExtra ? `Cần đính kèm file cho mục "${item.label}"` : `Mục "${item.label}" cần ít nhất ${minimum} file`}.`);
        return { files };
      }
      const photos = [];
      const seen = new Set();
      for (const [index, photo] of (Array.isArray(answer.photos) ? answer.photos.slice(0, maxPhotosPerItem) : []).entries()) {
        if (photo?.keep && keptPhotos.has(photo.keep)) {
          photos.push(keptPhotos.get(photo.keep));
          continue;
        }
        // Photos must be taken just now on this device: stale or reused shots are refused.
        const capturedAt = Date.parse(photo?.capturedAt || "");
        if (!capturedAt || now() - capturedAt > photoFreshnessMs || capturedAt - now() > 2 * 60 * 1000) throw new Error(`Ảnh ở mục "${item.label}" phải được chụp trong vòng 15 phút trước khi gửi.`);
        const saved = savePhoto(reportId, item.id, `${now().toString(36)}${index}`, photo.data);
        if (usedHashes.has(saved.sha256) || seen.has(saved.sha256)) throw new Error(`Ảnh ở mục "${item.label}" trùng với ảnh đã nộp trước đó. Vui lòng chụp ảnh mới.`);
        seen.add(saved.sha256);
        newFiles.push(saved);
        photos.push({ file: saved.file, sha256: saved.sha256, capturedAt: new Date(capturedAt).toISOString() });
      }
      const minimum = isExtra ? 1 : item.minPhotos || 1;
      if (required && photos.length < minimum) throw new Error(`${isExtra ? `Cần chụp ảnh kèm theo mục "${item.label}"` : `Mục "${item.label}" cần ít nhất ${minimum} ảnh`}.`);
      return { photos };
    };
    for (const item of template.items) {
      const answer = answersIn.get(item.id) || {};
      const parts = readPart(item, answer, item.type, item.required, false);
      for (const extra of item.extras || []) Object.assign(parts, readPart(item, answer, extra.type, extra.required, true));
      answers.push({ itemId: item.id, label: item.label, type: item.type, ...(item.extras?.length ? { extras: item.extras.map((extra) => extra.type) } : {}), ...parts });
    }
    fs.mkdirSync(filesDirectory, { recursive: true });
    newFiles.forEach((saved) => fs.writeFileSync(path.join(filesDirectory, saved.file), saved.bytes));
    const submittedAt = new Date(now()).toISOString();
    const report = {
      id: reportId,
      userId: getUserKey(user),
      userName: user.name || user.email,
      // A report sent back for changes keeps the day it belongs to.
      date: entry.revision && existing ? existing.date : getLocalDateKey(),
      templateId: template.id,
      templateName: template.name,
      periodKey: period.key,
      periodLabel: period.label,
      answers,
      submittedAt: existing?.submittedAt || submittedAt,
      updatedAt: submittedAt,
      late: existing ? existing.late : isLate(template, period),
    };
    writeJson(reportsPath, [report, ...reports.filter((item) => item.id !== reportId)]);
    // Drop photo files that the resubmission no longer uses.
    const stillUsed = new Set(answers.flatMap((answer) => [...(answer.photos || []), ...(answer.files || [])].map((photo) => photo.file)));
    keptPhotos.forEach((photo, file) => { if (!stillUsed.has(file)) fs.rm(path.join(filesDirectory, file), { force: true }, () => {}); });
    return sendJson(res, existing ? 200 : 201, { report: publicReport(report) });
  }

  // The user's own reports over the last days: submitted, late, missed and still open periods.
  function history(user, days = 30) {
    const today = getLocalDateKey();
    const key = getUserKey(user);
    const templates = templatesFor(user);
    const reports = getReports().filter((report) => report.userId === key);
    const rows = [];
    const seen = new Set();
    for (let offset = 0; offset < days; offset += 1) {
      const date = addDays(today, -offset);
      for (const template of templates) {
        // Do not count days before the template starts.
        const since = startsOn(template);
        if (since && date < since) continue;
        const period = periodOf(template, date);
        if (!period || seen.has(`${template.id}|${period.key}`)) continue;
        seen.add(`${template.id}|${period.key}`);
        const report = reports.find((item) => item.templateId === template.id && item.periodKey === period.key);
        if (!report && period.dueDate > today) continue;
        const status = report ? (report.late ? "late" : "submitted") : isLate(template, period, today) ? unsubmittedLate(template, period, today) : "pending";
        rows.push({ templateId: template.id, templateName: template.name, periodKey: period.key, periodLabel: period.label, dueDate: period.dueDate, dueLabel: `${period.dueLabel} ${template.deadline}`, status, reportId: report?.id || null, submittedAt: report?.submittedAt || null });
      }
    }
    // Reports of templates that were removed or no longer apply still belong in the history.
    const since = addDays(today, -(days - 1));
    reports.filter((report) => report.date >= since && !seen.has(`${report.templateId}|${report.periodKey}`)).forEach((report) => rows.push({
      templateId: report.templateId, templateName: report.templateName, periodKey: report.periodKey, periodLabel: report.periodLabel || report.date, dueDate: report.date, dueLabel: "", status: report.late ? "late" : "submitted", reportId: report.id, submittedAt: report.submittedAt,
    }));
    return rows.sort((a, b) => b.dueDate.localeCompare(a.dueDate) || a.templateName.localeCompare(b.templateName, "vi"));
  }

  // KPI templates for a month: how often each person reported and how their number items compare to the target.
  function kpiSummary(people, month) {
    const today = getLocalDateKey();
    const context = { templates: getTemplates().filter((template) => template.kpi), structure: getStructure(), reports: getReports() };
    const approvals = getApprovals();
    const first = `${month}-01`;
    const monthEnd = `${month}-${String(daysInMonth(first)).padStart(2, "0")}`;
    const last = monthEnd < today ? monthEnd : today;
    return people.flatMap((user) => {
      const key = getUserKey(user);
      const templates = templatesFor(user, context.templates, context.structure);
      if (!templates.length) return [];
      const entries = templates.map((template) => {
        // Periods whose deadline falls in the month and has passed should have a report;
        // a period still open counts once its report is in (a monthly report sent before the deadline).
        const sent = new Set(context.reports.filter((report) => report.userId === key && report.templateId === template.id).map((report) => report.periodKey));
        const periods = new Map();
        for (let date = first; date <= last; date = addDays(date, 1)) {
          const since = startsOn(template);
          if (since && date < since) continue;
          const period = periodOf(template, date);
          if (period && period.dueDate >= first && period.dueDate <= monthEnd && (period.dueDate <= today || sent.has(period.key))) periods.set(period.key, period);
        }
        const reports = context.reports
          .filter((report) => report.userId === key && report.templateId === template.id && (periods.has(report.periodKey) || report.date?.startsWith(month)))
          .sort((a, b) => a.date.localeCompare(b.date));
        const metrics = template.items.filter((item) => item.type === "number").map((item) => {
          const answers = reports.map((report) => report.answers.find((answer) => answer.itemId === item.id)).filter((answer) => Number.isFinite(answer?.value));
          const values = answers.map((answer) => answer.value);
          const total = values.reduce((sum, value) => sum + value, 0);
          const average = values.length ? total / values.length : null;
          const ratio = item.kpiType === "ratio";
          const base = ratio ? answers.reduce((sum, answer) => sum + (Number.isFinite(answer.total) ? answer.total : 0), 0) : null;
          // A ratio item is measured against 100% when no target was set.
          const target = item.target ?? (ratio ? 100 : null);
          const achieved = !target || !values.length ? null : ratio ? (base > 0 ? Math.round(((total / base) * 100 / target) * 100) : null) : Math.round((total / target) * 100);
          const weight = item.weight ?? null;
          const cap = item.maxRate || 100;
          const points = weight ? Math.round((weight * Math.min(achieved ?? 0, cap)) / 100) : null;
          return { itemId: item.id, label: item.label, kpiType: ratio ? "ratio" : "count", count: values.length, total, base, average, target, achieved, weight, points, cap };
        });
        return {
          templateId: template.id,
          templateName: template.name,
          due: periods.size,
          submitted: reports.filter((report) => periods.has(report.periodKey)).length,
          late: reports.filter((report) => report.late).length,
          approval: reports.length ? approvalFor(approvals, key, template, month, context.reports) : { status: "empty" },
          metrics,
          // Weighted score when the template has điểm chuẩn, otherwise the average "% đạt" (each capped at 100%).
          ...(() => {
            const weighted = metrics.filter((metric) => metric.weight);
            const weightTotal = weighted.reduce((sum, metric) => sum + metric.weight, 0);
            const score = weighted.reduce((sum, metric) => sum + metric.points, 0);
            const rated = metrics.filter((metric) => metric.achieved !== null);
            const kpiPercent = weightTotal ? Math.round((score / weightTotal) * 1000) / 10 : rated.length ? Math.round((rated.reduce((sum, metric) => sum + Math.min(metric.achieved, metric.cap), 0) / rated.length) * 10) / 10 : null;
            return { score: weightTotal ? score : null, weightTotal: weightTotal || null, kpiPercent };
          })(),
          reports: reports.map(publicReport).map((report) => {
            const numbers = report.answers.filter((answer) => answer.type === "number");
            const attachments = Object.fromEntries(numbers.map((answer) => [answer.itemId, {
              ...(answer.link ? { link: answer.link } : {}),
              ...(answer.note ? { note: answer.note } : {}),
              ...(answer.photos?.length ? { photos: answer.photos.map((photo) => ({ url: photo.url })) } : {}),
              ...(answer.files?.length ? { files: answer.files.map((file) => ({ name: file.name, url: file.url })) } : {}),
            }]).filter(([, attached]) => Object.keys(attached).length));
            return { id: report.id, date: report.date, periodLabel: report.periodLabel || report.date, late: Boolean(report.late), values: Object.fromEntries(numbers.map((answer) => [answer.itemId, answer.value])), totals: Object.fromEntries(numbers.filter((answer) => Number.isFinite(answer.total)).map((answer) => [answer.itemId, answer.total])), attachments };
          }),
        };
      });
      return [{ userId: key, name: user.name || user.email, picture: user.picture || "", ...placeOf(user, context.structure), templates: entries }];
    });
  }

  // Every report due between two days (one row per person, template and period), judged against today.
  function overview(from, to) {
    const context = { templates: getTemplates(), structure: getStructure(), reports: getReports() };
    const today = getLocalDateKey();
    const rows = [];
    const seen = new Set();
    for (let date = to; date >= from; date = addDays(date, -1)) {
      for (const user of activeUsers()) {
        for (const { template, period, report } of dueToday(user, date, context)) {
          // Skip days before the template existed, and periods that are not due yet unless already submitted.
          const since = startsOn(template);
          if (since && date < since) continue;
          const key = `${getUserKey(user)}|${template.id}|${period.key}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push({
            userId: getUserKey(user),
            name: user.name || user.email,
            picture: user.picture || "",
            ...placeOf(user, context.structure),
            templateName: template.name,
            periodLabel: period.label,
            dueDate: period.dueDate,
            dueLabel: `${period.dueLabel} ${template.deadline}`,
            status: report ? (report.late ? "late" : "submitted") : isLate(template, period, today) ? unsubmittedLate(template, period, today) : "upcoming",
            reportId: report?.id || null,
            submittedAt: report?.submittedAt || null,
          });
        }
      }
    }
    return rows;
  }

  // Reports due today that are still missing, for check-out, the bell and reminders.
  const missingToday = (user) => dueToday(user).filter(({ period, report }) => !report && period.dueDate === getLocalDateKey());

  function checkoutBlock(user) {
    const blocking = missingToday(user).filter(({ template }) => template.requireBeforeCheckout);
    if (!blocking.length) return null;
    return `Bạn cần nộp báo cáo công việc ${blocking.map(({ template }) => `"${template.name}"`).join(", ")} hôm nay trước khi check-out.`;
  }

  function notificationsFor(user) {
    return missingToday(user).map(({ template, period }) => ({
      id: `work-report-${template.id}-${period.key}`,
      kind: "action",
      time: new Date(now()).toISOString(),
      title: "Báo cáo công việc chưa nộp",
      text: `${template.name} · hạn ${template.deadline} hôm nay.`,
      url: "/work-report.html",
    }));
  }

  // Push/Zalo reminder once, an hour before the deadline, to whoever has not submitted yet.
  const remindersPath = dataPath("work-report-reminders.json");
  async function sendReminders() {
    const date = getLocalDateKey();
    const minutes = getLocalMinutes();
    const sent = readJson(remindersPath, {}) || {};
    Object.keys(sent).forEach((key) => { if (!key.endsWith(date)) delete sent[key]; });
    const context = { templates: getTemplates(), structure: getStructure(), reports: getReports() };
    const tasks = [];
    for (const user of activeUsers()) {
      for (const { template, period, report } of dueToday(user, date, context)) {
        const key = `${getUserKey(user)}|${template.id}|${date}`;
        const deadline = deadlineMinutes(template.deadline);
        if (report || period.dueDate !== date || sent[key] || minutes < deadline - reminderLeadMinutes || minutes > deadline) continue;
        sent[key] = new Date(now()).toISOString();
        tasks.push(notify([user], { title: "Nhắc nộp báo cáo công việc", body: `Bạn chưa nộp "${template.name}". Hạn nộp ${template.deadline} hôm nay.`, path: "/work-report.html" }));
      }
    }
    if (tasks.length) writeJson(remindersPath, sent);
    await Promise.allSettled(tasks);
    return tasks.length;
  }

  async function handle(req, res) {
    const { pathname, searchParams } = new URL(req.url, "http://localhost");
    if (!pathname.startsWith("/api/work-reports")) return false;
    const user = getCurrentUser(req);
    if (!user || user.status !== "active") return send(res, 403, "Forbidden"), true;
    const manager = isManagementUser(user);
    try {
      if (req.method === "GET" && pathname === "/api/work-reports/today") {
        const date = getLocalDateKey();
        const items = openItems(user, date).map(({ template, period, report, revision }) => ({ template, period, report: publicReport(report), late: !report && isLate(template, period), ...(revision ? { revision } : {}) }));
        return sendJson(res, 200, { date, items, canManage: manager }), true;
      }
      if (req.method === "POST" && pathname === "/api/work-reports") return await submitReport(req, res, user), true;
      if (req.method === "GET" && pathname === "/api/work-reports/history") return sendJson(res, 200, { rows: history(user) }), true;
      if (req.method === "POST" && pathname === "/api/work-reports/kpi/approval") {
        if (!manager) return send(res, 403, "Chỉ Admin/CEO được duyệt KPI."), true;
        const payload = await readBody(req, 8 * 1024);
        const person = users.get(String(payload.userId || ""));
        const template = getTemplates().find((item) => item.id === payload.templateId && item.kpi);
        const month = /^\d{4}-\d{2}$/.test(payload.month || "") ? payload.month : "";
        if (!person || !template || !month) return send(res, 400, "Thiếu nhân viên, mẫu KPI hoặc tháng."), true;
        if (!["approve", "revision"].includes(payload.action)) return send(res, 400, "Thao tác không hợp lệ."), true;
        const note = text(payload.note, 1000);
        if (payload.action === "revision" && !note) return send(res, 400, "Vui lòng ghi nội dung cần chỉnh sửa."), true;
        const approvals = getApprovals();
        approvals[approvalKey(getUserKey(person), template.id, month)] = { status: payload.action === "approve" ? "approved" : "revision", note, at: new Date(now()).toISOString(), by: user.name || user.email || "" };
        writeJson(approvalsPath, approvals);
        const monthLabel = `${Number(month.slice(5))}/${month.slice(0, 4)}`;
        notify([person], payload.action === "approve"
          ? { title: "KPI đã được duyệt", body: `KPI "${template.name}" tháng ${monthLabel} đã được duyệt. Xem trong Lương & KPI.`, path: "/kpi.html" }
          : { title: "KPI cần chỉnh sửa", body: `KPI "${template.name}" tháng ${monthLabel}: ${note}`, path: "/work-report.html" }).catch(() => {});
        return sendJson(res, 200, { person: kpiSummary([person], month)[0] || null }), true;
      }
      if (req.method === "GET" && pathname === "/api/work-reports/kpi") {
        const month = /^\d{4}-\d{2}$/.test(searchParams.get("month") || "") ? searchParams.get("month") : getLocalDateKey().slice(0, 7);
        const everyone = manager && searchParams.get("scope") !== "me";
        const people = kpiSummary(everyone ? activeUsers() : [user], month);
        // Before approval the person sees their report and its scoring as provisional; pay (P3) waits for approval.
        if (!everyone) people.forEach((person) => { person.templates = person.templates.map((entry) => (entry.approval.status === "approved" ? entry : { ...entry, hidden: true })); });
        return sendJson(res, 200, { month, canManage: everyone, people }), true;
      }

      const photoMatch = /^\/api\/work-reports\/([\w-]+)\/(?:photos|files)\/([\w.-]+)$/.exec(pathname);
      const reportMatch = /^\/api\/work-reports\/([\w-]+)$/.exec(pathname);
      if (req.method === "GET" && (photoMatch || (reportMatch && !["templates", "overview", "today", "structure", "history", "kpi"].includes(reportMatch[1])))) {
        const report = getReports().find((item) => item.id === (photoMatch || reportMatch)[1]);
        if (!report || (!manager && report.userId !== getUserKey(user))) return send(res, 404, "Không tìm thấy báo cáo."), true;
        if (reportMatch) return sendJson(res, 200, { report: publicReport(report) }), true;
        const stored = report.answers.flatMap((answer) => [...(answer.photos || []), ...(answer.files || [])]).find((item) => item.file === photoMatch[2]);
        const file = path.join(filesDirectory, photoMatch[2]);
        if (!stored || !fs.existsSync(file)) return send(res, 404, "Không tìm thấy file."), true;
        const type = fileTypes[photoMatch[2].split(".").pop()] || "application/octet-stream";
        // Attached documents download under their original name; photos open inline.
        const disposition = stored.name ? { "Content-Disposition": `attachment; filename="report-file"; filename*=UTF-8''${encodeURIComponent(stored.name)}` } : {};
        res.writeHead(200, { "Content-Type": type, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff", ...disposition });
        fs.createReadStream(file).pipe(res);
        return true;
      }

      if (!manager) return send(res, 403, "Chỉ Admin/CEO được quản lý báo cáo công việc."), true;
      const people = () => activeUsers().map((item) => ({ id: getUserKey(item), name: item.name || item.email, email: item.email, picture: item.picture || "" }));
      if (req.method === "GET" && pathname === "/api/work-reports/templates") {
        const structure = getStructure();
        const everyone = activeUsers();
        const templates = getTemplates().map((template) => ({ ...template, recipients: everyone.filter((item) => matches(template, item, structure)).map((item) => item.name || item.email) }));
        return sendJson(res, 200, { templates, departments: structure.departments, positions: structure.positions, users: people() }), true;
      }
      if (req.method === "POST" && pathname === "/api/work-reports/templates") {
        const payload = await readBody(req, 200 * 1024);
        const templates = getTemplates();
        const existing = templates.find((template) => template.id === payload.id);
        const stamp = new Date(now()).toISOString();
        const template = { id: existing?.id || crypto.randomUUID(), ...validateTemplate(payload), createdAt: existing?.createdAt || stamp, updatedAt: stamp };
        writeJson(templatesPath, existing ? templates.map((item) => (item.id === template.id ? template : item)) : [...templates, template]);
        return sendJson(res, existing ? 200 : 201, { template }), true;
      }
      const templateMatch = /^\/api\/work-reports\/templates\/([\w-]+)$/.exec(pathname);
      if (req.method === "DELETE" && templateMatch) {
        const templates = getTemplates();
        if (!templates.some((template) => template.id === templateMatch[1])) return send(res, 404, "Không tìm thấy mẫu báo cáo."), true;
        writeJson(templatesPath, templates.filter((template) => template.id !== templateMatch[1]));
        return sendJson(res, 200, { deleted: true }), true;
      }
      if (req.method === "GET" && pathname === "/api/work-reports/overview") {
        const day = (name) => (/^\d{4}-\d{2}-\d{2}$/.test(searchParams.get(name) || "") ? searchParams.get(name) : "");
        const today = getLocalDateKey();
        let to = day("to") || day("date") || today;
        let from = day("from") || day("date") || to;
        if (to > today) to = today;
        if (from > to) [from, to] = [to, from];
        // Keep a request to at most ~3 months of days.
        if (from < addDays(to, -92)) from = addDays(to, -92);
        return sendJson(res, 200, { from, to, rows: overview(from, to) }), true;
      }
      if (req.method === "GET" && pathname === "/api/work-reports/structure") return sendJson(res, 200, { ...getStructure(), users: people() }), true;
      if (req.method === "POST" && pathname === "/api/work-reports/departments") {
        const payload = await readBody(req, 16 * 1024);
        const name = text(payload.name, 120);
        if (!name) throw new Error("Vui lòng nhập tên phòng ban.");
        const structure = getStructure();
        if (structure.departments.some((item) => item.id !== payload.id && item.name.toLowerCase() === name.toLowerCase())) throw new Error("Phòng ban này đã có.");
        const existing = structure.departments.find((item) => item.id === payload.id);
        if (existing) existing.name = name;
        else structure.departments.push({ id: crypto.randomUUID(), name });
        saveStructure(structure);
        return sendJson(res, 200, structure), true;
      }
      if (req.method === "POST" && pathname === "/api/work-reports/positions") {
        const payload = await readBody(req, 16 * 1024);
        const name = text(payload.name, 120);
        const structure = getStructure();
        if (!name) throw new Error("Vui lòng nhập tên vị trí.");
        if (!structure.departments.some((item) => item.id === payload.departmentId)) throw new Error("Phòng ban không tồn tại.");
        if (structure.positions.some((item) => item.id !== payload.id && item.departmentId === payload.departmentId && item.name.toLowerCase() === name.toLowerCase())) throw new Error("Vị trí này đã có trong phòng ban.");
        const existing = structure.positions.find((item) => item.id === payload.id);
        if (existing) Object.assign(existing, { name, departmentId: payload.departmentId });
        else structure.positions.push({ id: crypto.randomUUID(), name, departmentId: payload.departmentId });
        saveStructure(structure);
        return sendJson(res, 200, structure), true;
      }
      const structureMatch = /^\/api\/work-reports\/(departments|positions)\/([\w-]+)$/.exec(pathname);
      if (req.method === "DELETE" && structureMatch) {
        const [, kind, id] = structureMatch;
        const structure = getStructure();
        if (!structure[kind].some((item) => item.id === id)) return send(res, 404, "Không tìm thấy."), true;
        // Removing a department also removes its positions and frees the people placed there.
        const removedPositions = kind === "departments" ? structure.positions.filter((item) => item.departmentId === id).map((item) => item.id) : [id];
        structure.departments = structure.departments.filter((item) => kind !== "departments" || item.id !== id);
        structure.positions = structure.positions.filter((item) => !removedPositions.includes(item.id));
        Object.entries(structure.assignments).forEach(([userId, place]) => {
          if (kind === "departments" && place.departmentId === id) delete structure.assignments[userId];
          else if (removedPositions.includes(place.positionId)) structure.assignments[userId] = { departmentId: place.departmentId, positionId: null };
        });
        saveStructure(structure);
        return sendJson(res, 200, structure), true;
      }
      if (req.method === "POST" && pathname === "/api/work-reports/assignments") {
        const payload = await readBody(req, 16 * 1024);
        const structure = getStructure();
        const userId = text(payload.userId, 160);
        if (!activeUsers().some((item) => getUserKey(item) === userId)) throw new Error("Nhân viên không tồn tại.");
        if (!payload.departmentId) delete structure.assignments[userId];
        else {
          if (!structure.departments.some((item) => item.id === payload.departmentId)) throw new Error("Phòng ban không tồn tại.");
          const position = structure.positions.find((item) => item.id === payload.positionId);
          if (payload.positionId && position?.departmentId !== payload.departmentId) throw new Error("Vị trí không thuộc phòng ban đã chọn.");
          structure.assignments[userId] = { departmentId: payload.departmentId, positionId: position?.id || null };
        }
        saveStructure(structure);
        return sendJson(res, 200, structure), true;
      }
      return send(res, 404, "Not found"), true;
    } catch (error) {
      return send(res, error.status || 400, error instanceof SyntaxError ? "Dữ liệu không hợp lệ." : error.message), true;
    }
  }

  return { handle, checkoutBlock, notificationsFor, sendReminders, kpiSummary, dataFiles: ["work-report-templates.json", "work-reports.json", "work-report-structure.json", "work-report-reminders.json", "work-report-kpi-approvals.json"] };
}

module.exports = { createWorkReports, periodOf };
