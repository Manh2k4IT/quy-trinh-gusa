const modal = document.querySelector("[data-google-modal]");
const emailInput = document.querySelector("#google-email");
const status = document.querySelector(".modal-status");
const adminMenu = document.querySelector("[aria-label='Menu quản trị']");

if (adminMenu) adminMenu.hidden = true;
if (adminMenu?.previousElementSibling?.classList.contains("menu-label")) adminMenu.previousElementSibling.hidden = true;

async function loadGoogleAvatar() {
  const response = await fetch("/api/me");
  if (!response.ok) return;
  const data = await response.json();
  if (!data.user) return;
  const isAdmin = data.user.role === "admin";
  document.querySelectorAll('a[href="attendance.html?view=days"]').forEach((link) => {
    link.hidden = isAdmin;
  });
  document.querySelectorAll('a[href="attendance-overview.html"], a[href="attendance-overview.html?report=online"], a[href="attendance-overview.html?report=late"]').forEach((link) => {
    link.hidden = !isAdmin;
  });
  document.querySelectorAll("[data-user-role]").forEach((element) => {
    element.textContent = isAdmin ? "Quản trị viên" : "Nhân viên";
  });
  document.querySelectorAll(".role-chip").forEach((button) => {
    const isCurrentRole = button.textContent.trim() === (isAdmin ? "Quản trị" : "Nhân viên");
    button.hidden = !isCurrentRole;
    button.classList.toggle("is-selected", isCurrentRole);
  });
  if (adminMenu) adminMenu.hidden = !isAdmin;
  if (adminMenu?.previousElementSibling?.classList.contains("menu-label")) {
    adminMenu.previousElementSibling.hidden = !isAdmin;
  }

  document.querySelectorAll("[data-user-avatar]").forEach((element) => {
    if (data.user.picture) {
      const image = document.createElement("img");
      image.src = data.user.picture;
      image.referrerPolicy = "no-referrer";
      image.alt = `Ảnh đại diện của ${data.user.name || data.user.email}`;
      element.replaceChildren(image);
    }
  });
  const nameElement = document.querySelector("[data-user-name]");
  if (nameElement) nameElement.textContent = data.user.name || data.user.email;

  document.querySelector("[data-profile-name]").textContent = data.user.name || "Tài khoản Google";
  document.querySelector("[data-profile-email]").textContent = data.user.email || "";
  document.querySelector("[data-profile-role]").textContent = isAdmin ? "Quản trị viên" : "Nhân viên";
  const profileAvatar = document.querySelector("[data-profile-avatar]");
  if (data.user.picture) {
    const image = document.createElement("img");
    image.src = data.user.picture;
    image.referrerPolicy = "no-referrer";
    image.alt = `Ảnh đại diện của ${data.user.name || data.user.email}`;
    profileAvatar.replaceChildren(image);
    const topAvatar = document.querySelector("[data-top-avatar]");
    const topImage = document.createElement("img");
    topImage.src = data.user.picture;
    topImage.referrerPolicy = "no-referrer";
    topImage.alt = `Ảnh đại diện của ${data.user.name || data.user.email}`;
    topAvatar.replaceChildren(topImage);
  }
}

const profileMenu = document.querySelector("[data-profile-menu]");
const notificationMenu = document.querySelector("[data-notification-menu]");
const colorMenu = document.querySelector("[data-color-menu]");
const notificationCount = document.querySelector("[data-notification-count]");
const appShell = document.querySelector(".app-shell");
const sidebarToggle = document.querySelector("[data-sidebar-toggle]");
const organizationMenuParent = document.querySelector(".menu-parent");
const organizationMenuToggle = document.querySelector("[data-organization-menu-toggle]");

function setMobileMenu(open) {
  appShell.classList.toggle("is-mobile-menu-open", open);
  mobileMenuBackdrop.hidden = !open;
  if (mobileMenuToggle) mobileMenuToggle.setAttribute("aria-expanded", String(open));

  if (open && window.matchMedia("(max-width: 600px)").matches) {
    appShell.classList.remove("is-collapsed");
    if (sidebarToggle) sidebarToggle.setAttribute("aria-label", "Thu gọn menu");
    localStorage.setItem("gusa-sidebar-collapsed", "false");
  }
}

if (organizationMenuParent && organizationMenuToggle) {
  const collapseOrganizationMenu = () => {
    organizationMenuParent.classList.add("is-collapsed");
    organizationMenuToggle.setAttribute("aria-expanded", "false");
    localStorage.setItem("gusa-organization-menu-collapsed", "true");
  };

  const toggleOrganizationMenu = () => {
    const collapsed = organizationMenuParent.classList.toggle("is-collapsed");
    organizationMenuToggle.setAttribute("aria-expanded", String(!collapsed));
    localStorage.setItem("gusa-organization-menu-collapsed", String(collapsed));
  };

  if (localStorage.getItem("gusa-organization-menu-collapsed") === "true") {
    collapseOrganizationMenu();
  }
  organizationMenuToggle.addEventListener("click", () => {
    toggleOrganizationMenu();
  });
  organizationMenuParent.querySelector(".menu-item").addEventListener("click", (event) => {
    const menuLink = event.currentTarget;
    const isMobile = window.matchMedia("(max-width: 600px)").matches;
    const isChartPage = window.location.pathname.endsWith("/organization-chart.html");

    if (isMobile) {
      if (isChartPage) {
        event.preventDefault();
        toggleOrganizationMenu();
        return;
      }

      event.preventDefault();
      setMobileMenu(false);
      localStorage.setItem("gusa-organization-menu-collapsed", "false");
      window.location.href = menuLink.href;
      return;
    }

    if (!isChartPage) {
      event.preventDefault();
      localStorage.setItem("gusa-organization-menu-collapsed", "false");
      window.location.href = menuLink.href;
      return;
    }

    event.preventDefault();
    toggleOrganizationMenu();
  });
  document.querySelectorAll(".menu-item, .menu-subitem").forEach((menuLink) => {
    menuLink.addEventListener("click", () => {
      if (!menuLink.closest(".menu-parent")) collapseOrganizationMenu();
    });
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".sidebar")) collapseOrganizationMenu();
  });
}

if (localStorage.getItem("gusa-sidebar-collapsed") === "true") {
  appShell.classList.add("is-collapsed");
}

sidebarToggle.addEventListener("click", () => {
  const collapsed = appShell.classList.toggle("is-collapsed");
  sidebarToggle.setAttribute("aria-label", collapsed ? "Mở rộng menu" : "Thu gọn menu");
  localStorage.setItem("gusa-sidebar-collapsed", String(collapsed));
});

if (notificationCount && Number(notificationCount.textContent) <= 0) {
  notificationCount.hidden = true;
}

function removeLogoWhiteBackground(image) {
  if (!image.complete || !image.naturalWidth) return;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];
    if (red > 238 && green > 238 && blue > 238) pixels.data[index + 3] = 0;
  }
  context.putImageData(pixels, 0, 0);
  image.src = canvas.toDataURL("image/png");
}

const sidebarLogo = document.querySelector(".mini-logo img");
if (sidebarLogo) {
  if (sidebarLogo.complete) removeLogoWhiteBackground(sidebarLogo);
  else sidebarLogo.addEventListener("load", () => removeLogoWhiteBackground(sidebarLogo), { once: true });
}

document.querySelector("[data-history-back]").addEventListener("click", () => history.back());
document.querySelector("[data-history-forward]").addEventListener("click", () => history.forward());

document.querySelector("[data-notification-trigger]").addEventListener("click", () => {
  notificationMenu.hidden = !notificationMenu.hidden;
  colorMenu.hidden = true;
  profileMenu.hidden = true;
});

document.querySelector("[data-theme-trigger]").addEventListener("click", () => {
  document.body.dataset.theme = document.body.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("gusa-theme", document.body.dataset.theme);
  notificationMenu.hidden = true;
  colorMenu.hidden = true;
});

document.querySelector("[data-color-trigger]").addEventListener("click", () => {
  colorMenu.hidden = !colorMenu.hidden;
  notificationMenu.hidden = true;
  profileMenu.hidden = true;
});

document.querySelectorAll("[data-theme-primary]").forEach((button) => {
  button.addEventListener("click", () => {
    const palette = {
      primary: button.dataset.themePrimary,
      surface: button.dataset.themeSurface,
    };
    document.documentElement.style.setProperty("--navy", palette.primary);
    document.documentElement.style.setProperty("--blue-100", palette.surface);
    localStorage.setItem("gusa-palette", JSON.stringify(palette));
    colorMenu.hidden = true;
  });
});

const savedPalette = JSON.parse(localStorage.getItem("gusa-palette") || "null");
document.documentElement.style.setProperty("--navy", savedPalette?.primary || "#174b8e");
document.documentElement.style.setProperty("--blue-100", savedPalette?.surface || "#eaf2fa");
document.body.dataset.theme = localStorage.getItem("gusa-theme") || "light";

document.querySelector("[data-profile-trigger]").addEventListener("click", (event) => {
  event.stopPropagation();
  profileMenu.hidden = !profileMenu.hidden;
});

document.addEventListener("click", (event) => {
  if (!profileMenu.contains(event.target)) profileMenu.hidden = true;
  if (!notificationMenu.contains(event.target) && !event.target.closest("[data-notification-trigger]")) notificationMenu.hidden = true;
  if (!colorMenu.contains(event.target) && !event.target.closest("[data-color-trigger]")) colorMenu.hidden = true;
});

async function loadUserManagement() {
  const response = await fetch("/api/users");
  if (response.status === 403) {
    const message = document.querySelector("[data-access-message]");
    message.hidden = false;
    message.textContent = "Bạn không có quyền quản lý user.";
    return;
  }
  if (!response.ok) throw new Error("Không thể tải danh sách user");
  const data = await response.json();
  const users = data.users || [];
  const list = document.querySelector("[data-user-list]");
  const empty = document.querySelector("[data-table-empty]");

  document.querySelector("[data-count-total]").textContent = users.length;
  document.querySelector("[data-count-active]").textContent = users.filter((user) => user.status === "active").length;
  document.querySelector("[data-count-pending]").textContent = users.filter((user) => user.status === "pending").length;
  document.querySelector("[data-count-blocked]").textContent = users.filter((user) => user.status === "blocked").length;

  const render = () => {
    const query = document.querySelector("[data-user-search]").value.toLowerCase();
    const statusFilter = document.querySelector("[data-status-filter]").value;
    const filteredUsers = users.filter((user) => {
      const matchesText = `${user.name} ${user.email}`.toLowerCase().includes(query);
      return matchesText && (statusFilter === "all" || user.status === statusFilter);
    });
    list.replaceChildren(...filteredUsers.map(createUserRow));
    empty.hidden = filteredUsers.length > 0;
    empty.textContent = users.length === 0 ? "Chưa có user nào." : "Không tìm thấy user phù hợp.";
  };

  document.querySelector("[data-user-search]").addEventListener("input", render);
  document.querySelector("[data-status-filter]").addEventListener("change", render);
  render();

  function createUserRow(user) {
    const row = document.createElement("tr");
    const userCell = document.createElement("td");
    const identity = document.createElement("div");
    identity.className = "user-cell";
    if (user.picture) {
      const image = document.createElement("img");
      image.src = user.picture;
      image.alt = `Ảnh đại diện của ${user.name}`;
      identity.append(image);
    } else {
      const fallback = document.createElement("span");
      fallback.className = "user-fallback";
      fallback.textContent = (user.name || user.email).charAt(0).toUpperCase();
      identity.append(fallback);
    }
    const name = document.createElement("div");
    name.className = "user-name";
    const nameText = document.createElement("strong");
    nameText.textContent = user.name;
    const email = document.createElement("small");
    email.textContent = user.email;
    name.append(nameText, email);
    identity.append(name);
    userCell.append(identity);

    const role = document.createElement("td");
    role.textContent = user.role === "admin" ? "Quản trị viên" : "Nhân viên";
    const state = document.createElement("td");
    const stateLabel = { active: "Đang hoạt động", pending: "Chờ duyệt", blocked: "Đang khóa" }[user.status];
    const pill = document.createElement("span");
    pill.className = `status-pill status-${user.status}`;
    pill.textContent = stateLabel;
    state.append(pill);
    const updated = document.createElement("td");
    updated.textContent = new Date(user.updatedAt).toLocaleDateString("vi-VN");
    const actions = document.createElement("td");
    if (user.role !== "admin") {
      const action = document.createElement("button");
      action.className = "user-action";
      action.type = "button";
      action.textContent = user.status === "active" ? "Khóa" : "Duyệt";
      action.addEventListener("click", async () => {
        const nextStatus = user.status === "active" ? "blocked" : "active";
        await fetch(`/api/users/${encodeURIComponent(user.id)}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
        user.status = nextStatus;
        render();
      });
      actions.append(action);
    }
    row.append(userCell, role, state, updated, actions);
    return row;
  }
}

Promise.all([loadGoogleAvatar(), loadUserManagement()]).catch(() => {});

const closeModal = () => {
  if (modal) modal.hidden = true;
  if (status) status.textContent = "";
};

const openGoogleButton = document.querySelector("[data-open-google]");
if (openGoogleButton) {
  openGoogleButton.addEventListener("click", () => {
    if (modal) modal.hidden = false;
    if (emailInput) emailInput.focus();
  });
}

const closeGoogleButton = document.querySelector("[data-close-google]");
if (closeGoogleButton) closeGoogleButton.addEventListener("click", closeModal);

if (modal) {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
}

const googleForm = document.querySelector("[data-google-form]");
if (googleForm) {
  googleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!emailInput) return;
    const selectedRole = document.querySelector("input[name='invite-role']:checked")?.value || "employee";
    fetch("/api/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailInput.value,
        role: selectedRole,
      }),
    }).then(async (response) => {
      if (!response.ok) throw new Error(await response.text());
      if (status) status.textContent = "Đã cấp quyền. Người dùng chỉ cần đăng nhập bằng Gmail này.";
      emailInput.value = "";
      await loadUserManagement();
    }).catch((error) => {
      if (status) status.textContent = error.message || "Không thể cấp quyền tài khoản.";
    });
  });
}