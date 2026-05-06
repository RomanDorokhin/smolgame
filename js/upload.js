// SmolGame Upload/Create Screen Logic (Replaced with Agent Integration)

// Initialize global state expected by other scripts (e.g. Profile)
window.selectedGenres = window.selectedGenres || {};
window.selectedUploadMethod = window.selectedUploadMethod || 'agent';

async function refreshUploadCapabilities() {
  // Agent handles its own auth and capabilities
}

function syncPremiumMethodCard() {
  // Deprecated
}

function refreshPremiumPanelAccess() {
  // Deprecated
}

function updateGithubUploadUi() {
  // Deprecated
}

async function selectMethod(m) {
  // Deprecated - we only use the Agent now
}

async function githubUnlink() {
  // Deprecated
}

async function authGithub() {
  // Deprecated
}

function githubUploadSetMode(mode) {
  // Deprecated
}

function onGithubMultiFilesChange(input) {
  // Deprecated
}

function renderGithubFilesList() {
  // Deprecated
}

function ghwzSetStep(n) {
  // Deprecated
}

async function githubWizardPublishRepo() {
  // Deprecated
}

async function githubWizardSubmitModeration() {
  // Deprecated
}

async function submitGame(method) {
  // Deprecated
}

function previewCover(input) {
  // Deprecated
}

async function uploadShowPremium() {
  // Deprecated
}

// Global exposure for potential legacy calls
window.githubWizardStepBack = () => {};
window.githubWizardPublishRepo = () => {};
window.githubWizardSubmitModeration = () => {};
window.ghwzSetStep = () => {};
window.selectMethod = () => {};
window.refreshUploadCapabilities = refreshUploadCapabilities;
window.authGithub = () => {};
window.submitGame = () => {};
window.previewCover = () => {};
window.githubUnlink = () => {};
window.githubUploadSetMode = () => {};
window.resetGhCodeWizard = () => {};
window.ghCodeWizardCancel = () => {};
window.previewGhCodeWizardCover = () => {};
window.setUrlUploadStep = () => {};
window.urlFlowNext = () => {};
window.urlFlowBack = () => {};
window.refreshGhPublishReviewBox = () => {};
window.uploadShowPremium = () => {};

// Agent Communication Helper
window.sendToAgent = function(data) {
  const iframe = document.getElementById('agent-iframe');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage(data, '*');
  }
};

// Listen for messages from Agent (e.g., when a game is published)
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GAME_PUBLISHED') {
    // Optionally refresh feed or profile
    if (typeof loadAdminPending === 'function') loadAdminPending();
    // Maybe switch back to feed?
    // if (typeof switchTab === 'function') switchTab('feed');
  }
});
