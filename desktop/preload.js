const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopSettings", {
  isDesktop: true,
  getServerUrl: () => ipcRenderer.invoke("server:get-url"),
  saveServerUrl: (url) => ipcRenderer.invoke("server:save-url", url),
  showApp: () => ipcRenderer.send("app:show-window"),
  notify: (notification) => ipcRenderer.send("app:notify", notification),
  openLocationSettings: () => ipcRenderer.invoke("app:open-location-settings"),
  previewDocument: (html) => ipcRenderer.invoke("app:preview-document", html),
  getCurrentPosition: (onSuccess, onError) => {
    ipcRenderer.invoke("app:get-location").then((result) => {
      if (result.ok) onSuccess(result.position);
      else onError({ ...result.error, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    }, (error) => {
      console.error("Không thể yêu cầu vị trí Windows:", error);
      onError({ code: 2, message: error.message, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    });
  },
  onAppOpened: (callback) => ipcRenderer.on("app:opened", callback),
});