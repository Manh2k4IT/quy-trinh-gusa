const { app, BrowserWindow, Menu, Notification, Tray, ipcMain, session, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const defaultServerUrl = "https://quytrinh.gusa.vn";
const configPath = () => path.join(app.getPath("userData"), "config.json");
let mainWindow;
let tray;
let isQuitting = false;

function readServerUrl() {
  try {
    const config = JSON.parse(fs.readFileSync(configPath(), "utf8"));
    return normalizeServerUrl(config.serverUrl) || defaultServerUrl;
  } catch {
    return defaultServerUrl;
  }
}

function normalizeServerUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    return url.origin;
  } catch {
    return "";
  }
}

async function loadApp() {
  const serverUrl = readServerUrl();
  if (serverUrl) {
    await mainWindow.loadURL(serverUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "setup.html"));
  }
}

function showServerSettings() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadFile(path.join(__dirname, "setup.html"));
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function createTray() {
  const icon = await app.getFileIcon(app.getPath("exe"), { size: "small" });
  tray = new Tray(icon);
  tray.setToolTip("Gusa Quy Trinh - đang chạy nền");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Mở Gusa Quy Trinh", click: showMainWindow },
    { label: "Đổi địa chỉ máy chủ", click: showServerSettings },
    { type: "separator" },
    {
      label: "Khởi động cùng Windows",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, args: ["--hidden"] }),
    },
    { type: "separator" },
    { label: "Thoát hoàn toàn", click: () => app.quit() },
  ]));
  tray.on("click", showMainWindow);
  tray.on("double-click", showMainWindow);
}

function configureNotificationPermissions() {
  const isTrustedOrigin = (value) => normalizeServerUrl(value) === readServerUrl();
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details?.requestingUrl || webContents.getURL();
    callback(permission === "notifications" && isTrustedOrigin(requestingUrl));
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) =>
    permission === "notifications" && isTrustedOrigin(requestingOrigin));
}

function isSetupFrame(event) {
  return event.senderFrame?.url === pathToFileURL(path.join(__dirname, "setup.html")).href;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    if (!app.commandLine.hasSwitch("hidden")) mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (["http:", "https:"].includes(new URL(url).protocol)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.on("close", (event) => {
    if (tray && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  loadApp();
}

ipcMain.handle("server:get-url", (event) => isSetupFrame(event) ? readServerUrl() : "");
const isTrustedAppFrame = (event) => normalizeServerUrl(event.senderFrame?.url) === readServerUrl();
ipcMain.on("app:show-window", (event) => {
  if (isTrustedAppFrame(event)) showMainWindow();
});
ipcMain.on("app:notify", (event, payload = {}) => {
  if (!isTrustedAppFrame(event) || !Notification.isSupported()) return;
  const notification = new Notification({
    title: String(payload.title || "Gusa Quy Trinh").slice(0, 100),
    body: String(payload.body || "").slice(0, 300),
  });
  notification.on("click", showMainWindow);
  notification.show();
});
ipcMain.handle("server:save-url", async (event, value) => {
  if (!isSetupFrame(event)) return { ok: false, error: "Yêu cầu không hợp lệ." };
  const serverUrl = normalizeServerUrl(value);
  if (!serverUrl) return { ok: false, error: "Nhập địa chỉ máy chủ bắt đầu bằng http:// hoặc https://." };

  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify({ serverUrl }, null, 2));
  await mainWindow.loadURL(serverUrl);
  return { ok: true };
});

app.whenReady().then(() => {
  configureNotificationPermissions();
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "Máy chủ",
      submenu: [
        { label: "Đổi địa chỉ máy chủ", click: showServerSettings },
        { type: "separator" },
        { label: "Thoát hoàn toàn", click: () => app.quit() },
      ],
    },
  ]));

  createTray().then(createWindow).catch((error) => {
    console.error("Không thể khởi tạo khay hệ thống:", error);
    createWindow();
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showMainWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});