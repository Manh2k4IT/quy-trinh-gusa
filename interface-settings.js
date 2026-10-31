const appShell = document.querySelector(".app-shell");
const mobileMenuToggle = document.querySelector("[data-mobile-menu-toggle]");
const mobileMenuBackdrop = document.querySelector("[data-mobile-menu-backdrop]");
const adminMenu = document.querySelector("[data-admin-menu]");
const adminMenuLabel = document.querySelector("[data-admin-menu-label]");
const themeToggle = document.querySelector("[data-interface-theme-toggle]");
const audioPermissionButton = document.querySelector("[data-audio-permission-button]");
const audioPermissionStatus = document.querySelector("[data-audio-permission-status]");

const topAvatar = document.querySelector("[data-top-avatar]");
if (topAvatar && !document.querySelector("[data-notification-trigger]")) {
  topAvatar.insertAdjacentHTML("beforebegin", '<button class="top-icon notification-icon" type="button" data-notification-trigger aria-label="Thông báo"><svg class="bell-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg><b data-notification-count hidden></b></button><button class="top-icon" type="button" data-theme-trigger aria-label="Đổi giao diện sáng tối"><svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 1 0 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" /></svg></button><button class="top-icon" type="button" data-color-trigger aria-label="Đổi màu giao diện"><svg class="palette-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0 0 18h1.2a1.8 1.8 0 0 0 0-3.6h-.7a1.8 1.8 0 0 1 0-3.6H15a6 6 0 0 0 0-12H12Z" /><circle cx="7.5" cy="10" r="1" /><circle cx="10" cy="6.8" r="1" /><circle cx="14" cy="6.8" r="1" /></svg></button>');
}
document.querySelectorAll(".theme-icon path").forEach((path) => path.setAttribute("d", "M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"));

const colorTrigger = document.querySelector("[data-color-trigger]");
const themeTrigger = document.querySelector("[data-theme-trigger]");
const paletteSetting = document.querySelector(".interface-page-palette");
const profileMenu = document.createElement("div");
profileMenu.className = "profile-menu";
profileMenu.hidden = true;
profileMenu.innerHTML = '<div class="profile-header"><div class="profile-avatar" data-settings-profile-avatar>B</div><div><strong data-settings-profile-name>Tài khoản Google</strong><small data-settings-profile-email></small></div></div><div class="profile-role" data-settings-profile-role>Nhân viên</div><a class="profile-logout" href="/auth/logout">Đăng xuất</a>';
document.querySelector(".workspace").append(profileMenu);
const notificationMenu = document.createElement("div");
notificationMenu.className = "notification-menu";
notificationMenu.hidden = true;
notificationMenu.innerHTML = '<strong>Thông báo</strong><div class="notification-list"><p class="notification-empty">Đang tải thông báo...</p></div>';
document.querySelector(".workspace").append(notificationMenu);

colorTrigger?.addEventListener("click", () => {
  paletteSetting?.scrollIntoView({ behavior: "smooth", block: "center" });
  paletteSetting?.classList.add("is-focused");
  window.setTimeout(() => paletteSetting?.classList.remove("is-focused"), 900);
});

themeTrigger?.addEventListener("click", () => {
  themeToggle.click();
});

topAvatar?.addEventListener("click", (event) => {
  event.stopPropagation();
  profileMenu.hidden = !profileMenu.hidden;
});

document.querySelector("[data-notification-trigger]")?.addEventListener("click", (event) => {
  event.stopPropagation();
  notificationMenu.hidden = !notificationMenu.hidden;
  profileMenu.hidden = true;
});

document.addEventListener("click", (event) => {
  if (!profileMenu.contains(event.target) && !event.target.closest("[data-top-avatar]")) profileMenu.hidden = true;
  if (!notificationMenu.contains(event.target) && !event.target.closest("[data-notification-trigger]")) notificationMenu.hidden = true;
});

function setMobileMenu(open) {
  appShell.classList.toggle("is-mobile-menu-open", open);
  mobileMenuBackdrop.hidden = !open;
  mobileMenuToggle.setAttribute("aria-expanded", String(open));
}

mobileMenuToggle.addEventListener("click", () => setMobileMenu(!appShell.classList.contains("is-mobile-menu-open")));
mobileMenuBackdrop.addEventListener("click", () => setMobileMenu(false));

if (localStorage.getItem("gusa-sidebar-collapsed") === "true") appShell.classList.add("is-collapsed");

function syncThemeToggle() {
  const isDark = document.body.dataset.theme === "dark";
  themeToggle.setAttribute("aria-checked", String(isDark));
  themeToggle.classList.toggle("is-on", isDark);
  document.querySelector("[data-interface-theme-status]").textContent = isDark ? "Đang bật" : "Đang tắt";
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem("gusa-theme", theme);
  syncThemeToggle();
}

themeToggle.addEventListener("click", () => setTheme(document.body.dataset.theme === "dark" ? "light" : "dark"));
document.body.dataset.theme = localStorage.getItem("gusa-theme") || "light";
syncThemeToggle();

document.querySelectorAll("[data-theme-primary]").forEach((button) => {
  button.addEventListener("click", () => {
    const palette = { primary: button.dataset.themePrimary, surface: button.dataset.themeSurface };
    document.documentElement.style.setProperty("--navy", palette.primary);
    document.documentElement.style.setProperty("--blue-100", palette.surface);
    localStorage.setItem("gusa-palette", JSON.stringify(palette));
    syncPaletteSelection(palette.primary);
  });
});
const savedPalette = JSON.parse(localStorage.getItem("gusa-palette") || "null");
document.documentElement.style.setProperty("--navy", savedPalette?.primary || "#174b8e");
document.documentElement.style.setProperty("--blue-100", savedPalette?.surface || "#eaf2fa");
function syncPaletteSelection(primary) {
  document.querySelectorAll("[data-theme-primary]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.themePrimary === primary));
  });
}
syncPaletteSelection(savedPalette?.primary || "#174b8e");

function setAdminMenuVisibility(roleLabel) {
  const isAdmin = roleLabel === "Quản trị" || roleLabel === "CEO";
  if (adminMenu) adminMenu.hidden = !isAdmin;
  if (adminMenuLabel) adminMenuLabel.hidden = !isAdmin;
  document.querySelectorAll(".role-chip").forEach((button) => {
    const originalRole = button.dataset.role || button.textContent.trim();
    button.dataset.role = originalRole;
    const isCurrentRole = roleLabel === "CEO"
      ? originalRole === "CEO"
      : roleLabel === "Quản trị"
        ? originalRole === "Quản trị"
        : originalRole === "Nhân viên";
    button.textContent = isCurrentRole ? roleLabel : originalRole;
    button.hidden = !isCurrentRole;
    button.classList.toggle("is-selected", isCurrentRole);
  });
}

fetch("/api/me", { cache: "no-store" })
  .then((response) => response.json())
  .then(({ user }) => {
    if (!user) return;
    const displayName = user.name || user.email || "Tài khoản Google";
    const roleLabel = user.role === "ceo" ? "CEO" : user.role === "admin" ? "Quản trị" : user.role === "accountant" ? "Kế toán" : user.role === "warehouse" ? "Vận hành kho" : user.role === "manager" ? "Quản lý cấp 1" : user.role === "production" ? "Sản xuất" : user.role === "hr" ? "Nhân sự" : "Nhân viên";
    document.querySelectorAll("[data-user-name]").forEach((element) => { element.textContent = displayName; });
    document.querySelectorAll("[data-user-role]").forEach((element) => { element.textContent = user.role === "ceo" ? "CEO" : user.role === "admin" ? "Quản trị viên" : user.role === "accountant" ? "Kế toán" : user.role === "warehouse" ? "Vận hành kho" : user.role === "manager" ? "Quản lý cấp 1" : user.role === "production" ? "Sản xuất" : user.role === "hr" ? "Nhân sự" : "Nhân viên"; });
    setAdminMenuVisibility(roleLabel);
    document.querySelector("[data-settings-profile-name]").textContent = displayName;
    document.querySelector("[data-settings-profile-email]").textContent = user.email || "";
    document.querySelector("[data-settings-profile-role]").textContent = user.role === "ceo" ? "CEO" : user.role === "admin" ? "Quản trị viên" : user.role === "accountant" ? "Kế toán" : user.role === "warehouse" ? "Vận hành kho" : user.role === "manager" ? "Quản lý cấp 1" : user.role === "production" ? "Sản xuất" : user.role === "hr" ? "Nhân sự" : "Nhân viên";
    if (user.picture) {
      document.querySelectorAll("[data-user-avatar], [data-top-avatar]").forEach((element) => {
        const image = document.createElement("img");
        image.src = user.picture;
        image.referrerPolicy = "no-referrer";
        image.alt = `Ảnh đại diện của ${displayName}`;
        element.replaceChildren(image);
      });
      const profileImage = document.createElement("img");
      profileImage.src = user.picture;
      profileImage.referrerPolicy = "no-referrer";
      profileImage.alt = `Ảnh đại diện của ${displayName}`;
      document.querySelector("[data-settings-profile-avatar]").replaceChildren(profileImage);
    }
  })
  .catch(() => setAdminMenuVisibility(false));

function updateAudioPermissionStatus() {
  const notification = "Notification" in window ? Notification.permission : "unsupported";
  const appAudioEnabled = localStorage.getItem("gusa-proposal-audio-enabled") !== "false";
  const effectiveEnabled = appAudioEnabled;

  audioPermissionButton?.setAttribute("aria-checked", String(effectiveEnabled));
  audioPermissionButton?.classList.toggle("is-on", effectiveEnabled);

  if (notification === "denied") {
    audioPermissionStatus.textContent = effectiveEnabled
      ? "Âm thanh trong ứng dụng đã bật. Thông báo hệ thống đang bị chặn bởi trình duyệt."
      : "Thông báo hệ thống đang bị chặn; bạn vẫn có thể bật âm thanh trong ứng dụng.";
  } else if (effectiveEnabled) {
    audioPermissionStatus.textContent = "Đã bật trong ứng dụng. Nếu vẫn không nghe, hãy bỏ tắt tiếng tab và kiểm tra âm lượng trình duyệt/thiết bị.";
  } else {
    audioPermissionStatus.textContent = "Đang tắt trong ứng dụng.";
  }
}

audioPermissionButton?.addEventListener("click", async () => {
  const notification = "Notification" in window ? Notification.permission : "unsupported";
  if (notification === "default" && "Notification" in window) {
    try {
      await Notification.requestPermission();
    } catch (error) {
      audioPermissionStatus.textContent = "Không yêu cầu được quyền thông báo. Vui lòng kiểm tra cài đặt trình duyệt.";
      console.error("Không yêu cầu được quyền thông báo.", error);
      return;
    }
  }

  const enabled = localStorage.getItem("gusa-proposal-audio-enabled") !== "false";
  localStorage.setItem("gusa-proposal-audio-enabled", enabled ? "false" : "true");
  updateAudioPermissionStatus();
});
function syncSettingsPanels() {
  const settingId = location.hash.slice(1);
  if (["audio-permission", "dark-mode", "interface-colors"].includes(settingId)) {
    window.setTimeout(() => {
      document.getElementById(settingId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }
}
window.addEventListener("hashchange", syncSettingsPanels);
syncSettingsPanels();
updateAudioPermissionStatus();
window.addEventListener("storage", (event) => {
  if (event.key === null || event.key === "gusa-proposal-audio-enabled") updateAudioPermissionStatus();
});
if ("speechSynthesis" in window) window.speechSynthesis.addEventListener("voiceschanged", updateAudioPermissionStatus);

// Mục "Kết nối Zalo OA" (chỉ Admin/CEO — API trả 403 cho người khác nên mục vẫn ẩn).
(async () => {
  const section = document.querySelector("[data-zalo-setting]");
  if (!section) return;
  const status = section.querySelector("[data-zalo-status]");
  const detail = section.querySelector("[data-zalo-detail]");
  const checkButton = section.querySelector("[data-zalo-check]");
  const formatTime = (time) => new Date(time).toLocaleString("vi-VN");
  const render = (zalo) => {
    const authorized = zalo.configured && zalo.hasToken && !zalo.needsReauth && !zalo.tokenError;
    const failing = authorized && Boolean(zalo.lastError);
    const connected = authorized && !failing;
    status.textContent = !zalo.configured ? "Chưa cấu hình" : failing ? "Gửi lỗi" : connected ? "Đang kết nối" : "Mất kết nối";
    status.dataset.state = !zalo.configured ? "off" : connected ? "ok" : "error";
    checkButton.hidden = !zalo.configured;
    if (!zalo.configured) detail.textContent = "Server chưa có đủ cấu hình ZALO_* (mã ứng dụng, khóa bí mật, nhóm nhận thông báo).";
    else if (zalo.tokenError) detail.textContent = "Không đọc được token Zalo đã lưu. Bấm \"Cấp quyền lại Zalo OA\" để kết nối lại.";
    else if (!authorized) detail.textContent = "Thông báo Zalo đang tạm dừng. Bấm \"Cấp quyền lại Zalo OA\", đăng nhập Zalo quản lý OA và chọn Cho phép.";
    else if (failing) detail.textContent = `Lần gửi lúc ${formatTime(zalo.lastError.at)} thất bại: ${zalo.lastError.message} Bấm "Kiểm tra kết nối" để thử lại.`;
    else if (zalo.expiresAt && zalo.expiresAt < Date.now()) detail.textContent = `Token đã hết hạn lúc ${formatTime(zalo.expiresAt)}; hệ thống sẽ làm mới ở lần gửi tiếp theo. Bấm "Kiểm tra kết nối" để làm mới ngay.`;
    else detail.textContent = zalo.expiresAt ? `Token hiện tại hiệu lực đến ${formatTime(zalo.expiresAt)}, hệ thống tự làm mới.` : "Hệ thống tự làm mới token khi cần.";
    if (connected && zalo.lastSuccessAt) detail.textContent += ` Gửi thành công gần nhất: ${formatTime(zalo.lastSuccessAt)}.`;
  };
  checkButton.addEventListener("click", async () => {
    checkButton.disabled = true;
    checkButton.textContent = "Đang kiểm tra...";
    try {
      const response = await fetch("/api/zalo/check", { method: "POST" });
      if (!response.ok) throw new Error();
      render(await response.json());
    } catch {
      detail.textContent = "Không kiểm tra được kết nối Zalo. Vui lòng thử lại.";
    } finally {
      checkButton.disabled = false;
      checkButton.textContent = "Kiểm tra kết nối";
    }
  });
  const resendPanel = section.querySelector("[data-zalo-resend]");
  const resendSelect = section.querySelector("[data-zalo-resend-select]");
  const resendButton = section.querySelector("[data-zalo-resend-submit]");
  const resendFeedback = section.querySelector("[data-zalo-resend-feedback]");
  const typeLabels = { late: "Đi trễ", "early-leave": "Về sớm", "half-day": "Nửa ngày", leave: "Nghỉ phép", "unauthorized-leave": "Nghỉ không phép", payment: "Thanh toán" };
  const statusLabel = (item) => item.status === "approved" ? "Đã duyệt" : item.paymentStage === "accounting" ? "Chờ kế toán" : "Chờ duyệt";
  const loadResendCandidates = async () => {
    const response = await fetch("/api/zalo/resend-candidates", { cache: "no-store" });
    if (!response.ok) throw new Error();
    const { candidates } = await response.json();
    resendSelect.replaceChildren(...(candidates.length ? candidates.map((item) => new Option([
      item.zaloFailed ? "⚠ Gửi lỗi" : "",
      typeLabels[item.type] || item.type,
      item.userName,
      item.amount ? `${Number(item.amount).toLocaleString("vi-VN")}đ` : "",
      formatTime(item.createdAt),
      statusLabel(item),
    ].filter(Boolean).join(" · "), item.id)) : [new Option("Không có đề xuất nào trong 30 ngày gần đây", "")]));
    resendButton.disabled = !candidates.length;
  };
  resendButton.addEventListener("click", async () => {
    if (!resendSelect.value) return;
    resendButton.disabled = true;
    resendButton.textContent = "Đang gửi...";
    try {
      const response = await fetch(`/api/proposals/${encodeURIComponent(resendSelect.value)}/zalo-resend`, { method: "POST" });
      if (!response.ok) throw new Error(await response.text() || "Không gửi lại được thông báo Zalo.");
      resendFeedback.textContent = "Đã gửi lại thông báo lên Zalo.";
      resendFeedback.dataset.state = "ok";
      await loadResendCandidates();
    } catch (error) {
      resendFeedback.textContent = error.message || "Không gửi lại được thông báo Zalo.";
      resendFeedback.dataset.state = "error";
    } finally {
      resendButton.disabled = !resendSelect.value;
      resendButton.textContent = "Gửi lại";
    }
  });
  try {
    const response = await fetch("/api/zalo/status", { cache: "no-store" });
    if (!response.ok) return;
    section.hidden = false;
    const zalo = await response.json();
    render(zalo);
    if (zalo.configured) loadResendCandidates().then(() => { resendPanel.hidden = false; }, () => {});
    if (new URLSearchParams(location.search).get("zalo") === "connected") {
      detail.textContent = "Đã kết nối lại Zalo OA thành công. " + detail.textContent;
      section.scrollIntoView({ block: "center" });
      history.replaceState(null, "", location.pathname);
    }
  } catch {}
})();
