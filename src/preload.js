const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    setCreds: (url, username, password) => ipcRenderer.send("set-creds", { url, username, password }),
    onCredsSet: (callback) => ipcRenderer.on("creds-set", () => callback()),
    onCredsError: (callback) => ipcRenderer.on("creds-error", () => callback()),
    onCredsReset: (callback) => ipcRenderer.on("creds-reset", () => callback()),
});