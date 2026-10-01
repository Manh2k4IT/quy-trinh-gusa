const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopSettings", {
  isDesktop: true,
  getServerUrl: () => ipcRenderer.invoke("server:get-url"),
  saveServerUrl: (url) => ipcRenderer.invoke("server:save-url", url),
  showApp: () => ipcRenderer.send("app:show-window"),
  notify: (notification) => ipcRenderer.send("app:notify", notification),
  onAppOpened: (callback) => ipcRenderer.on("app:opened", callback),
});