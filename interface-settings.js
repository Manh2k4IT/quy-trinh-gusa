const appShell = document.querySelector(".app-shell");
const mobileMenuToggle = document.querySelector("[data-mobile-menu-toggle]");
const mobileMenuBackdrop = document.querySelector("[data-mobile-menu-backdrop]");
const adminMenu = document.querySelector("[data-admin-menu]");
const adminMenuLabel = document.querySelector("[data-admin-menu-label]");
const themeToggle = document.querySelector("[data-interface-theme-toggle]");

const topAvatar = document.querySelector("[data-top-avatar]");
if (topAvatar && !document.querySelector("[data-notification-trigger]")) {
  topAvatar.insertAdjacentHTML("beforebegin", '<button class="top-icon notification-icon" type="button" data-notification-trigger aria-label="Thông báo"><svg class="bell-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg><b data-notification-count>3</b></button><button class="top-icon" type="button" data-theme-trigger aria-label="Đổi giao diện sáng tối"><svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 1 0 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" /></svg></button><button class="top-icon" type="button" data-color-trigger aria-label="Đổi màu giao diện"><svg class="palette-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0 0 18h1.2a1.8 1.8 0 0 0 0-3.6h-.7a1.8 1.8 0 0 1 0-3.6H15a6 6 0 0 0 0-12H12Z" /><circle cx="7.5" cy="10" r="1" /><circle cx="10" cy="6.8" r="1" /><circle cx="14" cy="6.8" r="1" /></svg></button>');
}
if (topAvatar && !document.querySelector("[data-notification-trigger]")) {
  topAvatar.insertAdjacentHTML("beforebegin", '<button class="top-icon notification-icon" type="button" data-notification-trigger aria-label="Thông báo"><svg class="bell-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg><b data-notification-count>3</b></button><button class="top-icon" type="button" data-theme-trigger aria-label="Đổi giao diện sáng tối"><svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 1 0 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" /></svg></button><button class="top-icon" type="button" data-color-trigger aria-label="Đổi màu giao diện"><svg class="palette-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0 0 18h1.2a1.8 1.8 0 0 0 0-3.6h-.7a1.8 1.8 0 0 1 0-3.6H15a6 6 0 0 0 0-12H12Z" /><circle cx="7.5" cy="10" r="1" /><circle cx="10" cy="6.8" r="1" /><circle cx="14" cy="6.8" r="1" /></svg></button>');
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
notificationMenu.innerHTML = '<strong>Thông báo</strong><div class="notification-list"><p><b>Phê duyệt tài khoản</b><span>Có tài khoản mới chờ xử lý</span></p><p><b>Cập nhật hệ thống</b><span>Quy trình vừa được cập nhật</span></p><p><b>Nhiệm vụ mới</b><span>Bạn có nhiệm vụ cần xem</span></p></div>';
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

document.querySelector("[data-sidebar-toggle]").addEventListener("click", () => {
  const collapsed = appShell.classList.toggle("is-collapsed");
  localStorage.setItem("gusa-sidebar-collapsed", String(collapsed));
});
if (localStorage.getItem("gusa-sidebar-collapsed") === "true") appShell.classList.add("is-collapsed");

function syncThemeToggle() {
  const isDark = document.body.dataset.theme === "dark";
  themeToggle.setAttribute("aria-checked", String(isDark));
  themeToggle.classList.toggle("is-on", isDark);
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
  });
});
const savedPalette = JSON.parse(localStorage.getItem("gusa-palette") || "null");
document.documentElement.style.setProperty("--navy", savedPalette?.primary || "#174b8e");
document.documentElement.style.setProperty("--blue-100", savedPalette?.surface || "#eaf2fa");

function setAdminMenuVisibility(isAdmin) {
  adminMenu.hidden = !isAdmin;
  adminMenuLabel.hidden = !isAdmin;
  document.querySelectorAll(".role-chip").forEach((button) => {
    const isCurrentRole = button.textContent.trim() === (isAdmin ? "Quản trị" : "Nhân viên");
    button.hidden = !isCurrentRole;
    button.classList.toggle("is-selected", isCurrentRole);
  });
}

fetch("/api/me", { cache: "no-store" })
  .then((response) => response.json())
  .then(({ user }) => {
    if (!user) return;
    const displayName = user.name || user.email || "Tài khoản Google";
    document.querySelectorAll("[data-user-name]").forEach((element) => { element.textContent = displayName; });
    document.querySelectorAll("[data-user-role]").forEach((element) => { element.textContent = user.role === "admin" ? "Quản trị viên" : "Nhân viên"; });
    setAdminMenuVisibility(user.role === "admin");
    document.querySelector("[data-settings-profile-name]").textContent = displayName;
    document.querySelector("[data-settings-profile-email]").textContent = user.email || "";
    document.querySelector("[data-settings-profile-role]").textContent = user.role === "admin" ? "Quản trị viên" : "Nhân viên";
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
