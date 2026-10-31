const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ZALO_OA_API = "https://openapi.zalo.me";
const MAX_IMAGE_BYTES = 1024 * 1024;
const ZALO_OAUTH_API = "https://oauth.zaloapp.com/v4/access_token";

function loadUserIdMap(value) {
  if (!value) return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("ZALO_USER_ID_MAP phải là JSON có dạng {\"gusa-user-id\":\"zalo-user-id\"}.");
  return Object.fromEntries(Object.entries(parsed).map(([userId, zaloUserId]) => {
    if (!userId.trim() || typeof zaloUserId !== "string" || !zaloUserId.trim() || zaloUserId.length > 128) {
      throw new Error("ZALO_USER_ID_MAP chứa ánh xạ tài khoản không hợp lệ.");
    }
    return [userId, zaloUserId.trim()];
  }));
}

function createZaloClient({ env = process.env, dataDirectory, fetchImpl = fetch, logger = console }) {
  const userIdMap = loadUserIdMap(env.ZALO_USER_ID_MAP);
  const groupId = String(env.ZALO_GROUP_ID || "").trim();
  const paymentGroupId = String(env.ZALO_PAYMENT_GROUP_ID || "").trim() || groupId;
  const approvedGroupId = String(env.ZALO_APPROVED_GROUP_ID || "").trim();
  const encryptionKey = String(env.ZALO_TOKEN_ENCRYPTION_KEY || "");
  let refreshPromise;
  let lastError = null;
  let lastSuccessAt = null;
  let missingConfigWarned = false;
  let missingGroupWarned = false;

  function isConfigured() {
    return Boolean((groupId || paymentGroupId || approvedGroupId || Object.keys(userIdMap).length) && env.ZALO_APP_ID && env.ZALO_APP_SECRET && encryptionKey.length >= 32);
  }

  function getTokenFile() {
    if (!dataDirectory) throw new Error("Zalo OA token storage is not configured.");
    return path.join(dataDirectory, "zalo-oa-tokens.json");
  }

  function getEncryptionKey() {
    if (encryptionKey.length < 32) throw new Error("ZALO_TOKEN_ENCRYPTION_KEY must contain at least 32 characters.");
    return crypto.createHash("sha256").update(encryptionKey).digest();
  }

  function encryptTokens(tokens) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(tokens), "utf8"), cipher.final()]);
    return JSON.stringify({ iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") });
  }

  // Refresh tokens are single-use: keep the latest pair in memory so a lost/unwritable file doesn't fall back to a spent env token.
  let memoryTokens = null;
  // Đánh dấu khi refresh token bị Zalo từ chối để nhắc Admin/CEO cấp quyền lại.
  let needsReauth = false;

  function readTokens() {
    try {
      const saved = JSON.parse(fs.readFileSync(getTokenFile(), "utf8"));
      const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(saved.iv, "base64"));
      decipher.setAuthTag(Buffer.from(saved.tag, "base64"));
      const decrypted = Buffer.concat([decipher.update(Buffer.from(saved.data, "base64")), decipher.final()]);
      return JSON.parse(decrypted.toString("utf8"));
    } catch (error) {
      if (error.code === "ENOENT") {
        if (memoryTokens) {
          logger.warn("Zalo OA token file is missing; using in-memory tokens. Check that DATA_DIR is on persistent storage.");
          return memoryTokens;
        }
        return { refreshToken: String(env.ZALO_REFRESH_TOKEN || "") };
      }
      if (error.code === "ERR_OSSL_BAD_DECRYPT" || error instanceof SyntaxError) {
        throw new Error("Không thể giải mã token Zalo đã lưu; kiểm tra ZALO_TOKEN_ENCRYPTION_KEY và tệp dữ liệu Zalo.");
      }
      throw error;
    }
  }

  function saveTokens(tokens) {
    memoryTokens = tokens;
    needsReauth = false;
    try {
      const filePath = getTokenFile();
      const tempPath = `${filePath}.tmp`;
      fs.writeFileSync(tempPath, encryptTokens(tokens), { mode: 0o600 });
      fs.renameSync(tempPath, filePath);
    } catch (error) {
      logger.error(`Không thể lưu token Zalo OA mới (${error.message}); giữ trong bộ nhớ.`);
    }
  }

  async function refreshAccessToken(retried = false) {
    const stored = readTokens();
    if (!stored.refreshToken) throw new Error("Thiếu refresh token Zalo OA.");
    if (retried && stored.accessToken && stored.expiresAt > Date.now()) return stored;
    const response = await fetchImpl(ZALO_OAUTH_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        secret_key: env.ZALO_APP_SECRET,
      },
      body: new URLSearchParams({
        app_id: env.ZALO_APP_ID,
        grant_type: "refresh_token",
        refresh_token: stored.refreshToken,
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.access_token || !payload.refresh_token || !Number(payload.expires_in)) {
      const errorCode = payload.error || response.status;
      // Another instance (e.g. the old one during a deploy) may have rotated the token meanwhile.
      if (!retried) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const latest = readTokens();
        if (latest.refreshToken && latest.refreshToken !== stored.refreshToken) return refreshAccessToken(true);
      }
      if (errorCode === -14014) needsReauth = true;
      const hint = errorCode === -14014 ? " Refresh token đã hết hạn hoặc bị thu hồi: cấp quyền lại Zalo OA, rồi xóa zalo-oa-tokens.json cũ nếu dùng ZALO_REFRESH_TOKEN mới." : "";
      throw new Error(`Không thể làm mới token Zalo OA (mã ${errorCode}).${hint}`);
    }
    const tokens = {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: Date.now() + Number(payload.expires_in) * 1000 - 5 * 60 * 1000,
    };
    saveTokens(tokens);
    logger.log?.(`Zalo OA: đã làm mới token, hiệu lực đến ${new Date(tokens.expiresAt).toISOString()}.`);
    return tokens;
  }

  async function getAccessToken() {
    if (!isConfigured()) {
      if (!missingConfigWarned) {
        logger.warn("Zalo OA notifications are disabled: configure the ZALO_* environment variables.");
        missingConfigWarned = true;
      }
      return null;
    }
    const stored = readTokens();
    if (!stored.refreshToken) {
      if (!missingConfigWarned) {
        logger.warn("Zalo OA notifications are disabled: configure ZALO_REFRESH_TOKEN or restore the encrypted Zalo token store.");
        missingConfigWarned = true;
      }
      return null;
    }
    if (stored.accessToken && stored.expiresAt > Date.now()) return stored.accessToken;
    if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
    return (await refreshPromise).accessToken;
  }

  // Node only says "fetch failed" for network errors; keep the underlying cause so admins can act on it.
  function describeError(error) {
    if (error?.message !== "fetch failed") return error;
    const cause = error.cause?.code || error.cause?.message || "lỗi mạng";
    return new Error(`Không kết nối được tới máy chủ Zalo (${cause}).`);
  }

  // Remembers the outcome of every call that talks to Zalo so the settings page shows real delivery health.
  function tracked(action) {
    return async (...args) => {
      try {
        const result = await action(...args);
        if (result) {
          lastError = null;
          lastSuccessAt = Date.now();
        }
        return result;
      } catch (error) {
        const described = describeError(error);
        lastError = { message: described.message, at: Date.now() };
        throw described;
      }
    };
  }

  // Refreshes an expired token, then reads the OA profile to prove Zalo accepts it.
  async function checkConnection() {
    const accessToken = await getAccessToken();
    if (!accessToken) return false;
    const response = await fetchImpl(`${ZALO_OA_API}/v2.0/oa/getoa`, { headers: { access_token: accessToken } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error !== 0) throw new Error(`Zalo OA từ chối token hiện tại (mã ${payload.error || response.status}).`);
    return true;
  }

  async function sendMessage(recipient, text) {
    const accessToken = await getAccessToken();
    if (!accessToken) return false;
    const response = await fetchImpl(`${ZALO_OA_API}/v3.0/oa/group/message`, {
      method: "POST",
      headers: { access_token: accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient, message: { text } }),
    });
    const payload = await response.json();
    if (!response.ok || payload.error !== 0) {
      const errorCode = payload.error || response.status;
      throw new Error(`Zalo OA từ chối gửi thông báo (mã ${errorCode}).`);
    }
    return true;
  }

  function resolveGroupId(kind) {
    if (kind === "approved") return approvedGroupId;
    return kind === "payment" ? paymentGroupId : groupId;
  }

  async function sendGroupMessage(text, { kind } = {}) {
    const targetGroupId = resolveGroupId(kind);
    if (!targetGroupId) {
      if (!missingGroupWarned) {
        logger.warn("Zalo GMF delivery skipped: configure ZALO_GROUP_ID.");
        missingGroupWarned = true;
      }
      return false;
    }
    return sendMessage({ group_id: targetGroupId }, text);
  }

  async function sendGroupImage(buffer, mimeType, caption, { kind } = {}) {
    const targetGroupId = resolveGroupId(kind);
    if (!targetGroupId || !["image/jpeg", "image/png"].includes(mimeType) || !buffer?.length || buffer.length > MAX_IMAGE_BYTES) return false;
    const accessToken = await getAccessToken();
    if (!accessToken) return false;
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimeType }), mimeType === "image/png" ? "proposal.png" : "proposal.jpg");
    const uploadResponse = await fetchImpl(`${ZALO_OA_API}/v2.0/oa/upload/image`, { method: "POST", headers: { access_token: accessToken }, body: form });
    const upload = await uploadResponse.json();
    const attachmentId = upload?.data?.attachment_id;
    if (!uploadResponse.ok || upload.error !== 0 || !attachmentId) {
      throw new Error(`Zalo OA từ chối tải ảnh lên (mã ${upload?.error || uploadResponse.status}).`);
    }
    const response = await fetchImpl(`${ZALO_OA_API}/v3.0/oa/group/message`, {
      method: "POST",
      headers: { access_token: accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { group_id: targetGroupId },
        message: {
          text: String(caption || "Ảnh đính kèm").slice(0, 2000),
          attachment: { type: "template", payload: { template_type: "media", elements: [{ media_type: "image", attachment_id: attachmentId }] } },
        },
      }),
    });
    const payload = await response.json();
    if (!response.ok || payload.error !== 0) throw new Error(`Zalo OA từ chối gửi ảnh (mã ${payload.error || response.status}).`);
    return true;
  }

  async function sendDirectMessage(zaloUserId, text) {
    const accessToken = await getAccessToken();
    if (!accessToken) return false;
    const response = await fetchImpl(`${ZALO_OA_API}/v3.0/oa/message/cs`, {
      method: "POST",
      headers: { access_token: accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { user_id: zaloUserId }, message: { text } }),
    });
    const payload = await response.json();
    if (!response.ok || payload.error !== 0) {
      const errorCode = payload.error || response.status;
      throw new Error(`Zalo OA không gửi được tin riêng (mã ${errorCode}).`);
    }
    return true;
  }

  async function exchangeAuthorizationCode(code) {
    if (!env.ZALO_APP_ID || !env.ZALO_APP_SECRET || encryptionKey.length < 32) {
      throw new Error("Thiếu ZALO_APP_ID, ZALO_APP_SECRET hoặc ZALO_TOKEN_ENCRYPTION_KEY.");
    }
    const response = await fetchImpl("https://oauth.zaloapp.com/v4/oa/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", secret_key: env.ZALO_APP_SECRET },
      body: new URLSearchParams({ app_id: env.ZALO_APP_ID, grant_type: "authorization_code", code: String(code) }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.access_token || !payload.refresh_token || !Number(payload.expires_in)) {
      throw new Error(`Không thể đổi mã cấp quyền Zalo OA (mã ${payload.error || response.status}).`);
    }
    saveTokens({
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: Date.now() + Number(payload.expires_in) * 1000 - 5 * 60 * 1000,
    });
  }

  async function listGroups() {
    const accessToken = await getAccessToken();
    if (!accessToken) return [];
    // Zalo's docs are not machine-readable, so try the known endpoint spellings until one exists.
    const paths = ["/v3.0/oa/group/getgroupsofoa", "/v3.0/oa/group/listgroupofoa", "/v2.0/oa/group/listgroupofoa", "/v3.0/oa/group/list"];
    let payload;
    let status;
    for (const endpoint of paths) {
      const response = await fetchImpl(`${ZALO_OA_API}${endpoint}?offset=0&count=50`, { headers: { access_token: accessToken } });
      status = response.status;
      payload = await response.json().catch(() => ({}));
      if (response.ok && (!payload.error || payload.error === 0)) break;
      logger.warn(`Zalo list groups ${endpoint} failed (mã ${payload.error || status}).`);
      payload = null;
    }
    if (!payload) throw new Error(`Zalo OA không liệt kê được nhóm (mã ${status}).`);
    const groups = payload.data?.groups || payload.data || [];
    return (Array.isArray(groups) ? groups : []).map((group) => ({
      groupId: group.group_id,
      name: group.group_name || group.name,
    }));
  }

  function getUserId(gusaUserId) {
    return userIdMap[String(gusaUserId || "")] || "";
  }

  function getAuthorizationUrl(redirectUri) {
    if (!env.ZALO_APP_ID) return null;
    return `https://oauth.zaloapp.com/v4/oa/permission?${new URLSearchParams({ app_id: env.ZALO_APP_ID, redirect_uri: redirectUri })}`;
  }

  function getStatus() {
    let tokens = null;
    let tokenError = false;
    try { tokens = isConfigured() ? readTokens() : null; } catch { tokenError = true; }
    return { configured: isConfigured(), needsReauth, tokenError, hasToken: Boolean(tokens?.refreshToken), expiresAt: tokens?.expiresAt || null, lastError, lastSuccessAt };
  }
  const waitForPendingRefresh = () => (refreshPromise ? refreshPromise.then(() => {}, () => {}) : Promise.resolve());

  return {
    checkConnection: tracked(checkConnection),
    exchangeAuthorizationCode,
    getAuthorizationUrl,
    getStatus,
    waitForPendingRefresh,
    getUserId,
    isConfigured,
    listGroups,
    sendDirectMessage: tracked(sendDirectMessage),
    sendGroupImage: tracked(sendGroupImage),
    sendGroupMessage: tracked(sendGroupMessage),
  };
}

module.exports = { createZaloClient, loadUserIdMap };
