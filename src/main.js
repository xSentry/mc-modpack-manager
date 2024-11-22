const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const simpleGit = require("simple-git");
const log = require("electron-log");

log.initialize();
log.info("Main process started.");

let win;

const settingsFilePath = path.join(
  app.getPath("userData"),
  "mc-mod-manager-settings.json",
);

// Utility functions for settings management
const readSettings = () => {
  try {
    return fs.existsSync(settingsFilePath)
      ? JSON.parse(fs.readFileSync(settingsFilePath, "utf-8"))
      : {};
  } catch (error) {
    log.error("Error reading settings file:", error);
    return {};
  }
};

const saveSettings = (settings) => {
  try {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
  } catch (error) {
    log.error("Error saving settings file:", error);
  }
};

// Helper to initialize or fetch Git instance
const getGitInstance = (folderPath) => simpleGit(folderPath);

Menu.setApplicationMenu(null);

app.on("ready", () => {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile("./src/index.html");
});

// Handlers
ipcMain.handle("select-folder", async () => {
  const settings = readSettings();
  const defaultPath = settings.selectedFolder || process.env.APPDATA || "";
  try {
    const result = await dialog.showOpenDialog(win, {
      title: "Select Minecraft Mods Folder",
      defaultPath,
      properties: ["openDirectory"],
    });
    if (result.filePaths[0]) {
      settings.selectedFolder = result.filePaths[0];
      saveSettings(settings);
    }
    return result.filePaths[0] || null;
  } catch (error) {
    log.error("Error selecting folder:", error);
    return null;
  }
});

ipcMain.handle("save-branch", (_, branch) => {
  const settings = readSettings();
  settings.selectedBranch = branch;
  saveSettings(settings);
});

ipcMain.handle("get-saved-settings", () => {
  const settings = readSettings();
  return {
    folderPath: settings.selectedFolder || null,
    branch: settings.selectedBranch || "main",
  };
});

ipcMain.handle("check-repo", async (_, folderPath) => {
  try {
    const git = simpleGit(folderPath);

    if (!(await git.checkIsRepo())) {
      log.info("Folder is not a Git repository:", folderPath);
      return { status: "not-cloned" };
    }

    await git.fetch(["--all"]);

    const localBranches = await git.branchLocal();
    const remoteBranches = (await git.branch(["-r"])).all.map((branch) =>
      branch.replace(/^origin\//, ""),
    );

    // Filter out 'master' from local and remote branches
    const allBranches = Array.from(
      new Set([...localBranches.all, ...remoteBranches]),
    ).filter((branch) => branch !== "master");

    log.info("Local branches (filtered):", localBranches.all);
    log.info("Remote branches (filtered):", remoteBranches);
    log.info("All branches (filtered):", allBranches);

    return {
      status: "cloned",
      currentBranch:
        localBranches.current === "master"
          ? allBranches[0]
          : localBranches.current,
      branches: allBranches,
    };
  } catch (error) {
    log.error("Error checking repo:", error);
    return { status: "not-cloned" };
  }
});

ipcMain.handle("checkout-branch", async (_, folderPath, branch) => {
  try {
    const git = getGitInstance(folderPath);
    await git.fetch();
    await git.checkout(branch);
    return `Switched to Modpack ${branch}`;
  } catch (error) {
    log.error("Error checking out branch:", error);
    return `Error checking out Modpack: ${error.message}`;
  }
});

ipcMain.handle("git-clone", async (_, repoUrl, folderPath) => {
  try {
    const git = simpleGit();
    await git.clone(repoUrl, folderPath, ["-b", "master"]);

    const repoGit = getGitInstance(folderPath);
    await repoGit.fetch(["--all"]);

    log.info("Fetched branches after cloning:", (await repoGit.branch()).all);

    return "Manager initialized successfully!";
  } catch (error) {
    log.error("Error cloning repository:", error);
    return `Error cloning repository: ${error.message}`;
  }
});

ipcMain.handle("git-pull", async (_, folderPath, branch) => {
  try {
    const git = getGitInstance(folderPath);
    await git.checkout(branch);
    await git.pull();
    return "Modpack updated!";
  } catch (error) {
    log.error("Error pulling repository:", error);
    return `Error pulling repository: ${error.message}`;
  }
});

ipcMain.handle("fetch-branches", async (_, repoUrl) => {
  try {
    const git = simpleGit();
    const branches = await git.listRemote(["--heads", repoUrl]);

    const branchList = branches
      .split("\n")
      .map((line) => {
        const match = line.match(/refs\/heads\/(.+)/);
        return match ? match[1] : null;
      })
      .filter((branch) => branch && branch !== "master");

    log.info("Remote Modpacks fetched:", branchList);

    return branchList;
  } catch (error) {
    log.error("Error fetching branches:", error);
    return [`Error fetching Modpacks: ${error.message}`];
  }
});

ipcMain.on("window-control", (event, action) => {
  const window = BrowserWindow.getFocusedWindow();
  if (!window) return;

  switch (action) {
    case "minimize":
      window.minimize();
      break;
    case "maximize":
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
      break;
    case "close":
      window.close();
      break;
  }
});

ipcMain.handle("get-folder-counts", async (_, folderPath) => {
  try {
    const modsPath = path.join(folderPath, "mods");
    const resourcepacksPath = path.join(folderPath, "resourcepacks");

    const countFiles = (dir, extension) =>
      fs.existsSync(dir) && fs.statSync(dir).isDirectory()
        ? fs
            .readdirSync(dir)
            .filter(
              (file) =>
                file.endsWith(extension) &&
                fs.statSync(path.join(dir, file)).isFile(),
            ).length
        : 0;

    const modsCount = countFiles(modsPath, ".jar"); // Count only .jar files
    const resourcepacksCount = countFiles(resourcepacksPath, ".zip"); // Count only .zip files

    return { modsCount, resourcepacksCount };
  } catch (error) {
    log.error("Error counting folder contents:", error);
    return { modsCount: 0, resourcepacksCount: 0 };
  }
});
