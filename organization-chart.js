const appShell = document.querySelector(".app-shell");
const profileMenu = document.querySelector("[data-profile-menu]");
const notificationMenu = document.querySelector("[data-notification-menu]");
const colorMenu = document.querySelector("[data-color-menu]");
const notificationCount = document.querySelector("[data-notification-count]");
const mobileMenuToggle = document.querySelector("[data-mobile-menu-toggle]");
const mobileMenuBackdrop = document.querySelector("[data-mobile-menu-backdrop]");
const adminMenu = document.querySelector("[data-admin-menu]");
const adminMenuLabel = document.querySelector("[data-admin-menu-label]");

function setAdminMenuVisibility(visible) {
  if (adminMenu) adminMenu.hidden = !visible;
  if (adminMenuLabel) adminMenuLabel.hidden = !visible;
}

function updateUserProfile(user) {
  if (!user) return;
  const displayName = user.name || user.email || "Tài khoản Google";
  const initials = displayName.trim().charAt(0).toUpperCase() || "B";

  document.querySelectorAll("[data-user-name]").forEach((element) => {
    element.textContent = displayName;
  });
  document.querySelectorAll("[data-user-avatar], [data-top-avatar], [data-profile-avatar]").forEach((element) => {
    if (user.picture) {
      const image = document.createElement("img");
      image.src = user.picture;
      image.referrerPolicy = "no-referrer";
      image.alt = `Ảnh đại diện của ${displayName}`;
      element.replaceChildren(image);
    } else {
      element.textContent = initials;
    }
  });
  const emailElement = document.querySelector("[data-profile-email]");
  if (emailElement) emailElement.textContent = user.email || "";
  const roleElement = document.querySelector("[data-profile-role]");
  if (roleElement) roleElement.textContent = user.role === "ceo" ? "CEO" : user.role === "admin" ? "Quản trị viên" : "Nhân viên";
  document.querySelectorAll("[data-user-role]").forEach((element) => {
    element.textContent = user.role === "ceo" ? "CEO" : user.role === "admin" ? "Quản trị viên" : "Nhân viên";
  });
  document.querySelectorAll(".role-chip").forEach((button) => {
    const currentLabel = user.role === "ceo" ? "CEO" : user.role === "admin" ? "Quản trị" : "Nhân viên";
    if (button.textContent.trim() === "Quản trị" || button.textContent.trim() === "Nhân viên") button.textContent = currentLabel;
    const isAdminChip = button.textContent.trim() === "CEO" || button.textContent.trim() === "Quản trị";
    const isCurrentRole = isAdminChip === (user.role === "admin" || user.role === "ceo");
    button.hidden = !isCurrentRole;
    button.classList.toggle("is-selected", isCurrentRole);
  });
}

function setMobileMenu(open) {
  appShell.classList.toggle("is-mobile-menu-open", open);
  if (mobileMenuBackdrop) mobileMenuBackdrop.hidden = !open;
  if (mobileMenuToggle) mobileMenuToggle.setAttribute("aria-expanded", String(open));

  if (open && window.matchMedia("(max-width: 600px)").matches) {
    appShell.classList.remove("is-collapsed");
    const sidebarToggle = document.querySelector("[data-sidebar-toggle]");
    if (sidebarToggle) sidebarToggle.setAttribute("aria-label", "Thu gọn menu");
    localStorage.setItem("gusa-sidebar-collapsed", "false");
  }
}

if (mobileMenuToggle) {
  mobileMenuToggle.addEventListener("click", () => {
    const open = !appShell.classList.contains("is-mobile-menu-open");
    setMobileMenu(open);
  });
}

if (mobileMenuBackdrop) {
  mobileMenuBackdrop.addEventListener("click", () => setMobileMenu(false));
}

if (localStorage.getItem("gusa-sidebar-collapsed") === "true") appShell.classList.add("is-collapsed");

document.querySelector("[data-sidebar-toggle]").addEventListener("click", () => {
  const collapsed = appShell.classList.toggle("is-collapsed");
  localStorage.setItem("gusa-sidebar-collapsed", String(collapsed));
});

document.querySelector("[data-theme-trigger]").addEventListener("click", () => {
  toggleTheme();
  notificationMenu.hidden = true;
  colorMenu.hidden = true;
});
document.body.dataset.theme = localStorage.getItem("gusa-theme") || "light";

function toggleTheme() {
  document.body.dataset.theme = document.body.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("gusa-theme", document.body.dataset.theme);
}

if (notificationCount && Number(notificationCount.textContent) <= 0) notificationCount.hidden = true;
document.querySelector("[data-notification-trigger]").addEventListener("click", () => {
  notificationMenu.hidden = !notificationMenu.hidden;
  colorMenu.hidden = true;
  profileMenu.hidden = true;
});
document.querySelector("[data-color-trigger]").addEventListener("click", () => {
  colorMenu.hidden = !colorMenu.hidden;
  notificationMenu.hidden = true;
  profileMenu.hidden = true;
});
document.querySelectorAll("[data-theme-primary]").forEach((button) => {
  button.addEventListener("click", () => {
    document.documentElement.style.setProperty("--navy", button.dataset.themePrimary);
    document.documentElement.style.setProperty("--blue-100", button.dataset.themeSurface);
    localStorage.setItem("gusa-palette", JSON.stringify({ primary: button.dataset.themePrimary, surface: button.dataset.themeSurface }));
    colorMenu.hidden = true;
  });
});
const savedPalette = JSON.parse(localStorage.getItem("gusa-palette") || "null");
document.documentElement.style.setProperty("--navy", savedPalette?.primary || "#174b8e");
document.documentElement.style.setProperty("--blue-100", savedPalette?.surface || "#eaf2fa");
document.querySelector("[data-profile-trigger]").addEventListener("click", () => {
  profileMenu.hidden = !profileMenu.hidden;
  notificationMenu.hidden = true;
  colorMenu.hidden = true;
});
document.addEventListener("click", (event) => {
  if (!profileMenu.contains(event.target) && !event.target.closest("[data-profile-trigger]")) profileMenu.hidden = true;
  if (!notificationMenu.contains(event.target) && !event.target.closest("[data-notification-trigger]")) notificationMenu.hidden = true;
  if (!colorMenu.contains(event.target) && !event.target.closest("[data-color-trigger]")) colorMenu.hidden = true;
});

const historyBackButton = document.querySelector("[data-history-back]");
if (historyBackButton) historyBackButton.addEventListener("click", () => history.back());

const historyForwardButton = document.querySelector("[data-history-forward]");
if (historyForwardButton) historyForwardButton.addEventListener("click", () => history.forward());

const chartTree = document.querySelector("[data-chart-tree]");
const chartTreeViewport = document.querySelector(".chart-tree-viewport");
const chartPanel = document.querySelector("[data-chart-tree-panel]");
const chartSearchInput = document.querySelector(".search-box input");
const zoomLabel = document.querySelector("[data-chart-zoom-label]");
const nodeForm = document.querySelector("[data-node-form]");
const parentSelect = nodeForm.elements.parentId;
const formTitle = document.querySelector("[data-form-title]");
const formSubmit = document.querySelector("[data-form-submit]");
const formCancel = document.querySelector("[data-form-cancel]");
const addRootButton = document.querySelector("[data-add-root]");
const chartStatus = document.querySelector("[data-chart-status]");
const chartContent = document.querySelector(".chart-content");
const editorPanel = document.querySelector("[data-editor-panel]");
const editorClose = document.querySelector("[data-editor-close]");
let nodes = [];
let editingId = null;
let isAdmin = false;
addRootButton.hidden = true;
editorPanel.hidden = true;

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function applyChartSearch() {
  const query = normalizeSearchText(chartSearchInput?.value);
  const cards = [...chartTree.querySelectorAll(".chart-node-card")];
  cards.forEach((card) => {
    card.classList.remove("is-search-match", "is-search-dimmed");
    if (query && !card.dataset.searchText.includes(query)) card.classList.add("is-search-dimmed");
    if (query && card.dataset.searchText.includes(query)) card.classList.add("is-search-match");
  });

  if (!query) {
    if (chartStatus.dataset.searchMessage) {
      chartStatus.textContent = "";
      delete chartStatus.dataset.searchMessage;
    }
    return;
  }

  const matches = cards.filter((card) => card.classList.contains("is-search-match"));
  chartStatus.textContent = matches.length ? `${matches.length} vị trí phù hợp.` : "Không tìm thấy vị trí phù hợp.";
  chartStatus.dataset.searchMessage = "true";
  matches[0]?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
}

if (chartSearchInput) chartSearchInput.addEventListener("input", applyChartSearch);

function openEditor() {
  chartContent.classList.add("is-editor-open");
}

function closeEditor() {
  chartContent.classList.remove("is-editor-open");
  resetForm();
}
let chartZoom = 1;

function setChartZoom(value) {
  chartZoom = Math.max(0.55, Math.min(1.25, value));
  chartTree.style.setProperty("--chart-zoom", chartZoom);
  zoomLabel.textContent = `${Math.round(chartZoom * 100)}%`;
}

document.querySelector("[data-chart-zoom-out]").addEventListener("click", () => setChartZoom(chartZoom - 0.1));
document.querySelector("[data-chart-zoom-in]").addEventListener("click", () => setChartZoom(chartZoom + 0.1));
document.querySelector("[data-chart-fit]").addEventListener("click", () => {
  const contentWidth = chartTree.scrollWidth || chartTreeViewport.scrollWidth;
  const availableWidth = chartPanel.clientWidth - 32;
  setChartZoom(contentWidth > availableWidth ? Math.max(0.55, availableWidth / contentWidth) : 1);
});

function resetForm() {
  editingId = null;
  nodeForm.reset();
  nodeForm.elements.staff.value = "1";
  formTitle.textContent = "Thêm vị trí";
  formSubmit.textContent = "Thêm vào sơ đồ";
  formCancel.hidden = true;
}

function refreshParentOptions() {
  const currentParent = nodeForm.elements.parentId.value;
  parentSelect.replaceChildren(new Option("Không có, đây là cấp cao nhất", ""));
  nodes.filter((node) => node.id !== editingId).forEach((node) => {
    parentSelect.append(new Option(node.name, node.id));
  });
  parentSelect.value = nodes.some((node) => node.id === currentParent) ? currentParent : "";
}

function createNodeCard(node) {
  const card = document.createElement("article");
  card.className = "chart-node-card";
  card.dataset.searchText = normalizeSearchText(`${node.name} ${node.role || ""} ${node.staff} nhân sự`);
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.setAttribute("aria-label", `Mở hồ sơ ${node.name}`);
  const openProfile = () => {
    window.location.href = `organization-profile.html?node=${encodeURIComponent(node.id)}`;
  };
  card.addEventListener("click", (event) => {
    if (!event.target.closest("button")) openProfile();
  });
  card.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && !event.target.closest("button")) {
      event.preventDefault();
      openProfile();
    }
  });
  const heading = document.createElement("div");
  heading.className = "chart-node-heading";
  const name = document.createElement("strong");
  name.textContent = node.name;
  const staff = document.createElement("span");
  staff.textContent = `${node.staff} nhân sự`;
  heading.append(name, staff);
  const role = document.createElement("p");
  role.textContent = node.role || "Chưa có mô tả";
  const actions = document.createElement("div");
  actions.className = "chart-node-actions";
  const addChild = document.createElement("button");
  addChild.type = "button";
  addChild.textContent = "+ Cấp con";
  addChild.addEventListener("click", () => {
    resetForm();
    parentSelect.value = node.id;
    openEditor();
    nodeForm.elements.name.focus();
  });
  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "Sửa";
  edit.addEventListener("click", () => {
    editingId = node.id;
    nodeForm.elements.name.value = node.name;
    nodeForm.elements.role.value = node.role;
    nodeForm.elements.staff.value = node.staff;
    refreshParentOptions();
    parentSelect.value = node.parentId || "";
    formTitle.textContent = "Chỉnh sửa vị trí";
    formSubmit.textContent = "Cập nhật vị trí";
    formCancel.hidden = false;
    openEditor();
    nodeForm.elements.name.focus();
  });
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "Xóa";
  remove.addEventListener("click", () => {
    const hasChildren = nodes.some((child) => child.parentId === node.id);
    if (hasChildren) {
      chartStatus.textContent = "Hãy xóa hoặc chuyển các cấp con trước.";
      return;
    }
    nodes = nodes.filter((item) => item.id !== node.id);
    resetForm();
    renderChart();
  });
  actions.append(addChild, edit, remove);
  if (isAdmin) card.append(heading, role, actions);
  else card.append(heading, role);
  return card;
}

function renderNode(node, target, depth) {
  const branch = document.createElement("div");
  branch.className = `chart-branch chart-branch-level-${depth}`;
  branch.append(createNodeCard(node));
  const children = document.createElement("div");
  children.className = `chart-children${depth >= 2 ? " chart-children--vertical" : ""}`;
  renderBranch(node.id, children, depth + 1);
  if (children.childElementCount) branch.append(children);
  target.append(branch);
}

function renderBranch(parentId, target, depth = 0) {
  const siblings = nodes.filter((node) => node.parentId === parentId);
  const aboveNodes = siblings.filter((node) => node.placement === "above");
  const normalNodes = siblings.filter((node) => node.placement !== "above");

  if (aboveNodes.length && normalNodes.length) {
    const leadership = document.createElement("div");
    leadership.className = "chart-leadership";
    const aboveRow = document.createElement("div");
    aboveRow.className = "chart-leadership-above";
    aboveNodes.forEach((node) => renderNode(node, aboveRow, depth));
    const connector = document.createElement("div");
    connector.className = "chart-leadership-connector";
    const mainRow = document.createElement("div");
    mainRow.className = "chart-leadership-main";
    normalNodes.forEach((node) => renderNode(node, mainRow, depth));
    leadership.append(aboveRow, connector, mainRow);
    target.append(leadership);
    return;
  }

  siblings.forEach((node) => renderNode(node, target, depth));
}

function renderChart() {
  chartTree.replaceChildren();
  renderBranch(null, chartTree);
  refreshParentOptions();
  applyChartSearch();
  if (window.matchMedia("(max-width: 600px)").matches) {
    requestAnimationFrame(() => {
      chartTreeViewport.scrollLeft = Math.max(0, (chartTreeViewport.scrollWidth - chartTreeViewport.clientWidth) / 2);
    });
  }
}

async function saveChart() {
  chartStatus.textContent = "Đang lưu sơ đồ...";
  try {
    const response = await fetch("/api/organization-chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes }),
    });
    if (!response.ok) throw new Error();
    chartStatus.textContent = "Đã lưu sơ đồ tổ chức.";
  } catch (error) {
    chartStatus.textContent = "Không thể lưu sơ đồ. Vui lòng thử lại.";
  }
}

nodeForm.addEventListener("submit", (event) => {
  if (!isAdmin) return;
  event.preventDefault();
  const formData = new FormData(nodeForm);
  const node = {
    id: editingId || crypto.randomUUID(),
    parentId: formData.get("parentId") || null,
    name: String(formData.get("name")).trim(),
    role: String(formData.get("role")).trim(),
    staff: Number(formData.get("staff")) || 0,
  };
  const existingNode = nodes.find((item) => item.id === editingId);
  if (existingNode?.placement) node.placement = existingNode.placement;
  if (editingId) nodes = nodes.map((item) => item.id === editingId ? node : item);
  else nodes.push(node);
  resetForm();
  closeEditor();
  renderChart();
  saveChart();
});

formCancel.addEventListener("click", closeEditor);
addRootButton.addEventListener("click", () => {
  resetForm();
  parentSelect.value = "";
  openEditor();
  nodeForm.elements.name.focus();
});
editorClose.addEventListener("click", closeEditor);
editorPanel.addEventListener("click", (event) => event.stopPropagation());

Promise.all([fetch("/api/organization-chart", { cache: "no-store" }), fetch("/api/me", { cache: "no-store" })])
  .then(async ([chartResponse, meResponse]) => {
    if (!chartResponse.ok || !meResponse.ok) throw new Error();
    const data = await chartResponse.json();
    const me = await meResponse.json();
    isAdmin = me.user?.role === "admin" || me.user?.role === "ceo";
    updateUserProfile(me.user);
    setAdminMenuVisibility(isAdmin);
    addRootButton.hidden = !isAdmin;
    editorPanel.hidden = !isAdmin;
    nodes = Array.isArray(data.nodes) ? data.nodes : [];
    renderChart();
  })
  .catch(async () => {
    try {
      const fallbackResponse = await fetch("organization-chart.json", { cache: "no-store" });
      const fallbackData = await fallbackResponse.json();
      nodes = Array.isArray(fallbackData.nodes) ? fallbackData.nodes : [];
      isAdmin = false;
      addRootButton.hidden = true;
      editorPanel.hidden = true;
      renderChart();
      chartStatus.textContent = "Đang hiển thị sơ đồ mẫu do dữ liệu chính chưa sẵn sàng.";
    } catch {
      nodes = [
        { id: "root", parentId: null, name: "GIÁM ĐỐC", role: "Hồng Gusa", staff: 1 },
        { id: "branch-1", parentId: "root", name: "P. GIÁM ĐỐC", role: "Ban điều hành", staff: 1 },
        { id: "branch-2", parentId: "root", name: "MARKETING", role: "Chưa có mô tả", staff: 1 },
        { id: "branch-3", parentId: "branch-1", name: "CHI NHÁNH 1", role: "Mạng lưới", staff: 1 },
      ];
      isAdmin = false;
      addRootButton.hidden = true;
      editorPanel.hidden = true;
      renderChart();
      chartStatus.textContent = "Không thể tải sơ đồ hiện tại. Đang hiển thị sơ đồ mặc định.";
    }
  });
