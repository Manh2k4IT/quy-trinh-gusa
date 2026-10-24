const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

// Bảng thông tin tuyển dụng: danh mục và vị trí đang tuyển. Mọi người xem, CEO/Quản trị chỉnh sửa.
function createRecruitment({ dataPath, users, getCurrentUser, isManagementUser, sendJson, send, notify = async () => {}, publish = () => {}, getClientIp = (req) => req.socket.remoteAddress || "" }) {
  const recruitmentPath = dataPath("recruitment.json");
  const applicationsPath = dataPath("recruitment-applications.json");
  const cvDirectory = path.join(path.dirname(recruitmentPath), "recruitment-files");

  function getData() {
    try {
      const data = JSON.parse(fs.readFileSync(recruitmentPath, "utf8"));
      return { categories: Array.isArray(data.categories) ? data.categories : [], jobs: Array.isArray(data.jobs) ? data.jobs : [] };
    } catch (error) {
      if (error.code !== "ENOENT") console.error(error);
      return { categories: [], jobs: [] };
    }
  }
  const saveData = (data) => fs.writeFileSync(recruitmentPath, JSON.stringify(data, null, 2));
  const text = (value, max) => String(value ?? "").trim().slice(0, max);

  async function readBody(req) {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 200 * 1024) throw new Error("Dữ liệu gửi lên quá lớn.");
    }
    return JSON.parse(body || "{}");
  }

  function validateJob(payload, categories) {
    const job = {
      categoryId: text(payload.categoryId, 80),
      title: text(payload.title, 150),
      salary: text(payload.salary, 100),
      location: text(payload.location, 200),
      quantity: text(payload.quantity, 30),
      workType: text(payload.workType, 60),
      deadline: text(payload.deadline, 10),
      status: payload.status === "closed" ? "closed" : "open",
      description: text(payload.description, 4000),
      requirements: text(payload.requirements, 4000),
      benefits: text(payload.benefits, 4000),
      contact: text(payload.contact, 1000),
    };
    if (!categories.some((category) => category.id === job.categoryId)) throw new Error("Vui lòng chọn danh mục.");
    if (!job.title) throw new Error("Vui lòng nhập tên vị trí tuyển dụng.");
    if (job.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(job.deadline)) throw new Error("Hạn nộp hồ sơ không hợp lệ.");
    return job;
  }

  // --- Trang công khai /tuyen-dung: người ứng tuyển xem không cần đăng nhập (gửi link qua Zalo). ---
  const html = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  const isOpen = (job) => job.status === "open" && !(job.deadline && job.deadline < todayKey());
  const formatDate = (value) => (value ? value.split("-").reverse().join("/") : "");

  function bullets(value) {
    const raw = String(value || "");
    const items = raw.split(raw.includes("\n") ? /\n+/ : ";").map((item) => item.trim().replace(/^[-•+*]\s*/, "").trim()).filter(Boolean);
    if (!items.length) return "";
    return items.length === 1 ? `<p>${html(items[0])}</p>` : `<ul>${items.map((item) => `<li>${html(item)}</li>`).join("")}</ul>`;
  }

  function publicPage(res, { origin, title, description, path, body }) {
    const page = `<!doctype html><html lang="vi"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${html(title)}</title><meta name="description" content="${html(description)}" />
<meta property="og:type" content="website" /><meta property="og:site_name" content="GUSA Việt Nam" /><meta property="og:title" content="${html(title)}" />
<meta property="og:description" content="${html(description)}" /><meta property="og:url" content="${html(origin + path)}" /><meta property="og:image" content="${html(origin)}/logo1.jpg" />
<link rel="icon" href="/app-icons/favicon.png" /><link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&display=swap" rel="stylesheet" />
<style>
*{box-sizing:border-box}body{margin:0;color:#243142;font:16px/1.6 "Be Vietnam Pro","Segoe UI",sans-serif;background:#f5f7fb}
a{color:#174b8e}.wrap{max-width:820px;margin:0 auto;padding:24px 16px 48px}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:18px;color:#174b8e;font-weight:800;text-decoration:none}.brand img{width:38px;height:38px;border-radius:10px;object-fit:contain;background:#fff}
.hero{padding:26px;border-radius:20px;color:#fff;background:linear-gradient(120deg,#174b8e,#27856c)}.hero h1{margin:6px 0;font-size:clamp(24px,5vw,34px);line-height:1.25}.hero p{margin:0;opacity:.9}
.tag{display:inline-block;padding:3px 10px;border-radius:99px;font-size:13px;font-weight:700;color:#174b8e;background:#e8eef8}.hero .tag{color:#fff;background:rgba(255,255,255,.18)}
.badge{display:inline-block;margin-top:8px;padding:3px 10px;border-radius:99px;font-size:13px;font-weight:700;color:#067647;background:#e7f7ee}.badge.off{color:#667085;background:#f2f4f7}
.card{margin-top:16px;padding:22px;border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(16,24,40,.06)}
.facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin:0}.facts dt{color:#7e8997;font-size:13px}.facts dd{margin:2px 0 0;font-weight:700}
h2{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:18px}h2:before{content:"";width:4px;height:18px;border-radius:4px;background:#174b8e}
ul{margin:0;padding-left:22px}li{margin:4px 0}li::marker{color:#174b8e}.card p{margin:0}
.list a.job{display:block;margin-top:12px;padding:18px 20px;border-radius:16px;color:inherit;background:#fff;text-decoration:none;box-shadow:0 8px 24px rgba(16,24,40,.05)}
.list a.job:hover{box-shadow:0 12px 30px rgba(16,24,40,.1)}.job strong{display:block;font-size:18px;margin:6px 0 2px}.salary{color:#067647;font-weight:700}.meta{color:#475467;font-size:14px}
.apply label{display:grid;gap:4px;margin-bottom:12px;font-weight:600;font-size:15px}.apply input,.apply textarea{width:100%;min-height:44px;padding:10px 12px;border:1px solid #d0d5dd;border-radius:10px;font:inherit;font-weight:400}.apply textarea{resize:vertical}.apply input[type=file]{padding:8px;background:#f9fafb}.apply button,.apply-cta{display:inline-block;min-height:48px;padding:12px 22px;border:0;border-radius:12px;color:#fff;background:#27856c;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}.apply button{width:100%}.apply button:disabled{opacity:.6}.hero .apply-cta{margin-top:14px;color:#174b8e;background:#fff}.apply-error{margin:0 0 10px;color:#b42318;font-weight:600}.apply-error:empty{display:none}.apply-done{padding:16px;border-radius:12px;color:#05603a;background:#ecfdf3}.apply-done p{margin:4px 0 0}.hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}[hidden]{display:none!important}
.empty{margin-top:16px;padding:28px;border-radius:16px;background:#fff;text-align:center;color:#7e8997}.foot{margin-top:24px;color:#7e8997;font-size:13px;text-align:center}
</style></head><body><main class="wrap"><a class="brand" href="/tuyen-dung"><img src="/logo1.jpg" alt="" />GUSA Việt Nam · Tuyển dụng</a>${body}<p class="foot">© GUSA Việt Nam</p></main></body></html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(page);
  }

  // Trả về true khi request là trang công khai /tuyen-dung.
  function handlePublicPage(req, res) {
    const { pathname } = new URL(req.url, "http://localhost");
    if (req.method !== "GET" || !/^\/tuyen-dung(\/[\w-]+)?\/?$/.test(pathname)) return false;
    const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0] || "http";
    const origin = `${proto}://${req.headers.host}`;
    const data = getData();
    const categoryName = (id) => data.categories.find((category) => category.id === id)?.name || "";
    const jobId = pathname.split("/")[2];
    if (jobId) {
      const job = data.jobs.find((item) => item.id === jobId);
      if (!job) {
        publicPage(res, { origin, title: "Không tìm thấy vị trí tuyển dụng", description: "Vị trí này không còn tồn tại.", path: pathname, body: '<div class="empty">Vị trí tuyển dụng này không còn tồn tại. <a href="/tuyen-dung">Xem các vị trí khác</a></div>' });
        return true;
      }
      const facts = [["Mức lương", job.salary], ["Số lượng", job.quantity], ["Nơi làm việc", job.location], ["Hình thức", job.workType], ["Hạn nộp hồ sơ", formatDate(job.deadline)]].filter(([, value]) => value);
      const sections = [["Mô tả công việc", job.description], ["Yêu cầu ứng viên", job.requirements], ["Quyền lợi", job.benefits], ["Liên hệ ứng tuyển", job.contact]].filter(([, value]) => value);
      publicPage(res, {
        origin,
        path: pathname,
        title: `Tuyển dụng: ${job.title} – GUSA`,
        description: [job.salary && `Lương: ${job.salary}`, job.location && `Nơi làm: ${job.location}`, job.deadline && `Hạn nộp: ${formatDate(job.deadline)}`].filter(Boolean).join(" · ") || "Xem chi tiết vị trí tuyển dụng tại GUSA Việt Nam.",
        body: `<section class="hero"><span class="tag">${html(categoryName(job.categoryId))}</span><h1>${html(job.title)}</h1><span class="badge${isOpen(job) ? "" : " off"}">${isOpen(job) ? "Đang tuyển" : job.status === "closed" ? "Đã đủ người" : "Đã hết hạn nộp"}</span>${isOpen(job) ? '<br /><a class="apply-cta" href="#ung-tuyen">Ứng tuyển ngay</a>' : ""}</section>
          ${facts.length ? `<div class="card"><dl class="facts">${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${html(value)}</dd></div>`).join("")}</dl></div>` : ""}
          ${sections.map(([title, value]) => `<div class="card"><h2>${title}</h2>${bullets(value)}</div>`).join("")}
          <p class="foot"><a href="/tuyen-dung">← Xem các vị trí khác đang tuyển</a></p>${applyForm(job)}`,
      });
      return true;
    }
    const open = data.jobs.filter(isOpen);
    publicPage(res, {
      origin,
      path: pathname,
      title: "Tuyển dụng – GUSA Việt Nam",
      description: open.length ? `${open.length} vị trí đang tuyển: ${open.slice(0, 3).map((job) => job.title).join(", ")}${open.length > 3 ? "…" : ""}` : "Thông tin tuyển dụng của GUSA Việt Nam.",
      body: `<section class="hero"><span class="tag">GUSA VIỆT NAM</span><h1>Cơ hội nghề nghiệp</h1><p>Các vị trí đang tuyển. Bấm vào từng vị trí để xem yêu cầu và cách ứng tuyển.</p></section>
        <div class="list">${open.length ? open.map((job) => `<a class="job" href="/tuyen-dung/${job.id}"><span class="tag">${html(categoryName(job.categoryId))}</span><strong>${html(job.title)}</strong>${job.salary ? `<span class="salary">${html(job.salary)}</span>` : ""}<div class="meta">${[job.location, job.quantity, job.deadline && `Hạn nộp ${formatDate(job.deadline)}`].filter(Boolean).map(html).join(" · ")}</div></a>`).join("") : '<div class="empty">Hiện chưa có vị trí nào đang tuyển. Vui lòng quay lại sau.</div>'}</div>`,
    });
    return true;
  }

  // --- Đơn ứng tuyển: người ứng tuyển gửi từ trang công khai; Admin/CEO/Nhân sự xem và xử lý. ---
  const applicationStatuses = { new: "Mới", contacted: "Đã liên hệ", interview: "Hẹn phỏng vấn", passed: "Đạt", rejected: "Không phù hợp" };
  const maxCvBytes = 5 * 1024 * 1024;
  const cvTypes = { "application/pdf": "pdf", "application/msword": "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const recentApplications = new Map();

  const canViewApplications = (user) => isManagementUser(user) || user?.role === "hr";

  function getApplications() {
    try {
      const list = JSON.parse(fs.readFileSync(applicationsPath, "utf8"));
      return Array.isArray(list) ? list : [];
    } catch (error) {
      if (error.code !== "ENOENT") console.error(error);
      return [];
    }
  }
  const saveApplications = (list) => fs.writeFileSync(applicationsPath, JSON.stringify(list, null, 2));

  // Giới hạn mỗi địa chỉ IP tối đa 5 đơn/giờ để chống spam.
  function allowApplication(ip) {
    const now = Date.now();
    const recent = (recentApplications.get(ip) || []).filter((time) => now - time < 60 * 60 * 1000);
    if (recent.length >= 5) return false;
    recent.push(now);
    recentApplications.set(ip, recent);
    return true;
  }

  async function submitApplication(req, res, jobId) {
    let payload;
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > maxCvBytes * 1.4 + 64 * 1024) throw new Error("File CV quá lớn (tối đa 5MB).");
      }
      payload = JSON.parse(body || "{}");
    } catch (error) {
      return sendJson(res, 400, { error: error instanceof SyntaxError ? "Dữ liệu không hợp lệ." : error.message });
    }
    const job = getData().jobs.find((item) => item.id === jobId);
    if (!job || !isOpen(job)) return sendJson(res, 400, { error: "Vị trí này hiện không nhận hồ sơ." });
    if (payload.website) return sendJson(res, 200, { ok: true });
    const name = text(payload.name, 100);
    const phone = text(payload.phone, 20).replace(/[^\d+]/g, "");
    const email = text(payload.email, 150);
    const message = text(payload.message, 2000);
    if (!name) return sendJson(res, 400, { error: "Vui lòng nhập họ và tên." });
    if (!/^\+?\d{8,15}$/.test(phone)) return sendJson(res, 400, { error: "Số điện thoại không hợp lệ." });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: "Email không hợp lệ." });
    let cv = null;
    if (payload.cv?.data) {
      const match = /^data:([\w.+/-]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(payload.cv.data));
      const extension = match && cvTypes[match[1]];
      if (!extension) return sendJson(res, 400, { error: "CV chỉ nhận file PDF, Word hoặc ảnh." });
      const bytes = Buffer.from(match[2], "base64");
      if (!bytes.length || bytes.length > maxCvBytes) return sendJson(res, 400, { error: "File CV quá lớn (tối đa 5MB)." });
      cv = { id: crypto.randomUUID(), name: text(payload.cv.name, 150) || `cv.${extension}`, type: match[1], size: bytes.length, bytes };
    }
    const ip = getClientIp(req);
    if (!allowApplication(ip)) return sendJson(res, 429, { error: "Bạn đã gửi quá nhiều hồ sơ. Vui lòng thử lại sau." });
    if (cv) {
      fs.mkdirSync(cvDirectory, { recursive: true });
      fs.writeFileSync(path.join(cvDirectory, cv.id), cv.bytes);
      delete cv.bytes;
    }
    const application = { id: crypto.randomUUID(), jobId: job.id, jobTitle: job.title, name, phone, email, message, cv, status: "new", note: "", createdAt: new Date().toISOString() };
    const list = getApplications();
    list.unshift(application);
    saveApplications(list);
    const recipients = [...users.values()].filter((user) => user.status === "active" && canViewApplications(user));
    notify(recipients, { title: "Có người ứng tuyển", body: `${name} ứng tuyển vị trí ${job.title}.`, path: "/recruitment.html?view=applications" })
      .catch((error) => console.error("Recruitment notification failed:", error.message));
    publish();
    sendJson(res, 201, { ok: true });
  }

  function serveCv(res, applicationId) {
    const application = getApplications().find((item) => item.id === applicationId);
    if (!application?.cv) return send(res, 404, "Không có CV.");
    let body;
    try {
      body = fs.readFileSync(path.join(cvDirectory, application.cv.id));
    } catch {
      return send(res, 404, "Không tìm thấy file CV.");
    }
    const inline = application.cv.type === "application/pdf" || application.cv.type.startsWith("image/");
    res.writeHead(200, {
      "Content-Type": inline ? application.cv.type : "application/octet-stream",
      "Content-Length": body.length,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(application.cv.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(body);
  }

  async function handleApplications(req, res, pathname, user) {
    if (!canViewApplications(user)) return send(res, 403, "Chỉ Admin, CEO và Nhân sự được xem danh sách ứng tuyển.");
    const id = pathname.split("/")[4];
    if (req.method === "GET" && pathname === "/api/recruitment/applications") return sendJson(res, 200, { applications: getApplications(), statuses: applicationStatuses });
    if (req.method === "GET" && /^\/api\/recruitment\/applications\/[\w-]+\/cv$/.test(pathname)) return serveCv(res, id);
    const list = getApplications();
    const application = list.find((item) => item.id === id);
    if (!application) return send(res, 404, "Không tìm thấy hồ sơ ứng tuyển.");
    if (req.method === "POST" && /^\/api\/recruitment\/applications\/[\w-]+$/.test(pathname)) {
      const payload = await readBody(req);
      if (payload.status !== undefined) {
        if (!Object.hasOwn(applicationStatuses, payload.status)) throw new Error("Trạng thái không hợp lệ.");
        application.status = payload.status;
      }
      if (payload.note !== undefined) application.note = text(payload.note, 1000);
      application.updatedAt = new Date().toISOString();
      application.updatedBy = user.name || user.email;
      saveApplications(list);
      publish();
      return sendJson(res, 200, { application });
    }
    if (req.method === "DELETE" && /^\/api\/recruitment\/applications\/[\w-]+$/.test(pathname)) {
      if (application.cv) fs.rmSync(path.join(cvDirectory, application.cv.id), { force: true });
      saveApplications(list.filter((item) => item.id !== id));
      publish();
      return sendJson(res, 200, { ok: true });
    }
    return send(res, 404, "Not found");
  }

  // Số hồ sơ mới chưa xử lý — dùng cho chuông thông báo.
  const newApplicationsFor = (user) => (canViewApplications(user) ? getApplications().filter((item) => item.status === "new").length : 0);

  // Trang công khai: GET hiển thị, POST /tuyen-dung/:id/ung-tuyen nhận hồ sơ.
  async function handlePublic(req, res) {
    const { pathname } = new URL(req.url, "http://localhost");
    if (req.method === "POST" && /^\/tuyen-dung\/[\w-]+\/ung-tuyen$/.test(pathname)) {
      await submitApplication(req, res, pathname.split("/")[2]);
      return true;
    }
    return handlePublicPage(req, res);
  }

  function applyForm(job) {
    if (!isOpen(job)) return "";
    return `<section class="card apply" id="ung-tuyen"><h2>Ứng tuyển vị trí này</h2>
      <form data-apply-form novalidate>
        <label>Họ và tên *<input name="name" maxlength="100" required autocomplete="name" /></label>
        <label>Số điện thoại / Zalo *<input name="phone" type="tel" maxlength="20" required autocomplete="tel" inputmode="tel" /></label>
        <label>Email<input name="email" type="email" maxlength="150" autocomplete="email" /></label>
        <label>Giới thiệu ngắn về bản thân<textarea name="message" rows="4" maxlength="2000" placeholder="Kinh nghiệm, thời gian có thể đi làm..."></textarea></label>
        <label>CV (PDF, Word hoặc ảnh, tối đa 5MB)<input name="cv" type="file" accept=".pdf,.doc,.docx,image/*" /></label>
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <p class="apply-error" data-apply-error role="alert"></p>
        <button type="submit">Gửi hồ sơ ứng tuyển</button>
      </form>
      <div class="apply-done" data-apply-done hidden><strong>Đã gửi hồ sơ thành công!</strong><p>Bộ phận nhân sự GUSA sẽ liên hệ với bạn sớm. Cảm ơn bạn đã quan tâm.</p></div>
    </section>
    <script>
    (function () {
      var form = document.querySelector('[data-apply-form]');
      var error = document.querySelector('[data-apply-error]');
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        error.textContent = '';
        if (!form.name.value.trim() || !form.phone.value.trim()) { error.textContent = 'Vui lòng nhập họ tên và số điện thoại.'; return; }
        var file = form.cv.files[0];
        if (file && file.size > 5 * 1024 * 1024) { error.textContent = 'File CV quá lớn (tối đa 5MB).'; return; }
        var button = form.querySelector('button');
        button.disabled = true;
        button.textContent = 'Đang gửi...';
        var send = function (cv) {
          fetch(location.pathname.replace(/\\/$/, '') + '/ung-tuyen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name.value, phone: form.phone.value, email: form.email.value, message: form.message.value, website: form.website.value, cv: cv }) })
            .then(function (response) { return response.json().then(function (data) { if (!response.ok) throw new Error(data.error || 'Gửi không thành công.'); }); })
            .then(function () { form.hidden = true; document.querySelector('[data-apply-done]').hidden = false; })
            .catch(function (err) { error.textContent = err.message; button.disabled = false; button.textContent = 'Gửi hồ sơ ứng tuyển'; });
        };
        if (!file) return send(null);
        var reader = new FileReader();
        reader.onload = function () { send({ name: file.name, data: reader.result }); };
        reader.onerror = function () { error.textContent = 'Không đọc được file CV.'; button.disabled = false; };
        reader.readAsDataURL(file);
      });
    })();
    </script>`;
  }

  // Trả về true khi request thuộc /api/recruitment.
  async function handle(req, res) {
    const { pathname } = new URL(req.url, "http://localhost");
    if (!pathname.startsWith("/api/recruitment")) return false;
    const user = getCurrentUser(req);
    if (!user || user.status !== "active") return send(res, 403, "Forbidden"), true;
    if (req.method === "GET" && pathname === "/api/recruitment") return sendJson(res, 200, { ...getData(), canEdit: isManagementUser(user), canViewApplications: canViewApplications(user), newApplications: newApplicationsFor(user) }), true;
    if (pathname.startsWith("/api/recruitment/applications")) {
      try {
        await handleApplications(req, res, pathname, user);
      } catch (error) {
        send(res, 400, error instanceof SyntaxError ? "Invalid JSON" : error.message);
      }
      return true;
    }
    if (!isManagementUser(user)) return send(res, 403, "Chỉ CEO/Quản trị được chỉnh sửa thông tin tuyển dụng."), true;
    try {
      const data = getData();
      const id = pathname.split("/")[4];
      if (req.method === "POST" && pathname === "/api/recruitment/categories") {
        const payload = await readBody(req);
        const name = text(payload.name, 80);
        if (!name) throw new Error("Vui lòng nhập tên danh mục.");
        const existing = data.categories.find((category) => category.id === payload.id);
        if (existing) existing.name = name;
        else data.categories.push({ id: crypto.randomUUID(), name });
        saveData(data);
        return sendJson(res, 200, data), true;
      }
      if (req.method === "DELETE" && /^\/api\/recruitment\/categories\/[\w-]+$/.test(pathname)) {
        if (data.jobs.some((job) => job.categoryId === id)) throw new Error("Danh mục còn vị trí tuyển dụng. Vui lòng xóa hoặc chuyển các vị trí trước.");
        data.categories = data.categories.filter((category) => category.id !== id);
        saveData(data);
        return sendJson(res, 200, data), true;
      }
      if (req.method === "POST" && pathname === "/api/recruitment/jobs") {
        const payload = await readBody(req);
        const job = validateJob(payload, data.categories);
        const existing = data.jobs.find((item) => item.id === payload.id);
        const now = new Date().toISOString();
        if (existing) Object.assign(existing, job, { updatedAt: now });
        else data.jobs.unshift({ id: crypto.randomUUID(), ...job, createdAt: now, updatedAt: now });
        saveData(data);
        return sendJson(res, 200, data), true;
      }
      if (req.method === "DELETE" && /^\/api\/recruitment\/jobs\/[\w-]+$/.test(pathname)) {
        data.jobs = data.jobs.filter((job) => job.id !== id);
        saveData(data);
        return sendJson(res, 200, data), true;
      }
      send(res, 404, "Not found");
    } catch (error) {
      send(res, 400, error instanceof SyntaxError ? "Invalid JSON" : error.message);
    }
    return true;
  }

  return { handle, handlePublic, newApplicationsFor, dataFiles: ["recruitment.json", "recruitment-applications.json"] };
}

module.exports = { createRecruitment };
