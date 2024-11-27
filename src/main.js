const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const simpleGit = require("simple-git");
const log = require("electron-log");
const { exec, spawn } = require("child_process");
const https = require("https");

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
    const git = getGitInstance(folderPath);

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
    const git = getGitInstance(folderPath);

    await git.init();
    await git.addRemote("origin", repoUrl);
    await git.fetch(["--all"]);
    await git.checkout("master");

    log.info("Fetched branches after cloning:", (await git.branch()).all);

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
    const git = getGitInstance();
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

ipcMain.handle("set-java-args", async () => {
  try {
    const settings = readSettings();
    const folderPath = settings.selectedFolder || undefined;

    if (!folderPath || folderPath === "") {
      return;
    }

    const profilesFilePath = path.join(folderPath, "launcher_profiles.json");

    if (!fs.existsSync(profilesFilePath)) {
      throw new Error("launcher_profiles.json not found.");
    }

    const profilesData = JSON.parse(fs.readFileSync(profilesFilePath, "utf-8"));

    const totalRam = os.totalmem(); // Total RAM in bytes
    const ram80Percent = Math.floor((totalRam * 0.8) / 1024 ** 3); // Convert to GB

    const jvmArgs = [
      `-Xmx${ram80Percent}G`,
      "-XX:+UnlockExperimentalVMOptions",
      "-XX:+UseG1GC",
      "-XX:G1NewSizePercent=20",
      "-XX:G1ReservePercent=20",
      "-XX:MaxGCPauseMillis=50",
      "-XX:G1HeapRegionSize=32M",
    ].join(" ");

    let profileCount = 0;

    if (profilesData.profiles) {
      for (const profileKey in profilesData.profiles) {
        const profile = profilesData.profiles[profileKey];

        if (profile.name === "") {
          continue;
        }

        if (profile.javaArgs !== undefined) {
          profile.javaArgs = jvmArgs; // Update Java arguments
        } else {
          profile["javaArgs"] = jvmArgs; // Add Java arguments if not present
        }

        profileCount++;
      }
    } else {
      throw new Error("No profiles found in launcher_profiles.json.");
    }

    if (profileCount === 0) {
      throw new Error("No mod profiles found. Install a mod profile first.");
    }

    // Write back to launcher_profiles.json
    fs.writeFileSync(
      profilesFilePath,
      JSON.stringify(profilesData, null, 2),
      "utf-8",
    );

    return {
      success: true,
      message: `Updated JVM arguments for ${profileCount} profile(s) in launcher_profiles.json to: \n ${jvmArgs}`,
    };
  } catch (error) {
    console.error("Error updating JVM arguments:", error.message);

    return {
      success: false,
      message: `Error: ${error.message}`,
    };
  }
});

ipcMain.handle("check-mod-installer-visibility", async (_) => {
  const settings = readSettings();
  const folderPath = settings.selectedFolder || undefined;

  if (!folderPath || folderPath === "") {
    return;
  }

  try {
    const isJavaAvailable = await new Promise((resolve) => {
      exec("java -version", (error) => resolve(!error));
    });

    if (!isJavaAvailable) {
      return {
        visible: false,
        reason: "Java is not installed or not available in PATH.",
      };
    }

    const profilesFilePath = path.join(folderPath, "launcher_profiles.json");

    if (!fs.existsSync(profilesFilePath)) {
      return {
        visible: false,
        reason: "launcher_profiles.json not found.",
      };
    }

    const profilesData = JSON.parse(fs.readFileSync(profilesFilePath, "utf-8"));
    const profiles = profilesData?.profiles
      ? Object.values(profilesData.profiles)
      : [];

    const installerPath = path.join(folderPath, "forgeinstaller");

    if (!fs.existsSync(installerPath)) {
      return {
        visible: false,
        reason: "forgeinstaller folder not found.",
      };
    }

    // Find the first .jar file in the folder
    const jarFile = fs
      .readdirSync(installerPath)
      .find((file) => file.endsWith(".jar"));

    if (!jarFile) {
      return {
        visible: false,
        reason: "No .jar file found in the forgeinstaller folder.",
      };
    }

    // Check if any profile has a lastVersionId that is a substring of the jar file
    const matchingProfile = profiles.find((profile) =>
      jarFile.includes(profile.lastVersionId),
    );

    if (matchingProfile) {
      return {
        visible: false,
        reason: `Installer matches the current version (${matchingProfile.lastVersionId}). No installation needed.`,
      };
    }

    return {
      visible: true,
      reason:
        "Installer found and is not already installed. Ready for installation.",
    };
  } catch (error) {
    console.error("Error checking mod installer visibility:", error.message);
    return {
      visible: false,
      reason: `Error: ${error.message}`,
    };
  }
});

ipcMain.handle("run-mod-installer", async (_) => {
  const settings = readSettings();
  const folderPath = settings.selectedFolder || undefined;

  if (!folderPath || folderPath === "") {
    return;
  }

  try {
    const installerPath = path.join(folderPath, "forgeinstaller");

    const jarFile = fs
      .readdirSync(installerPath)
      .find((file) => file.endsWith(".jar"));

    if (!jarFile) {
      throw new Error("No .jar file found in the forgeinstaller folder.");
    }

    const jarFilePath = path.join(installerPath, jarFile);

    const javaProcess = spawn("java", ["-jar", jarFilePath], {
      cwd: installerPath,
      stdio: "inherit",
    });

    return new Promise((resolve, reject) => {
      javaProcess.on("close", (code) => {
        if (code === 0) {
          resolve("Mod client installed successfully.");
        } else {
          reject(new Error(`Installation failed with exit code ${code}.`));
        }
      });

      javaProcess.on("error", (error) => {
        reject(error);
      });
    });
  } catch (error) {
    console.error("Error running mod installer:", error.message);
    return `Error: ${error.message}`;
  }
});

const checkGit = async () =>
  new Promise((resolve, reject) => {
    exec("git --version", (error, stdout) => {
      if (error) {
        return resolve({ installed: false, version: null });
      }

      const gitVersion = stdout.trim();
      resolve({ installed: true, version: gitVersion });
    });
  });

const downloadAndInstallGit = async () => {
  const gitInstallerUrl =
    "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/Git-2.47.1-64-bit.exe";
  const installerPath = path.join(app.getPath("temp"), "git-installer.exe");

  await downloadFile(gitInstallerUrl, installerPath);

  const installResult = await installGit(installerPath);

  return { installed: false, installedVersion: installResult };
};

const downloadFile = (url, dest) =>
  new Promise((resolve, reject) => {
    let file;

    const request = https.get(url, (response) => {
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        return downloadFile(response.headers.location, dest)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        return reject(
          new Error(`Failed to download file: ${response.statusCode}`),
        );
      }

      file = fs.createWriteStream(dest);

      response.pipe(file);

      file.on("finish", () => {
        file.close(() => {
          resolve(dest);
        });
      });

      file.on("error", (err) => {
        file.close(() => {
          fs.unlink(dest, () => reject(err));
        });
      });
    });

    request.on("error", (err) => {
      if (file) {
        file.close(() => {
          fs.unlink(dest, () => reject(err));
        });
      } else {
        reject(err);
      }
    });
  });

const installGit = (installerPath) =>
  new Promise((resolve, reject) => {
    if (!fs.existsSync(installerPath)) {
      return reject(new Error(`Installer not found at: ${installerPath}`));
    }

    const command = `"${installerPath}" /VERYSILENT /NORESTART`;

    exec(command, { cwd: path.dirname(installerPath) }, async (error) => {
      if (error) {
        return reject(error);
      }

      addGitToPath();
      await waitForGitAvailability();

      app.relaunch();
      app.exit(0);
    });
  });

const addGitToPath = () => {
  const gitDir = "C:\\Program Files\\Git\\cmd";
  if (!process.env.PATH.includes(gitDir)) {
    process.env.PATH += `;${gitDir}`;
  }
};

const waitForGitAvailability = async (timeout = 60000, interval = 5000) => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const gitAvailable = await new Promise((resolveCheck) => {
      exec("git --version", (err) => resolveCheck(!err));
    });

    if (gitAvailable) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error("Git not available after waiting.");
};

ipcMain.handle("check-git", async () => {
  return checkGit();
});

ipcMain.handle("install-git", async () => {
  return downloadAndInstallGit();
});
