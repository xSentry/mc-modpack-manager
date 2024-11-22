const repoUrl = "https://github.com/xSentry/minecraft-modpacks";
let folderPath = "";
let repoStatus = "not-cloned";

document.addEventListener("DOMContentLoaded", async () => {
  await initializeApp();
});

async function initializeApp() {
  const savedSettings = await window.api.getSavedSettings();
  folderPath = savedSettings.folderPath || "";
  const folderPathDisplay = document.getElementById("folder-path");

  if (folderPath) {
    folderPathDisplay.innerText = folderPath;
    await checkRepoStatus(folderPath);
    await updateFolderCounts(folderPath);
  } else {
    folderPathDisplay.innerText = "No folder selected";
  }

  await populateBranchDropdown(await window.api.fetchBranches(repoUrl));
  setupEventListeners();

  document.getElementById("minimize-btn").addEventListener("click", () => {
    window.api.windowControls.minimize();
  });

  document.getElementById("maximize-btn").addEventListener("click", () => {
    window.api.windowControls.maximize();
  });

  document.getElementById("close-btn").addEventListener("click", () => {
    window.api.windowControls.close();
  });
}

function setupEventListeners() {
  document
    .getElementById("select-folder-btn")
    .addEventListener("click", async () => {
      await handleFolderSelection();
    });

  document.getElementById("action-btn").addEventListener("click", async () => {
    await handleActionButton();
  });

  document.getElementById("branch-select").addEventListener("change", () => {
    document.getElementById("action-btn").innerText = "Load Modpack";
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
