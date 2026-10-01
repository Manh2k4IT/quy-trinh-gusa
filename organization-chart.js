const appShell = document.querySelector(".app-shell");
const profileMenu = document.querySelector("[data-profile-menu]");
const notificationMenu = document.querySelector("[data-notification-menu]");
const colorMenu = document.querySelector("[data-color-menu]");
const notificationCount = document.querySelector("[data-notification-count]");
const mobileMenuToggle = document.querySelector("[data-mobile-menu-toggle]");
const mobileMenuBackdrop = document.querySelector("[data-mobile-menu-backdrop]");
const adminMenu = document.querySelector("[data-admin-menu]");
const adminMenuLabel = document.querySelector("[data-admin-menu-label]");
const loginImageWelcome = document.querySelector("[data-login-image-welcome]");

function openWelcomeImage() {
  if (!loginImageWelcome) return;
  const closeButton = loginImageWelcome.querySelector("[data-login-image-close]");
  const closeWelcomeImage = () => {
    loginImageWelcome.hidden = true;
    const url = new URL(location.href);
    url.searchParams.delete("showWelcome");
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
    document.removeEventListener("keydown", onWelcomeKeydown);
  };
  const onWelcomeKeydown = (event) => {
    if (event.key === "Escape") closeWelcomeImage();
  };
  loginImageWelcome.hidden = false;
  closeButton?.focus({ preventScroll: true });
  closeButton?.addEventListener("click", closeWelcomeImage);
  loginImageWelcome.addEventListener("click", (event) => {
    if (event.target === loginImageWelcome) closeWelcomeImage();
  });
  document.addEventListener("keydown", onWelcomeKeydown);
}

const isDesktopApp = Boolean(window.desktopSettings?.isDesktop);
const isWelcomeLogin = new URLSearchParams(location.search).get("showWelcome") === "1";
const desktopWelcomeShownKey = "gusa-desktop-welcome-shown";
if (isWelcomeLogin || (isDesktopApp && sessionStorage.getItem(desktopWelcomeShownKey) !== "true")) {
  if (isDesktopApp) sessionStorage.setItem(desktopWelcomeShownKey, "true");
  openWelcomeImage();
}
window.desktopSettings?.onAppOpened?.(openWelcomeImage);

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
  if (roleElement) roleElement.textContent = user.role === "ceo" ? "CEO" : user.role === "admin" ? "Quản trị viên" : user.role === "accountant" ? "Kế toán" : "Nhân viên";
  document.querySelectorAll("[data-user-role]").forEach((element) => {
    element.textContent = user.role === "ceo" ? "CEO" : user.role === "admin" ? "Quản trị viên" : user.role === "accountant" ? "Kế toán" : "Nhân viên";
  });
  document.querySelectorAll(".role-chip").forEach((button) => {
    const originalRole = button.dataset.role || button.textContent.trim();
    button.dataset.role = originalRole;
    const currentLabel = user.role === "ceo" ? "CEO" : user.role === "admin" ? "Quản trị" : user.role === "accountant" ? "Kế toán" : "Nhân viên";
    const isCurrentRole = user.role === "ceo"
      ? originalRole === "CEO"
      : user.role === "admin"
        ? originalRole === "Quản trị"
        : originalRole === "Nhân viên";
    button.textContent = isCurrentRole ? currentLabel : originalRole;
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
const placementField = document.createElement("label");
placementField.textContent = "Hướng nhánh";
placementField.innerHTML += '<select name="placement"><option value="below">Dọc xuống dưới</option><option value="right">Chỉa sang phải</option><option value="left">Chỉa sang trái</option></select>';
nodeForm.elements.parentId.closest("label").after(placementField);
const placementSelect = nodeForm.elements.placement;
let nodes = [];
let freeLines = [];
let editingId = null;
let isAdmin = false;
let canvasPositions = new Map();
let canvasCards = new Map();
let connectingNodeId = null;
let connectMode = false;
let connectionPreview = null;
let canvasFillColor = "#e5a05b";
let selectedCanvasNode = null;
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
  placementSelect.value = "below";
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
  if (node.color) card.style.background = node.color;
  card.dataset.searchText = normalizeSearchText(`${node.name} ${node.role || ""} ${node.staff} nhân sự`);
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.setAttribute("aria-label", `Mở hồ sơ ${node.name}`);
  const openProfile = () => {
    window.location.href = `organization-profile.html?node=${encodeURIComponent(node.id)}`;
  };
  card.addEventListener("click", (event) => {
    if (card.dataset.dragged === "true") {
      delete card.dataset.dragged;
      return;
    }
    if (card.dataset.connectionDragged === "true") {
      delete card.dataset.connectionDragged;
      return;
    }
    if (connectMode) {
      event.preventDefault();
      event.stopPropagation();
      if (!connectingNodeId) {
        connectingNodeId = node.id;
        card.classList.add("is-connection-source");
        chartStatus.textContent = `Đã chọn “${node.name}”. Bấm ô đích để nối.`;
      } else if (connectingNodeId !== node.id) {
        const source = nodes.find((item) => item.id === connectingNodeId);
        source.connections = [...new Set([...(source.connections || []), node.id])];
        connectingNodeId = null;
        renderChart();
        saveChart();
      }
      return;
    }
    if (!event.target.closest("button")) openProfile();
  });
  card.addEventListener("dblclick", (event) => {
    if (!chartTree.classList.contains("chart-free-canvas") || event.target.closest("button, .chart-resize-handle")) return;
    const name = window.prompt("Nội dung ô", node.name);
    if (!name?.trim()) return;
    node.name = name.trim();
    renderCanvasChart();
    saveChart();
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
    placementSelect.value = node.placement === "above" ? "right" : node.placement || "below";
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
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    const idsToRemove = new Set([node.id]);
    let hasChildren = true;
    while (hasChildren) {
      hasChildren = false;
      nodes.forEach((child) => {
        if (idsToRemove.has(child.parentId)) {
          idsToRemove.add(child.id);
          hasChildren = true;
        }
      });
    }
    if (idsToRemove.size > 1 && !window.confirm(`Vị trí này có ${idsToRemove.size - 1} cấp con. Bạn có chắc muốn xóa cả nhánh không?`)) return;
    nodes = nodes.filter((item) => !idsToRemove.has(item.id));
    resetForm();
    renderChart();
    saveChart();
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
  const childNodes = nodes.filter((item) => item.parentId === node.id);
  const sideNodes = childNodes.filter((item) => ["above", "left", "right"].includes(item.placement));
  const normalNodes = childNodes.filter((item) => !["above", "left", "right"].includes(item.placement));
  if (sideNodes.length && normalNodes.length) {
    const sideLayout = document.createElement("div");
    sideLayout.className = "chart-side-layout";
    const mainColumn = document.createElement("div");
    mainColumn.className = "chart-side-main";
    const sideColumn = document.createElement("div");
    sideColumn.className = "chart-side-column";
    const sideConnector = document.createElement("div");
    sideConnector.className = "chart-side-connector";
    normalNodes.forEach((child) => renderNode(child, mainColumn, depth + 1));
    sideNodes.forEach((child) => renderNode(child, sideColumn, depth + 1));
    const sideOnLeft = sideNodes.some((child) => child.placement === "left");
    sideLayout.append(...(sideOnLeft ? [sideColumn, sideConnector, mainColumn] : [mainColumn, sideConnector, sideColumn]));
    children.classList.add("chart-children--side-root");
    children.append(sideLayout);
  } else {
    renderBranch(node.id, children, depth + 1);
  }
  if (children.childElementCount) branch.append(children);
  target.append(branch);
}

function renderBranch(parentId, target, depth = 0) {
  const siblings = nodes.filter((node) => node.parentId === parentId);
  const sideNodes = siblings.filter((node) => ["above", "left", "right"].includes(node.placement));
  const normalNodes = siblings.filter((node) => !["above", "left", "right"].includes(node.placement));

  if (sideNodes.length && normalNodes.length) {
    const leadership = document.createElement("div");
    leadership.className = "chart-leadership";
    const aboveRow = document.createElement("div");
    aboveRow.className = "chart-leadership-above";
    sideNodes.forEach((node) => renderNode(node, aboveRow, depth));
    const connector = document.createElement("div");
    connector.className = "chart-leadership-connector";
    const mainRow = document.createElement("div");
    mainRow.className = "chart-leadership-main";
    normalNodes.forEach((node) => renderNode(node, mainRow, depth));
    const sideOnLeft = sideNodes.some((node) => node.placement === "left");
    leadership.append(...(sideOnLeft ? [aboveRow, connector, mainRow] : [mainRow, connector, aboveRow]));
    target.append(leadership);
    return;
  }

  siblings.forEach((node) => renderNode(node, target, depth));
}

function createCanvasPositions() {
  const stored = nodes.some((node) => Object.prototype.hasOwnProperty.call(node, "x") && Object.prototype.hasOwnProperty.call(node, "y"));
  const storedPositions = new Map(nodes.map((node) => [node.id, { x: Number(node.x) || 0, y: Number(node.y) || 0 }]));
  const hasDistinctPositions = new Set([...storedPositions.values()].map((position) => `${position.x}:${position.y}`)).size > 1;
  if (stored && hasDistinctPositions) return storedPositions;
  const positions = new Map();
  const childrenByParent = new Map();
  nodes.forEach((node) => {
    const key = node.parentId || null;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(node);
  });
  let row = 0;
  const visited = new Set();
  const visit = (parentId, depth) => {
    (childrenByParent.get(parentId) || []).forEach((node) => {
      if (visited.has(node.id)) return;
      visited.add(node.id);
      const sideOffset = node.placement === "left" ? -120 : node.placement === "right" || node.placement === "above" ? 120 : 0;
      positions.set(node.id, { x: Math.max(24, 90 + depth * 250 + sideOffset), y: 42 + row * 128 });
      row += 1;
      visit(node.id, depth + 1);
    });
  };
  visit(null, 0);
  nodes.forEach((node, index) => {
    if (!positions.has(node.id)) positions.set(node.id, { x: 90, y: 42 + (row + index) * 128 });
  });
  return positions;
}

function updateCanvasConnections() {
  const svg = chartTree.querySelector(".chart-connector-layer");
  if (!svg) return;
  svg.replaceChildren();
  const links = [];
  freeLines.forEach((line) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add("is-free-line");
    path.setAttribute("d", `M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`);
    svg.append(path);
  });
  nodes.forEach((node) => (node.connections || []).forEach((targetId) => links.push([node.id, targetId])));
  links.forEach(([fromId, toId]) => {
    const from = canvasPositions.get(fromId);
    const to = canvasPositions.get(toId);
    const fromCard = canvasCards.get(fromId);
    const toCard = canvasCards.get(toId);
    if (!from || !to || !fromCard || !toCard) return;
    const fromWidth = fromCard.offsetWidth;
    const fromHeight = fromCard.offsetHeight;
    const toWidth = toCard.offsetWidth;
    const toHeight = toCard.offsetHeight;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    if (to.y >= from.y + fromHeight) {
      const startX = from.x + fromWidth / 2;
      const startY = from.y + fromHeight;
      const endX = to.x + toWidth / 2;
      const endY = to.y;
      const bendY = startY + Math.max(24, (endY - startY) / 2);
      path.setAttribute("d", `M ${startX} ${startY} V ${bendY} H ${endX} V ${endY}`);
    } else if (to.y + toHeight <= from.y) {
      const startX = from.x + fromWidth / 2;
      const startY = from.y;
      const endX = to.x + toWidth / 2;
      const endY = to.y + toHeight;
      const bendY = endY + Math.min(-24, (startY - endY) / 2);
      path.setAttribute("d", `M ${startX} ${startY} V ${bendY} H ${endX} V ${endY}`);
    } else if (to.x >= from.x + fromWidth) {
      const startX = from.x + fromWidth;
      const startY = from.y + fromHeight / 2;
      const endX = to.x;
      const endY = to.y + toHeight / 2;
      const bendX = startX + Math.max(24, (endX - startX) / 2);
      path.setAttribute("d", `M ${startX} ${startY} H ${bendX} V ${endY} H ${endX}`);
    } else {
      const startX = from.x;
      const startY = from.y + fromHeight / 2;
      const endX = to.x + toWidth;
      const endY = to.y + toHeight / 2;
      const bendX = endX + Math.min(-24, (startX - endX) / 2);
      path.setAttribute("d", `M ${startX} ${startY} H ${bendX} V ${endY} H ${endX}`);
    }
    svg.append(path);
  });
  const maxX = Math.max(900, ...[...canvasPositions.values()].map((position) => position.x + 380));
  const maxY = Math.max(620, ...[...canvasPositions.values()].map((position) => position.y + 300));
  chartTree.style.width = `${maxX}px`;
  chartTree.style.height = `${maxY}px`;
  svg.setAttribute("width", String(maxX));
  svg.setAttribute("height", String(maxY));
}

function startConnectionDrag(event, sourceCard, sourceNode) {
  if (!connectMode) return false;
  event.preventDefault();
  event.stopPropagation();
  const sourcePosition = canvasPositions.get(sourceNode.id);
  const startX = sourcePosition.x + sourceCard.offsetWidth / 2;
  const startY = sourcePosition.y + sourceCard.offsetHeight / 2;
  const svg = chartTree.querySelector(".chart-connector-layer");
  const preview = document.createElementNS("http://www.w3.org/2000/svg", "path");
  preview.classList.add("is-preview");
  svg.append(preview);
  connectionPreview = preview;
  const bounds = chartTree.getBoundingClientRect();
  const toCanvasPoint = (moveEvent) => ({
    x: (moveEvent.clientX - bounds.left) / (chartZoom || 1),
    y: (moveEvent.clientY - bounds.top) / (chartZoom || 1),
  });
  const onMove = (moveEvent) => {
    const point = toCanvasPoint(moveEvent);
    preview.setAttribute("d", `M ${startX} ${startY} L ${point.x} ${point.y}`);
  };
  const onUp = (upEvent) => {
    const target = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest(".chart-canvas-card");
    if (target && target !== sourceCard) {
      const targetId = target.dataset.nodeId;
      sourceNode.connections = [...new Set([...(sourceNode.connections || []), targetId])];
      sourceCard.dataset.connectionDragged = "true";
      renderChart();
      saveChart();
    }
    preview.remove();
    connectionPreview = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp, { once: true });
  return true;
}

function startFreeLineDrag(event) {
  event.preventDefault();
  event.stopPropagation();
  const bounds = chartTree.getBoundingClientRect();
  const toCanvasPoint = (moveEvent) => ({
    x: Math.max(0, (moveEvent.clientX - bounds.left) / (chartZoom || 1)),
    y: Math.max(0, (moveEvent.clientY - bounds.top) / (chartZoom || 1)),
  });
  const start = toCanvasPoint(event);
  const svg = chartTree.querySelector(".chart-connector-layer");
  const preview = document.createElementNS("http://www.w3.org/2000/svg", "path");
  preview.classList.add("is-preview");
  svg.append(preview);
  const onMove = (moveEvent) => {
    const end = toCanvasPoint(moveEvent);
    preview.setAttribute("d", `M ${start.x} ${start.y} L ${end.x} ${end.y}`);
  };
  const onUp = (upEvent) => {
    const end = toCanvasPoint(upEvent);
    if (Math.hypot(end.x - start.x, end.y - start.y) > 8) {
      freeLines.push({ x1: start.x, y1: start.y, x2: end.x, y2: end.y });
      renderChart();
      saveChart();
    } else preview.remove();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp, { once: true });
}

function attachCanvasInteraction(card, node) {
  if (!isAdmin) return;
  const position = canvasPositions.get(node.id);
  const output = document.createElement("button");
  output.type = "button";
  output.className = "chart-connector-handle chart-connector-output";
  output.textContent = "+";
  output.title = "Bắt đầu nối nhánh";
  output.addEventListener("pointerdown", (event) => startConnectionDrag(event, card, node));
  output.addEventListener("click", (event) => {
    event.stopPropagation();
    if (card.dataset.connectionDragged === "true") {
      delete card.dataset.connectionDragged;
      return;
    }
    connectingNodeId = node.id;
    canvasCards.forEach((item) => item.classList.toggle("is-connection-source", item === card));
    chartStatus.textContent = "Đã chọn điểm nối. Bấm dấu + ở ô đích để nối nhánh.";
  });
  const input = document.createElement("button");
  input.type = "button";
  input.className = "chart-connector-handle chart-connector-input";
  input.textContent = "+";
  input.title = "Nối vào vị trí này";
  input.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!connectingNodeId || connectingNodeId === node.id) return;
    let ancestorId = connectingNodeId;
    while (ancestorId) {
      if (ancestorId === node.id) {
        chartStatus.textContent = "Không thể nối vào cấp con của chính nhánh này.";
        return;
      }
      ancestorId = nodes.find((item) => item.id === ancestorId)?.parentId || null;
    }
    node.parentId = connectingNodeId;
    node.placement = "below";
    connectingNodeId = null;
    renderChart();
    saveChart();
  });
  const resize = document.createElement("span");
  resize.className = "chart-resize-handle";
  resize.title = "Kéo để đổi kích thước";
  resize.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = card.offsetWidth;
    const startHeight = card.offsetHeight;
    resize.setPointerCapture(event.pointerId);
    const onMove = (moveEvent) => {
      node.width = Math.max(140, Math.min(360, startWidth + moveEvent.clientX - startX));
      node.height = Math.max(58, Math.min(260, startHeight + moveEvent.clientY - startY));
      card.style.width = `${node.width}px`;
      card.style.height = `${node.height}px`;
      updateCanvasConnections();
    };
    const onUp = () => {
      resize.removeEventListener("pointermove", onMove);
      resize.removeEventListener("pointerup", onUp);
      saveChart();
    };
    resize.addEventListener("pointermove", onMove);
    resize.addEventListener("pointerup", onUp);
  });
  card.append(input, output, resize);
  card.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, .chart-resize-handle")) return;
    selectedCanvasNode = node;
    if (startConnectionDrag(event, card, node)) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const originalX = position.x;
    const originalY = position.y;
    let moved = false;
    card.setPointerCapture(event.pointerId);
    const onMove = (moveEvent) => {
      position.x = Math.max(0, originalX + moveEvent.clientX - startX);
      position.y = Math.max(0, originalY + moveEvent.clientY - startY);
      moved = moved || Math.abs(moveEvent.clientX - startX) > 4 || Math.abs(moveEvent.clientY - startY) > 4;
      card.style.left = `${position.x}px`;
      card.style.top = `${position.y}px`;
      updateCanvasConnections();
    };
    const onUp = () => {
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerup", onUp);
      node.x = position.x;
      node.y = position.y;
      if (moved) card.dataset.dragged = "true";
      saveChart();
    };
    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerup", onUp);
  });
}

function initializeConnectModeButton() {
  const tools = document.querySelector(".chart-view-tools");
  if (!tools || tools.querySelector("[data-connect-mode]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.connectMode = "";
  button.textContent = "✎ Nối";
  button.title = "Bật chế độ tự nối hai ô";
  button.addEventListener("click", () => {
    connectMode = !connectMode;
    connectingNodeId = null;
    chartTree.classList.toggle("is-connect-mode", connectMode);
    button.classList.toggle("is-active", connectMode);
    chartStatus.textContent = connectMode ? "Chế độ nối: kéo từ ô nguồn hoặc dấu + sang ô đích." : "";
  });
  tools.append(button);
}

function renderCanvasChart() {
  initializeConnectModeButton();
  document.querySelector(".chart-view-tools")?.removeAttribute("hidden");
  const pageHeading = document.querySelector(".page-heading");
  pageHeading?.querySelector("[data-presentation-edit]")?.remove();
  let doneButton = pageHeading?.querySelector("[data-presentation-view]");
  if (!doneButton && pageHeading) {
    doneButton = document.createElement("button");
    doneButton.type = "button";
    doneButton.dataset.presentationView = "";
    doneButton.className = "google-add-button";
    doneButton.textContent = "Xong";
    doneButton.addEventListener("click", renderPresentationChart);
    pageHeading.append(doneButton);
  }
  let colorPicker = document.querySelector("[data-canvas-color]");
  if (!colorPicker) {
    colorPicker = document.createElement("input");
    colorPicker.type = "color";
    colorPicker.value = canvasFillColor;
    colorPicker.dataset.canvasColor = "";
    colorPicker.title = "Màu ô mới";
    colorPicker.addEventListener("input", () => {
      canvasFillColor = colorPicker.value;
      if (selectedCanvasNode) {
        selectedCanvasNode.color = canvasFillColor;
        renderCanvasChart();
        saveChart();
      }
    });
    document.querySelector(".chart-view-tools")?.append(colorPicker);
  }
  chartTree.className = "chart-tree chart-free-canvas";
  chartTree.replaceChildren();
  canvasPositions = createCanvasPositions();
  canvasCards = new Map();
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("chart-connector-layer");
  chartTree.append(svg);
  nodes.forEach((node) => {
    const card = createNodeCard(node);
    const position = canvasPositions.get(node.id);
    card.dataset.nodeId = node.id;
    card.style.left = `${position.x}px`;
    card.style.top = `${position.y}px`;
    card.style.width = `${node.width || 165}px`;
    card.style.minHeight = `${node.height || 100}px`;
    card.classList.add("chart-canvas-card");
    canvasCards.set(node.id, card);
    attachCanvasInteraction(card, node);
    chartTree.append(card);
  });
  updateCanvasConnections();
  refreshParentOptions();
  applyChartSearch();
}

function createInlineCanvasNode(event) {
  if (!isAdmin || !chartTree.classList.contains("chart-free-canvas") || event.target.closest(".chart-canvas-card, button, input")) return;
  const zoom = chartZoom || 1;
  const bounds = chartTree.getBoundingClientRect();
  const x = Math.max(12, (event.clientX - bounds.left) / zoom - 75);
  const y = Math.max(12, (event.clientY - bounds.top) / zoom - 28);
  const input = document.createElement("input");
  input.className = "chart-inline-node-editor";
  input.type = "text";
  input.maxLength = 120;
  input.placeholder = "Nhập tên vị trí...";
  input.style.left = `${x}px`;
  input.style.top = `${y}px`;
  chartTree.append(input);
  input.focus();
  const finish = (save) => {
    const name = input.value.trim();
    input.remove();
    if (!save || !name) return;
    nodes.push({ id: crypto.randomUUID(), parentId: null, name, role: "", staff: 1, x, y, width: 165, height: 100, placement: "below", color: canvasFillColor });
    renderChart();
    saveChart();
  };
  input.addEventListener("keydown", (keyEvent) => {
    if (keyEvent.key === "Enter") finish(true);
    if (keyEvent.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true));
}

chartTree.addEventListener("dblclick", createInlineCanvasNode);
chartTree.addEventListener("pointerdown", (event) => {
  if (chartTree.classList.contains("chart-free-canvas") && connectMode && !event.target.closest(".chart-canvas-card, button, input")) startFreeLineDrag(event);
});

function renderChart() {
  renderPresentationChart();
}

function renderPresentationChart() {
  chartTree.className = "chart-presentation-board";
  chartTree.replaceChildren();
  document.querySelector(".chart-view-tools")?.setAttribute("hidden", "true");
  addRootButton.hidden = true;
  editorPanel.hidden = true;
  document.querySelector("[data-presentation-view]")?.remove();
  document.querySelector("[data-canvas-color]")?.remove();
  const departmentData = [
    { name: "HỆ THỐNG\nCHI NHÁNH", tone: "terracotta", icon: "♟", groups: [{ name: "CHI NHÁNH 1", items: ["Sale", "Vận hành"] }, { name: "CHI NHÁNH 2", items: ["Sale", "Vận hành"] }] },
    { name: "MARKETING", tone: "sage", icon: "⌁", groups: [{ name: "THƯƠNG HIỆU\n& CONTENT", items: ["Branding", "Content Marketing", "Digital Marketing"] }, { name: "DIGITAL\nMARKETING", items: ["Growth", "Website & SEO", "Social Media"] }, { name: "MEDIA\nCONTENT", items: ["Video", "Hình ảnh"] }] },
    { name: "TC - KT", tone: "sand", icon: "▣", groups: [{ name: "KẾ TOÁN\nTHUẾ", items: ["Kế toán", "Tài chính"] }, { name: "KẾ TOÁN\nNỘI BỘ", items: ["Vải", "Thời trang"] }] },
    { name: "HC - NS", tone: "blue", icon: "♧", groups: [{ name: "HÀNH CHÍNH", items: [] }, { name: "ĐÀO TẠO\nTUYỂN DỤNG", items: [] }, { name: "C&B", items: [] }, { name: "TRUYỀN THÔNG\nNỘI BỘ", items: [] }] },
    { name: "SẢN XUẤT", tone: "rose", icon: "▤", groups: [{ name: "QUẢN LÝ\nGIA CÔNG", items: [] }, { name: "KẾ HOẠCH", items: [] }, { name: "PHÒNG MẪU", items: ["THIẾT KẾ", "CẮT", "MAY MẪU"] }, { name: "QA/QC", items: [] }] },
    { name: "THU MUA\nKHO VẬN", tone: "mint", icon: "⌁", groups: [{ name: "THU MUA", items: [] }, { name: "KHO", items: [] }, { name: "ĐIỀU VẬN", items: [] }] },
    { name: "R&D", tone: "gold", icon: "♢", groups: [{ name: "SẢN PHẨM", items: [] }, { name: "DỊCH VỤ", items: [] }] },
    { name: "CSKH", tone: "lilac", icon: "⚙", groups: [{ name: "CSKH", items: [] }, { name: "HỖ TRỢ", items: [] }, { name: "SALE ADMIN", items: [] }, { name: "KHIẾU NẠI &\nKỸ THUẬT", items: ["Hỗ trợ kỹ thuật", "Quản lý dữ liệu"] }] },
    { name: "Pháp chế", tone: "sky", icon: "♧", groups: [{ name: "Pháp lý", items: [] }, { name: "Hợp đồng", items: [] }] },
  ];
  const compactNodeName = (value) => normalizeSearchText(value).replace(/[^a-z0-9]/g, "");
  const top = document.createElement("div");
  top.className = "presentation-top-level";
  const director = document.createElement("div");
  director.className = "presentation-leader presentation-leader-primary";
  director.innerHTML = '<span class="presentation-leader-icon">●</span><strong>GIÁM ĐỐC</strong>';
  const deputy = document.createElement("div");
  deputy.className = "presentation-leader presentation-leader-deputy";
  deputy.innerHTML = '<span class="presentation-leader-icon">●</span><strong>P. GIÁM ĐỐC</strong>';
  const internal = document.createElement("div");
  internal.className = "presentation-internal-control";
  internal.innerHTML = '<span class="presentation-internal-icon">♢</span><strong>KIỂM SOÁT<br />NỘI BỘ</strong>';
  const internalGroups = document.createElement("div");
  internalGroups.className = "presentation-internal-groups";
  ["KIỂM SOÁT\nTUÂN THỦ", "KIỂM SOÁT\nTÀI CHÍNH"].forEach((name) => {
    const group = document.createElement("div");
    group.textContent = name;
    internalGroups.append(group);
  });
  const leaders = document.createElement("div");
  leaders.className = "presentation-leaders";
  leaders.append(director, deputy, internal, internalGroups);
  const makePresentationLink = (element, name) => {
    const matchingNode = nodes.find((node) => normalizeSearchText(node.name) === normalizeSearchText(name));
    element.classList.add("presentation-clickable");
    element.tabIndex = 0;
    element.setAttribute("role", "link");
    const open = () => {
      if (!matchingNode) {
        window.location.href = `organization-profile.html?department=${encodeURIComponent(name)}`;
        return;
      }
      window.location.href = `organization-profile.html?node=${encodeURIComponent(matchingNode.id)}`;
    };
    element.addEventListener("click", open);
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  };
  makePresentationLink(director, "GIÁM ĐỐC");
  makePresentationLink(deputy, "P. GIÁM ĐỐC");
  makePresentationLink(internal, "KIỂM SOÁT NỘI BỘ");
  top.append(leaders);
  chartTree.append(top);
  const departments = document.createElement("div");
  departments.className = "presentation-departments";
  departmentData.forEach((department) => {
    const column = document.createElement("section");
    column.className = `presentation-department presentation-tone-${department.tone}`;
    const matchingNode = nodes.find((node) => compactNodeName(node.name) === compactNodeName(department.name.replace(/\n/g, " ")));
    column.tabIndex = 0;
    column.setAttribute("role", "link");
    column.setAttribute("aria-label", `Mở thông tin ${department.name.replace(/\n/g, " ")}`);
    const openDepartment = () => {
      if (!matchingNode) {
        window.location.href = `organization-profile.html?department=${encodeURIComponent(department.name.replace(/\n/g, " "))}`;
        return;
      }
      window.location.href = `organization-profile.html?node=${encodeURIComponent(matchingNode.id)}`;
    };
    column.addEventListener("click", openDepartment);
    column.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDepartment();
      }
    });
    const heading = document.createElement("header");
    heading.innerHTML = `<strong>${department.name.replace(/\n/g, "<br />")}</strong>`;
    column.append(heading);
    const groups = document.createElement("div");
    groups.className = "presentation-groups";
    department.groups.forEach((groupData) => {
      const group = document.createElement("div");
      group.className = "presentation-group";
      group.innerHTML = `<strong>${groupData.name.replace(/\n/g, "<br />")}</strong>`;
      groupData.items.forEach((item) => {
        const itemElement = document.createElement("span");
        itemElement.textContent = item;
        group.append(itemElement);
      });
      groups.append(group);
    });
    column.append(groups);
    departments.append(column);
  });
  chartTree.append(departments);
  chartStatus.textContent = "";
  requestAnimationFrame(fitPresentationBoard);
}

function fitPresentationBoard() {
  if (!chartTree.classList.contains("chart-presentation-board")) return;
  const viewportWidth = chartTreeViewport.clientWidth;
  const boardWidth = chartTree.offsetWidth;
  const isMobile = window.matchMedia("(max-width: 650px)").matches;
  const scale = isMobile ? 1 : Math.min(1, viewportWidth / boardWidth);
  if (isMobile) {
    chartTree.style.zoom = String(scale);
    chartTree.style.transform = "none";
    chartTree.style.marginBottom = "0";
    requestAnimationFrame(() => {
      const director = document.querySelector(".presentation-leader-primary");
      if (!director) return;
      const viewportRect = chartTreeViewport.getBoundingClientRect();
      const directorRect = director.getBoundingClientRect();
      chartTreeViewport.scrollLeft = Math.max(0, directorRect.left + directorRect.width / 2 - (viewportRect.left + viewportRect.width / 2));
    });
    return;
  }
  chartTree.style.zoom = String(scale);
  chartTree.style.transform = "none";
  chartTree.style.marginBottom = "0";
  chartTreeViewport.scrollLeft = 0;
}

window.addEventListener("resize", fitPresentationBoard);

async function saveChart() {
  chartStatus.textContent = "Đang lưu sơ đồ...";
  try {
    const response = await fetch("/api/organization-chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes, freeLines }),
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
    placement: ["right", "left"].includes(formData.get("placement")) ? formData.get("placement") : "below",
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
    freeLines = Array.isArray(data.freeLines) ? data.freeLines : [];
    renderChart();
  })
  .catch(async () => {
    try {
      const fallbackResponse = await fetch("organization-chart.json", { cache: "no-store" });
      const fallbackData = await fallbackResponse.json();
      nodes = Array.isArray(fallbackData.nodes) ? fallbackData.nodes : [];
      freeLines = Array.isArray(fallbackData.freeLines) ? fallbackData.freeLines : [];
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
      freeLines = [];
      isAdmin = false;
      addRootButton.hidden = true;
      editorPanel.hidden = true;
      renderChart();
      chartStatus.textContent = "Không thể tải sơ đồ hiện tại. Đang hiển thị sơ đồ mặc định.";
    }
  });
