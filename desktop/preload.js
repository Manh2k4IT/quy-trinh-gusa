const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopSettings", {
  getServerUrl: () => ipcRenderer.invoke("server:get-url"),
  saveServerUrl: (url) => ipcRenderer.invoke("server:save-url", url),
  showApp: () => ipcRenderer.send("app:show-window"),
  notify: (notification) => ipcRenderer.send("app:notify", notification),
});