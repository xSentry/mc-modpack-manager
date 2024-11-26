const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  fetchBranches: async (repoUrl) =>
    ipcRenderer.invoke("fetch-branches", repoUrl),
  selectFolder: async () => ipcRenderer.invoke("select-folder"),
  getSavedSettings: async () => ipcRenderer.invoke("get-saved-settings"),
  gitClone: async (repoUrl, folderPath) =>
    ipcRenderer.invoke("git-clone", repoUrl, folderPath),
  gitPull: async (folderPath, branch) =>
    ipcRenderer.invoke("git-pull", folderPath, branch),
  checkRepo: async (folderPath) => ipcRenderer.invoke("check-repo", folderPath),
  checkoutBranch: async (folderPath, branch) =>
    ipcRenderer.invoke("checkout-branch", folderPath, branch),
  getFolderCounts: async (folderPath) =>
    ipcRenderer.invoke("get-folder-counts", folderPath),
  setJavaArgs: async () => ipcRenderer.invoke("set-java-args"),
  checkModInstallerVisibility: async (folderPath) =>
    ipcRenderer.invoke("check-mod-installer-visibility"),
  runModInstaller: async (folderPath) =>
    ipcRenderer.invoke("run-mod-installer"),
  windowControls: {
    minimize: () => ipcRenderer.send("window-control", "minimize"),
    maximize: () => ipcRenderer.send("window-control", "maximize"),
    close: () => ipcRenderer.send("window-control", "close"),
  },
});
