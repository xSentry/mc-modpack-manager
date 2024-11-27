const repoUrl = "https://github.com/xSentry/minecraft-modpacks";
let folderPath = "";
let repoStatus = "not-cloned";

showLoadingOverlay();

document.addEventListener("DOMContentLoaded", async () => {
  const gitStatus = await window.api.checkGit();

  if (!gitStatus.installed) {
    showLoadingOverlay("Installing Git! Please wait...");
    await window.api.installGit();
    showLoadingOverlay();
  }

  await initializeApp();
});

async function initializeApp() {
  const savedSettings = await window.api.getSavedSettings();
  folderPath = savedSettings.folderPath || "";
  const folderPathDisplay = document.getElementById("folder-path");

  if (folderPath && folderPath !== "") {
    folderPathDisplay.innerText = folderPath;
    await checkRepoStatus(folderPath);
    await updateFolderCounts(folderPath);
    await checkModInstallerVisibility();
  } else {
    folderPathDisplay.innerText = "No folder selected";
  }
  setupEventListeners();

  hideLoadingOverlay();
}

async function checkModInstallerVisibility() {
  const visibilityResult = await window.api.checkModInstallerVisibility();

  const installButton = document.getElementById("install-mod-client-btn");

  if (visibilityResult.visible) {
    installButton.style.display = "block";
  } else {
    installButton.style.display = "none";
  }
}

function setupEventListeners() {
  document
    .getElementById("select-folder-btn")
    .addEventListener("click", async () => {
      showLoadingOverlay();
      await handleFolderSelection();
      await checkModInstallerVisibility();
      hideLoadingOverlay();
    });

  document.getElementById("action-btn").addEventListener("click", async () => {
    showLoadingOverlay();
    await handleActionButton();
    hideLoadingOverlay();
  });

  document.getElementById("branch-select").addEventListener("change", () => {
    showLoadingOverlay();
    document.getElementById("action-btn").innerText = "Load Modpack";
    hideLoadingOverlay();
  });

  document.getElementById("minimize-btn").addEventListener("click", () => {
    showLoadingOverlay();
    window.api.windowControls.minimize();
    hideLoadingOverlay();
  });

  document.getElementById("maximize-btn").addEventListener("click", () => {
    showLoadingOverlay();
    window.api.windowControls.maximize();
    hideLoadingOverlay();
  });

  document.getElementById("close-btn").addEventListener("click", () => {
    showLoadingOverlay();
    window.api.windowControls.close();
    hideLoadingOverlay();
  });

  document
    .getElementById("set-java-args-btn")
    .addEventListener("click", async () => {
      showLoadingOverlay();
      const result = await window.api.setJavaArgs();

      const output = document.getElementById("output");
      if (result.success) {
        output.innerText = result.message;
      } else {
        output.innerText = `Failed to set JVM arguments: ${result.message}`;
      }
      hideLoadingOverlay();
    });

  document
    .getElementById("install-mod-client-btn")
    .addEventListener("click", async () => {
      const output = document.getElementById("output");

      try {
        const result = await window.api.runModInstaller();
        output.innerText = result;
      } catch (error) {
        output.innerText = `Error installing mod client: ${error.message}`;
      }
    });
}

async function handleFolderSelection() {
  folderPath = await window.api.selectFolder();
  const folderPathDisplay = document.getElementById("folder-path");

  if (folderPath) {
    folderPathDisplay.innerText = folderPath;
    await checkRepoStatus(folderPath);
  } else {
    folderPathDisplay.innerText = "No folder selected";
  }
}

async function handleActionButton() {
  const branch = document.getElementById("branch-select").value;

  if (repoStatus === "not-cloned") {
    const message = await window.api.gitClone(repoUrl, folderPath);
    document.getElementById("output").innerText = message;

    await checkRepoStatus(folderPath, true);
  } else if (repoStatus === "cloned") {
    const actionButton = document.getElementById("action-btn");
    const isLoadBranchAction = actionButton.innerText === "Load Modpack";

    const message = isLoadBranchAction
      ? await window.api.checkoutBranch(folderPath, branch)
      : await window.api.gitPull(folderPath, branch);

    document.getElementById("output").innerText = message;

    await updateFolderCounts(folderPath);
    await checkRepoStatus(folderPath);
  }
}

async function checkRepoStatus(folderPath, autoCheckout = false) {
  const repoInfo = await window.api.checkRepo(folderPath);
  repoStatus = repoInfo.status;

  if (repoStatus === "cloned") {
    if (repoInfo.currentBranch === "master" && repoInfo.branches.length > 0) {
      const firstBranch = repoInfo.branches[0];
      const checkoutMessage = await window.api.checkoutBranch(
        folderPath,
        firstBranch,
      );
      document.getElementById("output").innerText =
        `Master branch filtered. Auto-switched to branch: ${firstBranch}. ${checkoutMessage}`;
      populateBranchDropdown(repoInfo.branches, firstBranch);
    } else {
      populateBranchDropdown(repoInfo.branches, repoInfo.currentBranch);
    }

    toggleActionButton("update");
  } else {
    const branches = await window.api.fetchBranches(repoUrl);
    populateBranchDropdown(branches);
    toggleActionButton("clone");
  }
}

function populateBranchDropdown(branches, currentBranch = "") {
  const branchSelect = document.getElementById("branch-select");

  branchSelect.innerHTML = branches
    .map(
      (branch) =>
        `<option value="${branch}" ${
          branch === currentBranch ? "selected" : ""
        }>${branch}</option>`,
    )
    .join("");
}

function toggleActionButton(action) {
  const button = document.getElementById("action-btn");
  button.innerText =
    action === "clone" ? "Initialize Manager" : "Update Modpack";
}

async function updateFolderCounts(folderPath) {
  const { modsCount, resourcepacksCount } =
    await window.api.getFolderCounts(folderPath);
  document.getElementById("mods-count").innerText = `Mods: ${modsCount}`;
  document.getElementById("resourcepacks-count").innerText =
    `Resourcepacks: ${resourcepacksCount}`;
}

function showLoadingOverlay(message = "Loading, please wait...") {
  const overlay = document.getElementById("loading-overlay");
  const messageElement = overlay.querySelector("p");
  messageElement.innerText = message;
  overlay.style.display = "flex";
}

function hideLoadingOverlay() {
  const overlay = document.getElementById("loading-overlay");
  overlay.style.display = "none";
}
