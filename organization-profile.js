const query = new URLSearchParams(window.location.search);
const nodeId = query.get("node");
const nodeName = document.querySelector("[data-node-name]");
const nodeRole = document.querySelector("[data-node-role]");
const breadcrumbCurrent = document.querySelector(".breadcrumbs strong");
const profileStatus = document.querySelector("[data-profile-status]");
const memberList = document.querySelector("[data-member-list]");
const memberAdd = document.querySelector("[data-member-add]");
const memberForm = document.querySelector("[data-member-form]");
const memberCancel = document.querySelector("[data-member-cancel]");
const memberStatus = document.querySelector("[data-member-status]");
const topSearch = document.querySelector(".search-box input");
const memberStatusFilter = document.querySelector("[data-member-status-filter]");
const appShell = document.querySelector(".app-shell");
const sidebarToggle = document.querySelector(".sidebar-toggle");
const mobileMenuToggle = document.querySelector("[data-mobile-menu-toggle]");
const mobileMenuBackdrop = document.querySelector("[data-mobile-menu-backdrop]");

document.querySelector(".breadcrumbs .navigation-arrow")?.remove();

function ensureTopbarActions() {
  const actions = document.querySelector(".top-actions");
  if (!actions || actions.querySelector("[data-notification-trigger]")) return;
  const roleSwitch = actions.querySelector(".role-switch");
  roleSwitch?.insertAdjacentHTML("afterend", '<button class="top-icon notification-icon" type="button" data-notification-trigger aria-label="Thông báo"><svg class="bell-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg><b data-notification-count>3</b></button>');
  const theme = actions.querySelector("[data-theme-trigger]");
  theme?.insertAdjacentHTML("afterend", '<button class="top-icon" type="button" data-color-trigger aria-label="Đổi màu giao diện"><svg class="palette-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0 0 18h1.2a1.8 1.8 0 0 0 0-3.6h-.7a1.8 1.8 0 0 1 0-3.6H15a6 6 0 0 0 0-12H12Z" /><circle cx="7.5" cy="10" r="1" /><circle cx="10" cy="6.8" r="1" /><circle cx="14" cy="6.8" r="1" /></svg></button>');
}

ensureTopbarActions();

function applySavedPalette() {
  const palette = JSON.parse(localStorage.getItem("gusa-palette") || "null");
  document.documentElement.style.setProperty("--navy", palette?.primary || "#174b8e");
  document.documentElement.style.setProperty("--blue-100", palette?.surface || "#eaf2fa");
}

applySavedPalette();

const profileMenu = document.createElement("div");
profileMenu.className = "profile-menu";
profileMenu.hidden = true;
profileMenu.innerHTML = '<div class="profile-header"><div class="profile-avatar" data-profile-avatar>B</div><div><strong data-profile-name>Tài khoản Google</strong><small data-profile-email></small></div></div><div class="profile-role" data-profile-role>Nhân viên</div><a class="profile-logout" href="/auth/logout">Đăng xuất</a>';
const notificationMenu = document.createElement("div");
notificationMenu.className = "notification-menu";
notificationMenu.hidden = true;
notificationMenu.innerHTML = '<strong>Thông báo</strong><div class="notification-list"><p><b>Phê duyệt tài khoản</b><span>Có tài khoản mới chờ xử lý</span></p><p><b>Cập nhật hệ thống</b><span>Quy trình vừa được cập nhật</span></p><p><b>Nhiệm vụ mới</b><span>Bạn có nhiệm vụ cần xem</span></p></div>';
const colorMenu = document.createElement("div");
colorMenu.className = "color-menu";
colorMenu.hidden = true;
colorMenu.innerHTML = '<strong>Màu giao diện</strong><div class="color-swatches"><button type="button" class="color-swatch palette-blue" data-theme-primary="#174b8e" data-theme-surface="#eaf2fa" aria-label="Bảng màu xanh dương"></button><button type="button" class="color-swatch palette-green" data-theme-primary="#247a58" data-theme-surface="#e9f5ef" aria-label="Bảng màu xanh lá"></button><button type="button" class="color-swatch palette-brown" data-theme-primary="#75483f" data-theme-surface="#f5eeeb" aria-label="Bảng màu nâu"></button><button type="button" class="color-swatch palette-red" data-theme-primary="#a44848" data-theme-surface="#f9eded" aria-label="Bảng màu đỏ"></button><button type="button" class="color-swatch palette-indigo" data-theme-primary="#5b4aa8" data-theme-surface="#efedfb" aria-label="Bảng màu chàm"></button><button type="button" class="color-swatch palette-teal" data-theme-primary="#167b83" data-theme-surface="#e6f5f5" aria-label="Bảng màu xanh ngọc"></button></div>';
document.querySelector(".workspace").append(notificationMenu, colorMenu, profileMenu);

document.querySelector("[data-notification-trigger]")?.addEventListener("click", (event) => {
  event.stopPropagation();
  notificationMenu.hidden = !notificationMenu.hidden;
  colorMenu.hidden = true;
  profileMenu.hidden = true;
});
document.querySelector("[data-color-trigger]")?.addEventListener("click", (event) => {
  event.stopPropagation();
  colorMenu.hidden = !colorMenu.hidden;
  notificationMenu.hidden = true;
  profileMenu.hidden = true;
});
document.querySelector("[data-top-avatar]")?.addEventListener("click", (event) => {
  event.stopPropagation();
  profileMenu.hidden = !profileMenu.hidden;
  notificationMenu.hidden = true;
  colorMenu.hidden = true;
});
document.querySelectorAll("[data-theme-primary]").forEach((button) => {
  button.addEventListener("click", () => {
    document.documentElement.style.setProperty("--navy", button.dataset.themePrimary);
    document.documentElement.style.setProperty("--blue-100", button.dataset.themeSurface);
    localStorage.setItem("gusa-palette", JSON.stringify({ primary: button.dataset.themePrimary, surface: button.dataset.themeSurface }));
    colorMenu.hidden = true;
  });
});
document.addEventListener("click", (event) => {
  if (!profileMenu.contains(event.target) && !event.target.closest("[data-top-avatar]")) profileMenu.hidden = true;
  if (!notificationMenu.contains(event.target) && !event.target.closest("[data-notification-trigger]")) notificationMenu.hidden = true;
  if (!colorMenu.contains(event.target) && !event.target.closest("[data-color-trigger]")) colorMenu.hidden = true;
});

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
let isAdmin = false;
let members = [];
const statusLabels = { working: "Đang làm việc", leave: "Nghỉ phép", former: "Đã nghỉ việc" };
const adminMenu = document.querySelector(".sidebar-scroll nav:last-of-type");
if (adminMenu) adminMenu.hidden = true;
if (adminMenu?.previousElementSibling) adminMenu.previousElementSibling.hidden = true;

async function syncAccountRole() {
  const response = await fetch("/api/me", { cache: "no-store" });
  if (!response.ok) return;
  const user = (await response.json()).user;
  if (!user) return;
  const admin = user.role === "admin" || user.role === "ceo";
  document.querySelectorAll("[data-user-name], .sidebar-account strong").forEach((element) => { element.textContent = user.name || user.email; });
  document.querySelectorAll("[data-user-avatar], .sidebar-account .avatar").forEach((element) => {
    if (!user.picture) return;
    const image = document.createElement("img");
    image.src = user.picture;
    image.alt = `Ảnh đại diện của ${user.name || user.email}`;
    element.replaceChildren(image);
  });
  document.querySelectorAll(".sidebar-account small, [data-user-role]").forEach((element) => {
    element.textContent = user.role === "ceo" ? "CEO" : admin ? "Quản trị viên" : "Nhân viên";
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
  document.querySelector("[data-profile-name]").textContent = user.name || user.email || "Tài khoản Google";
  document.querySelector("[data-profile-email]").textContent = user.email || "";
  document.querySelector("[data-profile-role]").textContent = user.role === "ceo" ? "CEO" : admin ? "Quản trị viên" : "Nhân viên";
  if (user.picture) {
    const profileImage = document.createElement("img");
    profileImage.src = user.picture;
    profileImage.referrerPolicy = "no-referrer";
    profileImage.alt = `Ảnh đại diện của ${user.name || user.email}`;
    document.querySelector("[data-profile-avatar]").replaceChildren(profileImage);
  }
  if (adminMenu) adminMenu.hidden = !admin;
  if (adminMenu?.previousElementSibling) adminMenu.previousElementSibling.hidden = !admin;
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

function setTheme() {
  document.body.dataset.theme = localStorage.getItem("gusa-theme") || "light";
  document.querySelector("[data-theme-trigger]").addEventListener("click", () => {
    document.body.dataset.theme = document.body.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("gusa-theme", document.body.dataset.theme);
  });
}

function memberAvatar(member) {
  if (member.avatar) {
    const image = document.createElement("img");
    image.src = member.avatar;
    image.alt = `Ảnh đại diện của ${member.name}`;
    image.addEventListener("error", () => image.replaceWith(document.createTextNode(member.name.charAt(0).toUpperCase())));
    return image;
  }
  return document.createTextNode(member.name.charAt(0).toUpperCase());
}

function renderMembers() {
  memberList.replaceChildren();
  if (!members.length) {
    memberList.innerHTML = "<p class=\"member-empty\">Chưa có thành viên trong phòng ban này.</p>";
    return;
  }
    const queryText = topSearch?.value.trim().toLowerCase() || "";
    const selectedStatus = memberStatusFilter.value;
  const filteredMembers = members.filter((member) => {
      const matchesText = `${member.name} ${member.title} ${member.email}`.toLowerCase().includes(queryText);
    const matchesStatus = selectedStatus === "all" || (member.status || "working") === selectedStatus;
      return matchesText && matchesStatus;
  });
  if (!filteredMembers.length) {
    memberList.innerHTML = "<p class=\"member-empty\">Chưa có thành viên phù hợp.</p>";
    return;
  }
  filteredMembers.forEach((member) => {
    const link = document.createElement("a");
    link.className = "member-card";
    link.href = `organization-member-profile.html?node=${encodeURIComponent(nodeId)}&member=${encodeURIComponent(member.id)}`;
    const avatar = document.createElement("span");
    avatar.className = "member-avatar";
    avatar.append(memberAvatar(member));
    const body = document.createElement("span");
    body.className = "member-card-body";
    const identity = document.createElement("span");
    identity.className = "member-card-identity";
    const name = document.createElement("strong");
    name.textContent = member.name;
    const title = document.createElement("small");
    title.className = "member-card-title";
    title.textContent = `Chức danh: ${member.title || "Chưa cập nhật"}`;
    const contact = document.createElement("span");
    contact.textContent = member.email || member.phone || "Chưa có thông tin liên hệ";
    const workTime = document.createElement("span");
    workTime.className = "member-card-work-time";
    workTime.textContent = member.workYears ? `${member.workYears} năm làm việc` : "Chưa cập nhật số năm làm việc";
    identity.append(name, title, contact);
    identity.append(workTime);
    const status = document.createElement("span");
    status.className = `member-status member-status-${member.status || "working"}`;
    status.textContent = statusLabels[member.status || "working"];
    identity.append(status);
    const description = document.createElement("span");
    description.className = "member-card-description";
    description.textContent = member.description || "Chưa có mô tả công việc";
    body.append(identity, description);
    link.append(avatar, body);
    if (isAdmin) {
      const edit = document.createElement("span");
      edit.className = "member-card-edit";
      edit.textContent = "›";
      link.append(edit);
    }
    memberList.append(link);
  });
}

function openMemberForm(member = null) {
  ["id", "name", "title", "email", "phone", "workYears", "status", "description"].forEach((key) => {
    memberForm.elements[key].value = member?.[key] || "";
  });
  memberForm.elements.avatar.value = "";
  memberForm.dataset.currentAvatar = member?.avatar || "";
  memberForm.elements.status.value = member?.status || "working";
  memberForm.hidden = false;
  memberList.hidden = true;
  memberAdd.hidden = true;
  memberForm.elements.name.focus();
}

async function loadPage() {
  if (!nodeId) throw new Error("Thiếu vị trí cần xem");
  const [chartResponse, membersResponse, meResponse] = await Promise.all([
    fetch("/api/organization-chart", { cache: "no-store" }),
    fetch(`/api/organization-members/${encodeURIComponent(nodeId)}`, { cache: "no-store" }),
    fetch("/api/me", { cache: "no-store" }),
  ]);
  if ([chartResponse, membersResponse, meResponse].some((response) => response.status === 403)) {
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }
  if (![chartResponse, membersResponse, meResponse].every((response) => response.ok)) throw new Error("Không thể tải dữ liệu thành viên.");
  const chart = await chartResponse.json();
  const membersData = await membersResponse.json();
  const me = await meResponse.json();
  const node = (chart.nodes || []).find((item) => item.id === nodeId);
  if (!node) throw new Error("Không tìm thấy vị trí");
  isAdmin = me.user?.role === "admin" || me.user?.role === "ceo";
  members = membersData.members || [];
  nodeName.textContent = node.name;
  nodeRole.textContent = node.role || "Hồ sơ vị trí trong sơ đồ tổ chức";
  breadcrumbCurrent.textContent = `Sơ đồ tổ chức / ${node.name}`;
  memberAdd.hidden = !isAdmin;
  renderMembers();
}

window.addEventListener("pageshow", (event) => {
  if (event.persisted) loadPage().catch((error) => {
    profileStatus.textContent = error.message || "Không thể tải dữ liệu thành viên.";
  });
});

memberAdd.addEventListener("click", () => openMemberForm());
memberStatusFilter.addEventListener("change", renderMembers);
topSearch?.addEventListener("input", renderMembers);
memberCancel.addEventListener("click", () => {
  memberForm.hidden = true;
  memberList.hidden = false;
  memberAdd.hidden = !isAdmin;
});
memberForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  memberStatus.textContent = "Đang lưu thành viên...";
  const member = Object.fromEntries(new FormData(memberForm));
  const avatarFile = memberForm.elements.avatar.files[0];
  if (avatarFile) {
    if (avatarFile.size > 5 * 1024 * 1024) {
      memberStatus.textContent = "Ảnh đại diện không được vượt quá 5 MB.";
      return;
    }
    member.avatar = await readFileAsDataUrl(avatarFile);
  } else {
    member.avatar = memberForm.dataset.currentAvatar || "";
  }
  const response = await fetch(`/api/organization-members/${encodeURIComponent(nodeId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ member }),
  });
  if (response.status === 403) {
    memberStatus.textContent = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    return;
  }
  if (!response.ok) {
    memberStatus.textContent = "Không thể lưu thành viên.";
    return;
  }
  members = (await response.json()).members;
  memberForm.hidden = true;
  memberList.hidden = false;
  memberAdd.hidden = !isAdmin;
  memberStatus.textContent = "Đã lưu hồ sơ thành viên.";
  renderMembers();
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
setTheme();
syncAccountRole();
loadPage().catch((error) => {
  profileStatus.textContent = error.message || "Không thể tải hồ sơ.";
});
