const query = new URLSearchParams(window.location.search);
const nodeId = query.get("node");
const memberId = query.get("member");
const memberName = document.querySelector("[data-member-name]");
const memberTitle = document.querySelector("[data-member-title]");
const breadcrumbCurrent = document.querySelector(".breadcrumbs strong");
const memberAvatar = document.querySelector("[data-member-avatar]");
const memberView = document.querySelector("[data-member-view]");
const memberForm = document.querySelector("[data-member-form]");
const memberEdit = document.querySelector("[data-member-edit]");
const memberDelete = document.querySelector("[data-member-delete]");
const memberCancel = document.querySelector("[data-member-cancel]");
const memberStatus = document.querySelector("[data-member-status]");
const appShell = document.querySelector(".app-shell");
const sidebarToggle = document.querySelector(".sidebar-toggle");
const memberHeader = document.querySelector(".member-profile-heading");

document.querySelector(".profile-content > .profile-back-link")?.remove();

document.querySelector(".topbar").innerHTML = '<button class="mobile-menu-toggle" type="button" data-mobile-menu-toggle aria-label="Mở menu" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button><div class="breadcrumbs"><button class="navigation-arrow" type="button" data-history-back aria-label="Quay lại"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button><span>Quy Trình</span><span class="crumb-separator">/</span><strong>Hồ sơ thành viên</strong></div><label class="search-box"><svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 5 5" /></svg><input type="search" placeholder="Tìm phòng ban, chức danh..." aria-label="Tìm phòng ban, chức danh" /></label><div class="top-actions"><div class="role-switch" aria-label="Vai trò"><button class="role-chip is-selected" type="button">Quản trị</button><button class="role-chip" type="button">Nhân viên</button></div><button class="top-icon" type="button" data-theme-trigger aria-label="Đổi giao diện sáng tối"><svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 1 0 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" /></svg></button><button class="top-avatar" type="button" data-top-avatar aria-label="Mở thông tin tài khoản">B</button></div>';
const descriptionField = memberForm?.elements.description?.closest("label");
const titleField = memberForm?.elements.title?.closest("label");
if (descriptionField && titleField) {
  descriptionField.firstChild.textContent = "Công việc";
  titleField.after(descriptionField);
}

document.querySelector(".topbar").innerHTML = '<button class="mobile-menu-toggle" type="button" data-mobile-menu-toggle aria-label="Mở menu" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button><div class="breadcrumbs"><button class="navigation-arrow" type="button" data-history-back aria-label="Quay lại"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button><span>Quy Trình</span><span class="crumb-separator">/</span><strong>Hồ sơ thành viên</strong></div><label class="search-box"><svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 5 5" /></svg><input type="search" placeholder="Tìm phòng ban, chức danh..." aria-label="Tìm phòng ban, chức danh" /></label><div class="top-actions"><div class="role-switch" aria-label="Vai trò"><button class="role-chip is-selected" type="button">Quản trị</button><button class="role-chip" type="button">Nhân viên</button></div><button class="top-icon" type="button" data-theme-trigger aria-label="Đổi giao diện sáng tối"><svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 1 0 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" /></svg></button><button class="top-avatar" type="button" data-top-avatar aria-label="Mở thông tin tài khoản">B</button></div>';
document.querySelector(".top-actions .role-switch")?.insertAdjacentHTML("afterend", '<button class="top-icon notification-icon" type="button" data-notification-trigger aria-label="Thông báo"><svg class="bell-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg><b data-notification-count>3</b></button>');
document.querySelector("[data-theme-trigger]").insertAdjacentHTML("afterend", '<button class="top-icon" type="button" data-color-trigger aria-label="Đổi màu giao diện"><svg class="palette-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0 0 18h1.2a1.8 1.8 0 0 0 0-3.6h-.7a1.8 1.8 0 0 1 0-3.6H15a6 6 0 0 0 0-12H12Z" /><circle cx="7.5" cy="10" r="1" /><circle cx="10" cy="6.8" r="1" /><circle cx="14" cy="6.8" r="1" /></svg></button>');
  document.querySelectorAll(".theme-icon path").forEach((path) => path.setAttribute("d", "M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"));
const mobileMenuToggle = document.querySelector("[data-mobile-menu-toggle]");
const mobileMenuBackdrop = document.querySelector("[data-mobile-menu-backdrop]");
document.querySelector(".topbar .navigation-arrow")?.remove();

function applySavedPalette() {
  const palette = JSON.parse(localStorage.getItem("gusa-palette") || "null");
  document.documentElement.style.setProperty("--navy", palette?.primary || "#174b8e");
  document.documentElement.style.setProperty("--blue-100", palette?.surface || "#eaf2fa");
}

applySavedPalette();

const notificationMenu = document.createElement("div");
notificationMenu.className = "notification-menu";
notificationMenu.hidden = true;
notificationMenu.innerHTML = '<strong>Thông báo</strong><div class="notification-list"><p><b>Phê duyệt tài khoản</b><span>Có tài khoản mới chờ xử lý</span></p><p><b>Cập nhật hệ thống</b><span>Quy trình vừa được cập nhật</span></p><p><b>Nhiệm vụ mới</b><span>Bạn có nhiệm vụ cần xem</span></p></div>';
const colorMenu = document.createElement("div");
colorMenu.className = "color-menu";
colorMenu.hidden = true;
colorMenu.innerHTML = '<strong>Màu giao diện</strong><div class="color-swatches"><button type="button" class="color-swatch palette-blue" data-theme-primary="#174b8e" data-theme-surface="#eaf2fa" aria-label="Bảng màu xanh dương"></button><button type="button" class="color-swatch palette-green" data-theme-primary="#247a58" data-theme-surface="#e9f5ef" aria-label="Bảng màu xanh lá"></button><button type="button" class="color-swatch palette-red" data-theme-primary="#a44848" data-theme-surface="#f9eded" aria-label="Bảng màu đỏ"></button></div>';
const profileMenu = document.createElement("div");
profileMenu.className = "profile-menu";
profileMenu.hidden = true;
profileMenu.innerHTML = '<div class="profile-header"><div class="profile-avatar" data-profile-avatar>B</div><div><strong data-profile-name>Tài khoản Google</strong><small data-profile-email></small></div></div><div class="profile-role" data-profile-role>Nhân viên</div><a class="profile-logout" href="/auth/logout">Đăng xuất</a>';
document.querySelector(".workspace").append(notificationMenu, colorMenu, profileMenu);
document.querySelector("[data-notification-trigger]")?.addEventListener("click", (event) => { event.stopPropagation(); notificationMenu.hidden = !notificationMenu.hidden; colorMenu.hidden = true; profileMenu.hidden = true; });
document.querySelector("[data-color-trigger]")?.addEventListener("click", (event) => { event.stopPropagation(); colorMenu.hidden = !colorMenu.hidden; notificationMenu.hidden = true; profileMenu.hidden = true; });
document.querySelector("[data-top-avatar]")?.addEventListener("click", (event) => { event.stopPropagation(); profileMenu.hidden = !profileMenu.hidden; notificationMenu.hidden = true; colorMenu.hidden = true; });
document.querySelectorAll("[data-theme-primary]").forEach((button) => button.addEventListener("click", () => { document.documentElement.style.setProperty("--navy", button.dataset.themePrimary); document.documentElement.style.setProperty("--blue-100", button.dataset.themeSurface); localStorage.setItem("gusa-palette", JSON.stringify({ primary: button.dataset.themePrimary, surface: button.dataset.themeSurface })); colorMenu.hidden = true; }));
document.addEventListener("click", (event) => { if (!profileMenu.contains(event.target) && !event.target.closest("[data-top-avatar]")) profileMenu.hidden = true; if (!notificationMenu.contains(event.target) && !event.target.closest("[data-notification-trigger]")) notificationMenu.hidden = true; if (!colorMenu.contains(event.target) && !event.target.closest("[data-color-trigger]")) colorMenu.hidden = true; });

function ensureInterfaceSettingsMenu() {
  const sidebarScroll = document.querySelector(".sidebar-scroll");
  if (!sidebarScroll || sidebarScroll.querySelector('a[href="interface-settings.html"]')) return;
  const label = document.createElement("p");
  label.className = "menu-label";
  label.textContent = "CÀI ĐẶT";
  const menu = document.createElement("nav");
  menu.className = "menu";
  const link = document.createElement("a");
  link.className = "menu-item";
  link.href = "interface-settings.html";
  link.innerHTML = '<span class="menu-icon">⚙</span><span>Cài đặt giao diện</span>';
  menu.append(link);
  const adminLabel = sidebarScroll.querySelector(".menu-label:nth-of-type(2)");
  sidebarScroll.insertBefore(label, adminLabel);
  sidebarScroll.insertBefore(menu, adminLabel);
}

ensureInterfaceSettingsMenu();
let member;
let isAdmin = false;

memberHeader.append(memberView);
const adminMenu = document.querySelector(".sidebar-scroll nav:last-of-type");
if (adminMenu) adminMenu.hidden = true;
if (adminMenu?.previousElementSibling) adminMenu.previousElementSibling.hidden = true;

async function syncAccountRole() {
  const response = await fetch("/api/me", { cache: "no-store" });
  if (!response.ok) return;
  const user = (await response.json()).user;
  if (!user) return;
  const admin = user.role === "admin";
  document.querySelectorAll("[data-user-name], .sidebar-account strong").forEach((element) => { element.textContent = user.name || user.email; });
  document.querySelectorAll("[data-user-avatar], .sidebar-account .avatar").forEach((element) => {
    if (!user.picture) return;
    const image = document.createElement("img");
    image.src = user.picture;
    image.alt = `Ảnh đại diện của ${user.name || user.email}`;
    element.replaceChildren(image);
  });
  document.querySelectorAll(".sidebar-account small, [data-user-role]").forEach((element) => {
    element.textContent = admin ? "Quản trị viên" : "Nhân viên";
  });
  document.querySelectorAll(".role-chip").forEach((button) => {
    const isCurrentRole = button.textContent.trim() === (admin ? "Quản trị" : "Nhân viên");
    button.hidden = !isCurrentRole;
    button.classList.toggle("is-selected", isCurrentRole);
  });
  if (user.picture) {
    const topAvatar = document.querySelector("[data-top-avatar]");
    const image = document.createElement("img");
    image.src = user.picture;
    image.referrerPolicy = "no-referrer";
    image.alt = `Ảnh đại diện của ${user.name || user.email}`;
    topAvatar.replaceChildren(image);
  }
  if (adminMenu) adminMenu.hidden = !admin;
  if (adminMenu?.previousElementSibling) adminMenu.previousElementSibling.hidden = !admin;
  memberEdit.hidden = !admin;
  memberDelete.hidden = !admin;
}

if (localStorage.getItem("gusa-sidebar-collapsed") === "true") appShell.classList.add("is-collapsed");

function setMobileMenu(open) {
  appShell.classList.toggle("is-mobile-menu-open", open);
  mobileMenuBackdrop.hidden = !open;
  mobileMenuToggle.setAttribute("aria-expanded", String(open));
}

mobileMenuToggle.addEventListener("click", () => setMobileMenu(!appShell.classList.contains("is-mobile-menu-open")));
mobileMenuBackdrop.addEventListener("click", () => setMobileMenu(false));

sidebarToggle.addEventListener("click", () => {
  const collapsed = appShell.classList.toggle("is-collapsed");
  localStorage.setItem("gusa-sidebar-collapsed", String(collapsed));
});

function showAvatar() {
  memberAvatar.replaceChildren();
  if (member.avatar) {
    const image = document.createElement("img");
    image.src = member.avatar;
    image.alt = `Ảnh đại diện của ${member.name}`;
    memberAvatar.append(image);
  } else memberAvatar.textContent = member.name.charAt(0).toUpperCase();
}

function showMember() {
  showAvatar();
  memberName.textContent = member.name;
  memberTitle.textContent = `Chức danh: ${member.title || "Chưa cập nhật"}`;
  document.querySelector("[data-member-email]").textContent = member.email || "Chưa cập nhật";
  document.querySelector("[data-member-phone]").textContent = member.phone || "Chưa cập nhật";
  document.querySelector("[data-member-work-years]").textContent = member.workYears ? `${member.workYears} năm làm việc` : "Chưa cập nhật";
  const statusBadge = document.querySelector("[data-member-status-badge]");
  const status = member.status || "working";
  statusBadge.className = `member-status member-status-${status}`;
  statusBadge.textContent = { working: "Đang làm việc", leave: "Nghỉ phép", former: "Đã nghỉ việc" }[status];
  document.querySelector("[data-member-description]").textContent = member.description || "Chưa cập nhật";
  memberView.hidden = false;
  memberForm.hidden = true;
  memberEdit.hidden = !isAdmin;
  memberDelete.hidden = !isAdmin;
}

function openForm() {
  ["name", "title", "email", "phone", "workYears", "status", "description"].forEach((key) => {
    memberForm.elements[key].value = member[key] || "";
  });
  memberForm.elements.avatar.value = "";
  memberForm.dataset.currentAvatar = member.avatar || "";
  memberView.hidden = true;
  memberForm.hidden = false;
  memberEdit.hidden = true;
  memberForm.elements.name.focus();
}

async function loadPage() {
  if (!nodeId || !memberId) throw new Error("Thiếu thông tin thành viên");
  const [chartResponse, membersResponse, meResponse] = await Promise.all([fetch("/api/organization-chart"), fetch(`/api/organization-members/${encodeURIComponent(nodeId)}`), fetch("/api/me")]);
  if ([chartResponse, membersResponse, meResponse].some((response) => response.status === 403)) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  if (![chartResponse, membersResponse, meResponse].every((response) => response.ok)) throw new Error("Không thể tải hồ sơ thành viên.");
  const chart = await chartResponse.json();
  const members = await membersResponse.json();
  const me = await meResponse.json();
  const node = (chart.nodes || []).find((item) => item.id === nodeId);
  member = (members.members || []).find((item) => item.id === memberId);
  if (!node || !member) throw new Error("Không tìm thấy thành viên");
  isAdmin = me.user?.role === "admin";
  document.querySelector("[data-back-link]")?.setAttribute("href", `organization-profile.html?node=${encodeURIComponent(nodeId)}`);
  breadcrumbCurrent.textContent = `Sơ đồ tổ chức / ${node.name} / ${member.name}`;
  showMember();
}

memberEdit.addEventListener("click", openForm);
memberDelete.addEventListener("click", async () => {
  if (!window.confirm(`Xóa hồ sơ của ${member.name}?`)) return;
  memberStatus.textContent = "Đang xóa hồ sơ...";
  const response = await fetch(`/api/organization-members/${encodeURIComponent(nodeId)}/${encodeURIComponent(memberId)}`, { method: "DELETE" });
  if (response.status === 403) {
    memberStatus.textContent = "Bạn không có quyền xóa hồ sơ.";
    return;
  }
  if (!response.ok) {
    memberStatus.textContent = "Không thể xóa hồ sơ.";
    return;
  }
  window.location.href = `organization-profile.html?node=${encodeURIComponent(nodeId)}`;
});
memberCancel.addEventListener("click", showMember);
memberForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  memberStatus.textContent = "Đang lưu hồ sơ...";
  const payload = Object.fromEntries(new FormData(memberForm));
  const avatarFile = memberForm.elements.avatar.files[0];
  if (avatarFile) {
    if (avatarFile.size > 5 * 1024 * 1024) {
      memberStatus.textContent = "Ảnh đại diện không được vượt quá 5 MB.";
      return;
    }
    payload.avatar = await readFileAsDataUrl(avatarFile);
  } else payload.avatar = memberForm.dataset.currentAvatar || "";
  payload.id = memberId;
  const response = await fetch(`/api/organization-members/${encodeURIComponent(nodeId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ member: payload }) });
  if (response.status === 403) {
    memberStatus.textContent = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    return;
  }
  if (!response.ok) {
    memberStatus.textContent = "Không thể lưu hồ sơ.";
    return;
  }
  member = (await response.json()).member;
  memberStatus.textContent = "Đã lưu hồ sơ thành viên.";
  showMember();
});

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

document.querySelector("[data-history-back]")?.addEventListener("click", () => history.back());
document.body.dataset.theme = localStorage.getItem("gusa-theme") || "light";
document.querySelector("[data-theme-trigger]").addEventListener("click", () => { document.body.dataset.theme = document.body.dataset.theme === "dark" ? "light" : "dark"; localStorage.setItem("gusa-theme", document.body.dataset.theme); });
syncAccountRole();
loadPage().catch((error) => { memberStatus.textContent = error.message || "Không thể tải hồ sơ."; });
