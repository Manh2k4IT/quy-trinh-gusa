const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

loadEnvFile();

const port = Number(process.env.PORT || 5500);
const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${port}/auth/callback`;
const organizationChartPath = path.join(process.cwd(), "organization-chart.json");
const organizationProfilesPath = path.join(process.cwd(), "organization-profiles.json");
const organizationMembersPath = path.join(process.cwd(), "organization-members.json");
const attendancePath = path.join(process.cwd(), "attendance.json");
const proposalsPath = path.join(process.cwd(), "proposals.json");
const zaloTokensPath = path.join(process.cwd(), "zalo-tokens.json");
const usersPath = path.join(process.cwd(), "users.json");
const users = new Map();
const sessions = new Map();
const allowLocalDevAccess = process.env.ALLOW_LOCAL_DEV === "true" || process.env.NODE_ENV === "development" || Number(process.env.PORT || 5500) === 5500;
const zaloAppId = String(process.env.ZALO_APP_ID || "").trim();
const zaloAppSecret = String(process.env.ZALO_APP_SECRET || "").trim();
const zaloRedirectUri = String(process.env.ZALO_REDIRECT_URI || `https://${process.env.RENDER_EXTERNAL_HOSTNAME || `localhost:${port}`}/zalo/oauth/callback`).trim();

loadUsers();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

function loadUsers() {
  try {
    const savedUsers = JSON.parse(fs.readFileSync(usersPath, "utf8"));
    Object.values(savedUsers).forEach((user) => users.set(user.id, user));
  } catch (error) {
    if (error.code !== "ENOENT") console.error(error);
  }
}

function saveUsers() {
  fs.writeFileSync(usersPath, JSON.stringify(Object.fromEntries(users), null, 2));
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", ...headers });
  res.end(body);
}

function redirect(res, location, cookies = []) {
  res.writeHead(302, { Location: location, "Set-Cookie": cookies });
  res.end();
}

function logout(res) {
  redirect(res, "/", [cookie("gusa_session", "", { maxAge: 0 })]);
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split("; ").filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function cookie(name, value, options = {}) {
  const attributes = ["Path=/", "HttpOnly", "SameSite=Lax"];
  if (options.maxAge !== undefined) attributes.push(`Max-Age=${options.maxAge}`);
  return `${name}=${encodeURIComponent(value)}; ${attributes.join("; ")}`;
}

function oauthIsConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function zaloIsConfigured() {
  return Boolean(zaloAppId && zaloAppSecret && !zaloAppId.startsWith("replace-"));
}

function zaloSecretFingerprint() {
  return crypto.createHash("sha256").update(zaloAppSecret).digest("hex").slice(0, 12);
}

function readZaloTokens() {
  try { return JSON.parse(fs.readFileSync(zaloTokensPath, "utf8")); } catch {
    return process.env.ZALO_ACCESS_TOKEN ? { access_token: String(process.env.ZALO_ACCESS_TOKEN).trim(), refresh_token: String(process.env.ZALO_REFRESH_TOKEN || "").trim() } : {};
  }
}

function saveZaloTokens(tokens) {
  fs.writeFileSync(zaloTokensPath, JSON.stringify(tokens, null, 2));
}

function startZaloAuth(req, res) {
  if (!zaloIsConfigured()) return send(res, 503, "Zalo OAuth chua duoc cau hinh. Hay them ZALO_APP_ID va ZALO_APP_SECRET.");
  const state = crypto.randomBytes(24).toString("hex");
  const params = new URLSearchParams({ app_id: zaloAppId, redirect_uri: zaloRedirectUri, state });
  redirect(res, `https://oauth.zaloapp.com/v4/oa/permission?${params}`, [cookie("zalo_oauth_state", state, { maxAge: 600 })]);
}

async function completeZaloAuth(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const returnedState = requestUrl.searchParams.get("state");
  const savedState = parseCookies(req).zalo_oauth_state;
  if (!savedState || (returnedState && returnedState !== savedState)) return send(res, 400, "Zalo OAuth state khong hop le hoac da het han. Hay bat dau lai tai /zalo/oauth/start.");
  if (requestUrl.searchParams.get("error")) return send(res, 400, `Zalo tu choi cap quyen: ${requestUrl.searchParams.get("error")}`);
  const code = requestUrl.searchParams.get("code");
  if (!code) return send(res, 400, "Zalo khong tra ve authorization code.");
  console.log(`Zalo OAuth token exchange: app_id=${zaloAppId}, secret_length=${zaloAppSecret.length}, secret_sha256_12=${zaloSecretFingerprint()}, redirect_uri=${zaloRedirectUri}`);
  let tokenResponse;
  let tokens;
  try {
    tokenResponse = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ app_id: zaloAppId, app_secret: zaloAppSecret, code, grant_type: "authorization_code", redirect_uri: zaloRedirectUri }), signal: AbortSignal.timeout(15000) });
    const tokenBody = await tokenResponse.text();
    try { tokens = JSON.parse(tokenBody); } catch { tokens = { error_name: tokenBody }; }
  } catch (error) {
    console.error("Zalo token exchange failed:", error);
    return send(res, 502, "Khong ket noi duoc Zalo de doi access token. Hay thu lai sau khi Render deploy on dinh.");
  }
  if (!tokenResponse.ok || !tokens.access_token) return send(res, 400, `Zalo tu choi doi access token (HTTP ${tokenResponse.status}): ${tokens.error_name || tokens.error || tokens.message || "unknown error"}`);
  saveZaloTokens({ ...tokens, savedAt: new Date().toISOString() });
  send(res, 200, "Da ket noi Zalo OA thanh cong. Ban co the dong trang nay.", { "Set-Cookie": cookie("zalo_oauth_state", "", { maxAge: 0 }) });
}

function serveZaloWebhook(req, res) {
  send(res, 200, "OK");
}

async function sendZaloPrivateProposal(proposal) {
  const tokens = readZaloTokens();
  const adminUserIds = String(process.env.ZALO_ADMIN_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!tokens.access_token || !adminUserIds.length) return;
  const text = `Đề xuất mới: ${proposal.userName}\nLoại: ${proposal.type}\nNgày: ${proposal.dateFrom && proposal.dateTo ? `${proposal.dateFrom} - ${proposal.dateTo}` : proposal.date}\nLý do: ${proposal.reason}\nXem và xử lý: ${process.env.RENDER_EXTERNAL_URL || "https://quytrinh.gusa.vn"}/proposal-report.html`;
  await Promise.all(adminUserIds.map((userId) => fetch(`https://openapi.zalo.me/v3.0/oa/message/cs?access_token=${encodeURIComponent(tokens.access_token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient: { user_id: userId }, message: { text } }) })));
}

function getCurrentUser(req) {
  const sessionId = parseCookies(req).gusa_session;
  const session = sessionId ? sessions.get(sessionId) : null;
  if (session) return users.get(session.userId) || null;
  if (allowLocalDevAccess) {
    return {
      id: "local-dev",
      name: "Local Admin",
      email: "admin@gusa.local",
      picture: "",
      role: "admin",
      status: "active",
    };
  }
  return null;
}

function startGoogleAuth(req, res) {
  if (!oauthIsConfigured()) {
    return send(res, 503, "OAuth Google chua duoc cau hinh. Hay tao file .env tu .env.example.");
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const state = crypto.randomBytes(24).toString("hex");
  const requestedReturnTo = requestUrl.searchParams.get("returnTo") || "/user-management.html";
  const returnTo = requestedReturnTo.startsWith("/") ? requestedReturnTo : "/user-management.html";
  const loginHint = requestUrl.searchParams.get("loginHint") || "";
  const mode = requestUrl.searchParams.get("mode") === "register" ? "register" : "login";
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state,
  });
  if (loginHint) params.set("login_hint", loginHint);

  sessions.set(state, { returnTo, mode, createdAt: Date.now() });
  redirect(res, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

async function completeGoogleAuth(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const stateData = sessions.get(requestUrl.searchParams.get("state"));
  sessions.delete(requestUrl.searchParams.get("state"));

  if (!stateData || Date.now() - stateData.createdAt > 10 * 60 * 1000) {
    return send(res, 400, "OAuth state khong hop le hoac da het han.");
  }
  if (requestUrl.searchParams.get("error")) return send(res, 400, "Google tu choi dang nhap.");

  const code = requestUrl.searchParams.get("code");
  if (!code) return send(res, 400, "Google khong tra ve authorization code.");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || !tokens.access_token) return send(res, 502, "Khong the doi ma Google lay access token.");

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileResponse.json();
  if (!profileResponse.ok || !profile.email) return send(res, 502, "Khong lay duoc thong tin Gmail.");

  const existingUser = users.get(profile.sub);
  const invitedUser = existingUser || [...users.values()].find((user) => user.email.toLowerCase() === profile.email.toLowerCase());
  if (!existingUser && invitedUser) users.delete(invitedUser.id);
  if (!invitedUser && stateData.mode === "login") {
    const params = new URLSearchParams({
      email: profile.email,
      name: profile.name || "Tài khoản Google",
      picture: profile.picture || "",
    });
    return redirect(res, `/not-registered.html?${params}`);
  }

  users.set(profile.sub, {
    id: profile.sub,
    name: profile.name || profile.email,
    email: profile.email,
    picture: profile.picture || "",
    role: invitedUser?.role || (users.size === 0 ? "admin" : "employee"),
    status: invitedUser?.status || (users.size === 0 ? "active" : "pending"),
    updatedAt: new Date().toISOString(),
  });
  saveUsers();

  const sessionId = crypto.randomBytes(32).toString("hex");
  sessions.set(sessionId, { userId: profile.sub, createdAt: Date.now() });
  const destination = users.get(profile.sub).status === "pending" ? "/pending.html" : stateData.returnTo;
  redirect(res, destination, [cookie("gusa_session", sessionId, { maxAge: 60 * 60 * 8 })]);
}

function serveStatic(req, res) {
  const requestPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
  const filePath = path.resolve(process.cwd(), relativePath);
  if (!filePath.startsWith(path.resolve(process.cwd()))) return send(res, 403, "Forbidden");

  fs.readFile(filePath, (error, data) => {
    if (error) return send(res, 404, "Not found");
    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[extension] || "application/octet-stream" });
    res.end(data);
  });
}

function serveCurrentUser(req, res) {
  const user = getCurrentUser(req);
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify({ user: user || null }));
}

function serveUsers(req, res) {
  const currentUser = getCurrentUser(req);
  if (!currentUser || currentUser.role !== "admin") return send(res, 403, "Forbidden");
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ users: [...users.values()] }));
}

async function updateUserStatus(req, res, userId) {
  const currentUser = getCurrentUser(req);
  if (!currentUser || currentUser.role !== "admin") return send(res, 403, "Forbidden");
  let body = "";
  for await (const chunk of req) body += chunk;
  const payload = JSON.parse(body || "{}");
  const user = users.get(userId);
  if (!user || !["active", "blocked", "pending"].includes(payload.status)) return send(res, 400, "Invalid user status");
  user.status = payload.status;
  users.set(userId, user);
  saveUsers();
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ user }));
}

async function inviteUser(req, res) {
  const currentUser = getCurrentUser(req);
  if (!currentUser || currentUser.role !== "admin") return send(res, 403, "Forbidden");
  let body = "";
  for await (const chunk of req) body += chunk;
  const payload = JSON.parse(body || "{}");
  const email = String(payload.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, "Email không hợp lệ");
  const existing = [...users.values()].find((user) => user.email.toLowerCase() === email);
  if (existing) {
    existing.status = "active";
    users.set(existing.id, existing);
    saveUsers();
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ user: existing }));
  }
  const user = {
    id: `invited:${crypto.randomUUID()}`,
    name: email.split("@")[0],
    email,
    picture: "",
    role: payload.role === "admin" ? "admin" : "employee",
    status: "active",
    invited: true,
    updatedAt: new Date().toISOString(),
  };
  users.set(user.id, user);
  saveUsers();
  res.writeHead(201, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ user }));
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

function getAttendance() {
  try {
    const data = JSON.parse(fs.readFileSync(attendancePath, "utf8"));
    return data && typeof data === "object" ? data : {};
  } catch (error) {
    if (error.code !== "ENOENT") console.error(error);
    return {};
  }
}

function getLocalDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function getLocalMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function getAttendanceUserKey(user) {
  return user.id || user.email;
}

function serveAttendance(req, res) {
  const currentUser = getCurrentUser(req);
  if (!currentUser) return send(res, 401, "Unauthorized");
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const month = /^\d{4}-\d{2}$/.test(requestUrl.searchParams.get("month") || "") ? requestUrl.searchParams.get("month") : getLocalDateKey().slice(0, 7);
  const records = getAttendance()[getAttendanceUserKey(currentUser)] || {};
  sendJson(res, 200, { month, records });
}

function getProposals() {
  try {
    const data = JSON.parse(fs.readFileSync(proposalsPath, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error.code !== "ENOENT") console.error(error);
    return [];
  }
}

function serveProposals(req, res) {
  const currentUser = getCurrentUser(req);
  if (!currentUser || currentUser.status !== "active") return send(res, 403, "Forbidden");
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const proposals = requestUrl.searchParams.get("scope") === "all"
    ? currentUser.role === "admin" ? getProposals() : null
    : getProposals().filter((proposal) => proposal.userId === getAttendanceUserKey(currentUser));
  if (!proposals) return send(res, 403, "Forbidden");
  sendJson(res, 200, { proposals });
}

async function updateProposalStatus(req, res) {
  const currentUser = getCurrentUser(req);
  if (!currentUser || currentUser.role !== "admin" || currentUser.status !== "active") return send(res, 403, "Forbidden");
  let body = "";
  for await (const chunk of req) body += chunk;
  const payload = JSON.parse(body || "{}");
  const proposals = getProposals();
  const proposal = proposals.find((item) => item.id === String(payload.id || ""));
  if (!proposal || !["approved", "rejected"].includes(payload.status)) return send(res, 400, "Đề xuất hoặc trạng thái không hợp lệ.");
  proposal.status = payload.status;
  proposal.reviewedAt = new Date().toISOString();
  fs.writeFileSync(proposalsPath, JSON.stringify(proposals, null, 2));
  sendJson(res, 200, { proposal });
}

async function createProposal(req, res) {
  const currentUser = getCurrentUser(req);
  if (!currentUser || currentUser.status !== "active") return send(res, 403, "Forbidden");
  let body = "";
  for await (const chunk of req) body += chunk;
  const payload = JSON.parse(body || "{}");
  const allowedTypes = ["late", "early-leave", "half-day", "leave", "unauthorized-leave"];
  const type = String(payload.type || "");
  const date = String(payload.date || "");
  const dateFrom = String(payload.dateFrom || "");
  const dateTo = String(payload.dateTo || "");
  const time = String(payload.time || "");
  const reason = String(payload.reason || "").trim().slice(0, 1000);
  const multipleLeave = ["leave", "unauthorized-leave"].includes(type) && dateFrom && dateTo;
  const hasLateProof = type === "late" && typeof payload.latePhotoData === "string" && payload.latePhotoData.startsWith("data:image/") && payload.latePhotoData.length <= 7 * 1024 * 1024 && Number.isFinite(Number(payload.latitude)) && Number.isFinite(Number(payload.longitude));
  if (!allowedTypes.includes(type) || (!/^\d{4}-\d{2}-\d{2}$/.test(date) && !multipleLeave) || (multipleLeave && (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo) || dateTo < dateFrom)) || (time && !/^\d{2}:\d{2}$/.test(time)) || !reason || (type === "late" && !hasLateProof)) return send(res, 400, type === "late" ? "Đề xuất đi trễ cần có ảnh và vị trí xác nhận." : "Vui lòng nhập đầy đủ thông tin đề xuất.");
  const proposal = { id: crypto.randomUUID(), userId: getAttendanceUserKey(currentUser), userName: currentUser.name || currentUser.email, type, date, ...(multipleLeave ? { dateFrom, dateTo } : {}), time, ...(type === "late" ? { latePhotoData: payload.latePhotoData, latitude: Number(payload.latitude), longitude: Number(payload.longitude) } : {}), reason, status: "pending", createdAt: new Date().toISOString() };
  const proposals = getProposals();
  proposals.unshift(proposal);
  fs.writeFileSync(proposalsPath, JSON.stringify(proposals, null, 2));
  sendZaloPrivateProposal(proposal).catch((error) => console.error("Zalo private notification failed:", error.message));
  sendJson(res, 201, { proposal });
}

function serveAttendanceOverview(req, res) {
  const currentUser = getCurrentUser(req);
  if (!currentUser || currentUser.role !== "admin") return send(res, 403, "Forbidden");
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const month = /^\d{4}-\d{2}$/.test(requestUrl.searchParams.get("month") || "") ? requestUrl.searchParams.get("month") : getLocalDateKey().slice(0, 7);
  const attendance = getAttendance();
  const overview = [...users.values()].filter((user) => user.status === "active").map((user) => ({
    id: user.id,
    name: user.name || user.email,
    email: user.email,
    picture: user.picture || "",
    records: Object.fromEntries(Object.entries(attendance[user.id] || {}).filter(([date]) => date.startsWith(month))),
  }));
  sendJson(res, 200, { month, users: overview });
}

async function updateAttendance(req, res) {
  const currentUser = getCurrentUser(req);
  if (!currentUser) return send(res, 401, "Unauthorized");
  let body = "";
  for await (const chunk of req) body += chunk;
  const payload = JSON.parse(body || "{}");
  const action = payload.action;
  const mode = payload.mode === "online" ? "online" : "office";
  const attendanceType = ["full-day", "half-day-morning", "half-day-afternoon"].includes(payload.attendanceType) ? payload.attendanceType : "full-day";
  if (!['check-in', 'check-out'].includes(action)) return send(res, 400, "Hành động không hợp lệ");
  const userKey = getAttendanceUserKey(currentUser);
  const dateKey = getLocalDateKey();
  const attendance = getAttendance();
  const userRecords = attendance[userKey] || {};
  const record = userRecords[dateKey] || { date: dateKey, status: "working" };
  const now = new Date().toISOString();
  if (action === "check-in") {
    if (record.checkIn) return sendJson(res, 409, { message: "Bạn đã check-in hôm nay.", record });
    if (mode === "online" && (!payload.onlineProof?.photoCapturedAt || !payload.onlineProof.photoData?.startsWith("data:image/") || !Number.isFinite(Number(payload.onlineProof.latitude)) || !Number.isFinite(Number(payload.onlineProof.longitude)))) return send(res, 400, "Vui lòng chụp ảnh và chia sẻ vị trí trước khi check-in online.");
    if (mode === "office") {
      const currentMinutes = getLocalMinutes();
      if (attendanceType === "half-day-morning" && (currentMinutes < 8 * 60 + 30 || currentMinutes >= 12 * 60)) return send(res, 400, "Ca sáng nhận chấm công từ 08:30 đến trước 12:00.");
      if (attendanceType === "half-day-afternoon" && (currentMinutes < 13 * 60 || currentMinutes > 17 * 60 + 25)) return send(res, 400, "Ca chiều nhận chấm công từ 13:00 đến 17:25.");
    }
    record.checkIn = now;
    record.status = "working";
    record.workMode = mode;
    record.attendanceType = mode === "office" ? attendanceType : "full-day";
    record.late = getLocalMinutes() > (8 * 60 + 35);
    if (mode === "online") record.onlineProof = { photoCapturedAt: payload.onlineProof.photoCapturedAt, photoData: payload.onlineProof.photoData, latitude: Number(payload.onlineProof.latitude), longitude: Number(payload.onlineProof.longitude), accuracy: Number(payload.onlineProof.accuracy) || null };
    else delete record.onlineProof;
  } else {
    if (!record.checkIn) return send(res, 400, "Bạn chưa check-in hôm nay");
    if (record.checkOut) return sendJson(res, 409, { message: "Bạn đã check-out hôm nay.", record });
    const checkoutMinutes = record.attendanceType === "half-day-morning" ? 12 * 60 : 17 * 60 + 25;
    if (getLocalMinutes() < checkoutMinutes) return send(res, 400, `Bạn chỉ có thể check-out từ ${record.attendanceType === "half-day-morning" ? "12:00" : "17:25"}.`);
    record.checkOut = now;
    record.status = "completed";
  }
  userRecords[dateKey] = record;
  attendance[userKey] = userRecords;
  fs.writeFileSync(attendancePath, JSON.stringify(attendance, null, 2));
  sendJson(res, 200, { record });
}

async function updateAttendanceOverviewStatus(req, res) {
  const currentUser = getCurrentUser(req);
  if (!currentUser || currentUser.role !== "admin") return send(res, 403, "Forbidden");
  let body = "";
  for await (const chunk of req) body += chunk;
  const payload = JSON.parse(body || "{}");
  const userId = String(payload.userId || "");
  const date = String(payload.date || "");
  const status = String(payload.status || "");
  if (!users.has(userId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !["absent", "present", "half-day", "leave", "unauthorized-leave", "online"].includes(status)) return send(res, 400, "Dữ liệu trạng thái không hợp lệ");
  const attendance = getAttendance();
  const records = attendance[userId] || {};
  const record = records[date] || { date };
  if (status === "present") {
    record.status = "working";
    record.checkIn ||= new Date().toISOString();
    record.workMode = "office";
    record.attendanceType = "full-day";
    delete record.onlineProof;
  } else if (status === "half-day") {
    record.status = "working";
    record.checkIn ||= new Date().toISOString();
    record.workMode = "office";
    record.attendanceType = record.attendanceType === "half-day-afternoon" ? "half-day-afternoon" : "half-day-morning";
    delete record.onlineProof;
  } else if (status === "absent") {
    record.status = "absent";
    delete record.checkIn;
    delete record.checkOut;
    delete record.workMode;
    delete record.attendanceType;
    delete record.onlineProof;
  } else {
    record.status = status;
    delete record.checkIn;
    delete record.checkOut;
    delete record.attendanceType;
    if (status === "online") record.workMode = "online";
    else delete record.workMode;
    delete record.onlineProof;
  }
  records[date] = record;
  attendance[userId] = records;
  fs.writeFileSync(attendancePath, JSON.stringify(attendance, null, 2));
  sendJson(res, 200, { record });
}

function getOrganizationChart() {
  try {
    const chart = JSON.parse(fs.readFileSync(organizationChartPath, "utf8"));
    return Array.isArray(chart.nodes) ? chart.nodes : [];
  } catch (error) {
    if (error.code !== "ENOENT") console.error(error);
    return [];
  }
}

function getOrganizationProfiles() {
  try {
    return JSON.parse(fs.readFileSync(organizationProfilesPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") console.error(error);
    return {};
  }
}

function getOrganizationMembers() {
  try {
    return JSON.parse(fs.readFileSync(organizationMembersPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") console.error(error);
    return {};
  }
}

function serveOrganizationMembers(req, res, nodeId) {
  const currentUser = getCurrentUser(req);
  if (!currentUser || currentUser.status !== "active") return send(res, 403, "Forbidden");
  sendJson(res, 200, { members: getOrganizationMembers()[nodeId] || [] });
}

async function updateOrganizationMember(req, res, nodeId) {
  const currentUser = getCurrentUser(req);
  if (!currentUser || currentUser.role !== "admin" || currentUser.status !== "active") return send(res, 403, "Forbidden");
  let body = "";
  for await (const chunk of req) body += chunk;
  const payload = JSON.parse(body || "{}");
  const member = payload.member || {};
  if (!String(member.name || "").trim()) return send(res, 400, "Thành viên cần có họ tên");
  const avatar = String(member.avatar || "").trim();
  if (avatar && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar) && !/^https?:\/\//.test(avatar)) return send(res, 400, "Ảnh đại diện không hợp lệ");
  if (Buffer.byteLength(avatar, "utf8") > 7 * 1024 * 1024) return send(res, 413, "Ảnh đại diện không được vượt quá 5 MB");
  const membersByNode = getOrganizationMembers();
  const members = membersByNode[nodeId] || [];
  const cleanMember = {
    id: String(member.id || crypto.randomUUID()),
    name: String(member.name).trim().slice(0, 120),
    title: String(member.title || "").trim().slice(0, 120),
    avatar: avatar.slice(0, 7 * 1024 * 1024),
    email: String(member.email || "").trim().slice(0, 160),
    phone: String(member.phone || "").trim().slice(0, 40),
    workYears: Math.max(0, Math.min(80, Number(member.workYears) || 0)),
    status: ["working", "leave", "former"].includes(member.status) ? member.status : "working",
    description: String(member.description || "").trim().slice(0, 1000),
  };
  const index = members.findIndex((item) => item.id === cleanMember.id);
  if (index === -1) members.push(cleanMember);
  else members[index] = cleanMember;
  membersByNode[nodeId] = members;
  fs.writeFileSync(organizationMembersPath, JSON.stringify(membersByNode, null, 2));
  sendJson(res, 200, { member: cleanMember, members });
}

function deleteOrganizationMember(req, res, nodeId, memberId) {
  const currentUser = getCurrentUser(req);
  if (!currentUser || currentUser.role !== "admin" || currentUser.status !== "active") return send(res, 403, "Forbidden");
  const membersByNode = getOrganizationMembers();
  const members = membersByNode[nodeId] || [];
  const nextMembers = members.filter((member) => member.id !== memberId);
  if (nextMembers.length === members.length) return send(res, 404, "Không tìm thấy thành viên");
  membersByNode[nodeId] = nextMembers;
  fs.writeFileSync(organizationMembersPath, JSON.stringify(membersByNode, null, 2));
  sendJson(res, 200, { members: nextMembers });
}

function serveOrganizationProfile(req, res, nodeId) {
  const currentUser = getCurrentUser(req);
  if (!currentUser || currentUser.status !== "active") return send(res, 403, "Forbidden");
  sendJson(res, 200, { profile: getOrganizationProfiles()[nodeId] || null });
}

async function updateOrganizationProfile(req, res, nodeId) {
  const currentUser = getCurrentUser(req);
  if (!currentUser || currentUser.role !== "admin" || currentUser.status !== "active") return send(res, 403, "Forbidden");
  let body = "";
  for await (const chunk of req) body += chunk;
  const payload = JSON.parse(body || "{}");
  const profiles = getOrganizationProfiles();
  profiles[nodeId] = {
    title: String(payload.title || "").trim().slice(0, 120),
    email: String(payload.email || "").trim().slice(0, 160),
    phone: String(payload.phone || "").trim().slice(0, 40),
    location: String(payload.location || "").trim().slice(0, 160),
    description: String(payload.description || "").trim().slice(0, 1000),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(organizationProfilesPath, JSON.stringify(profiles, null, 2));
  sendJson(res, 200, { profile: profiles[nodeId] });
}

function serveOrganizationChart(req, res) {
  const currentUser = getCurrentUser(req);
  if (!currentUser || currentUser.status !== "active") return send(res, 403, "Forbidden");
  sendJson(res, 200, { nodes: getOrganizationChart() });
}

async function updateOrganizationChart(req, res) {
  const currentUser = getCurrentUser(req);
  if (!currentUser || currentUser.role !== "admin" || currentUser.status !== "active") return send(res, 403, "Forbidden");
  let body = "";
  for await (const chunk of req) body += chunk;
  const nodes = JSON.parse(body || "{}").nodes;
  if (!Array.isArray(nodes) || nodes.length > 100) return send(res, 400, "Dữ liệu sơ đồ không hợp lệ");
  const cleanNodes = nodes.map((node) => ({
    id: String(node.id || ""),
    parentId: node.parentId ? String(node.parentId) : null,
    name: String(node.name || "").trim().slice(0, 120),
    role: String(node.role || "").trim().slice(0, 120),
    staff: Math.max(0, Math.min(99999, Number(node.staff) || 0)),
    ...(node.placement === "above" ? { placement: "above" } : {}),
  }));
  if (cleanNodes.some((node) => !node.id || !node.name)) return send(res, 400, "Mỗi vị trí cần có tên");
  const ids = new Set(cleanNodes.map((node) => node.id));
  if (cleanNodes.some((node) => node.parentId === node.id || (node.parentId && !ids.has(node.parentId)))) return send(res, 400, "Cấp trên không hợp lệ");
  const parents = new Map(cleanNodes.map((node) => [node.id, node.parentId]));
  for (const node of cleanNodes) {
    const visited = new Set([node.id]);
    let parentId = node.parentId;
    while (parentId) {
      if (visited.has(parentId)) return send(res, 400, "Sơ đồ không được có vòng lặp");
      visited.add(parentId);
      parentId = parents.get(parentId) || null;
    }
  }
  fs.writeFileSync(organizationChartPath, JSON.stringify({ nodes: cleanNodes }, null, 2));
  sendJson(res, 200, { nodes: cleanNodes });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/zalo/oauth/start") return startZaloAuth(req, res);
    if (req.url.startsWith("/zalo/oauth/callback")) return await completeZaloAuth(req, res);
    if (req.method === "POST" && req.url === "/zalo/webhook") return serveZaloWebhook(req, res);
    if (req.url.startsWith("/auth/google")) return startGoogleAuth(req, res);
    if (req.url.startsWith("/auth/callback")) return await completeGoogleAuth(req, res);
    if (req.url === "/auth/logout") return logout(res);
    if (req.url === "/api/me") return serveCurrentUser(req, res);
    if (req.method === "GET" && req.url.startsWith("/api/attendance-overview")) return serveAttendanceOverview(req, res);
    if (req.method === "POST" && req.url === "/api/attendance-overview/status") return await updateAttendanceOverviewStatus(req, res);
    if (req.method === "GET" && req.url.startsWith("/api/attendance")) return serveAttendance(req, res);
    if (req.method === "POST" && req.url === "/api/attendance") return await updateAttendance(req, res);
    if (req.method === "GET" && req.url === "/api/proposals") return serveProposals(req, res);
    if (req.method === "GET" && req.url.startsWith("/api/proposals?")) return serveProposals(req, res);
    if (req.method === "POST" && req.url === "/api/proposals") return await createProposal(req, res);
    if (req.method === "POST" && req.url === "/api/proposals/status") return await updateProposalStatus(req, res);
    if (req.url === "/api/users") return serveUsers(req, res);
    if (req.method === "GET" && req.url === "/api/organization-chart") return serveOrganizationChart(req, res);
    if (req.method === "POST" && req.url === "/api/organization-chart") return await updateOrganizationChart(req, res);
    if (req.method === "GET" && req.url.startsWith("/api/organization-profiles/")) {
      return serveOrganizationProfile(req, res, decodeURIComponent(req.url.slice("/api/organization-profiles/".length)));
    }
    if (req.method === "POST" && req.url.startsWith("/api/organization-profiles/")) {
      return await updateOrganizationProfile(req, res, decodeURIComponent(req.url.slice("/api/organization-profiles/".length)));
    }
    if (req.method === "GET" && req.url.startsWith("/api/organization-members/")) {
      return serveOrganizationMembers(req, res, decodeURIComponent(req.url.slice("/api/organization-members/".length)));
    }
    if (req.method === "POST" && req.url.startsWith("/api/organization-members/")) {
      return await updateOrganizationMember(req, res, decodeURIComponent(req.url.slice("/api/organization-members/".length)));
    }
    if (req.method === "DELETE" && req.url.startsWith("/api/organization-members/")) {
      const parts = req.url.slice("/api/organization-members/".length).split("/");
      return deleteOrganizationMember(req, res, decodeURIComponent(parts[0]), decodeURIComponent(parts[1] || ""));
    }
    if (req.method === "POST" && req.url === "/api/users/invite") return await inviteUser(req, res);
    if (req.method === "POST" && req.url.startsWith("/api/users/") && req.url.endsWith("/status")) {
      const userId = req.url.slice("/api/users/".length, -"/status".length);
      return await updateUserStatus(req, res, userId);
    }
    if (req.url === "/user-management.html") {
      const currentUser = getCurrentUser(req);
      if (!allowLocalDevAccess && (!currentUser || currentUser.status !== "active")) return redirect(res, "/");
    }
    if (req.url === "/organization-chart.html") {
      const currentUser = getCurrentUser(req);
      if (!allowLocalDevAccess && (!currentUser || currentUser.status !== "active")) return redirect(res, "/");
    }
    if (req.url === "/organization-profile.html") {
      const currentUser = getCurrentUser(req);
      if (!allowLocalDevAccess && (!currentUser || currentUser.status !== "active")) return redirect(res, "/");
    }
    if (req.url === "/organization-member-profile.html") {
      const currentUser = getCurrentUser(req);
      if (!allowLocalDevAccess && (!currentUser || currentUser.status !== "active")) return redirect(res, "/");
    }
    if (req.url === "/attendance.html") {
      const currentUser = getCurrentUser(req);
      if (!allowLocalDevAccess && (!currentUser || currentUser.status !== "active")) return redirect(res, "/");
    }
    serveStatic(req, res);
  } catch (error) {
    console.error(error);
    send(res, 500, "Loi may chu.");
  }
});

server.listen(port, () => console.log(`Gusa Quy Trinh: http://localhost:${port}`));
