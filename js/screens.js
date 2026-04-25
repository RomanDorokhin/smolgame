function openUpload() {
  document.getElementById('upload-screen').classList.add('open');
  renderGenrePills('genrePills', 'code');
  renderGenrePills('genrePills2', 'url');
}
function closeUpload() {
  document.getElementById('upload-screen').classList.remove('open');
}

function openProfile() {
  renderProfile();
  loadAdminPending();
  document.getElementById('profile-screen').classList.add('open');
}
function closeProfile() {
  document.getElementById('profile-screen').classList.remove('open');
}

function openSearch() {
  document.getElementById('search-screen').classList.add('open');
  renderGenreFilter();
  onSearch('');
}
function closeSearch() {
  document.getElementById('search-screen').classList.remove('open');
}

function switchTab(tab) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('nav-' + tab)?.classList.add('active');
  if (tab === 'search') openSearch();
  else if (tab === 'profile') openProfile();
  else if (tab === 'feed') { closeSearch(); closeProfile(); }
}

window.openUpload = openUpload;
window.closeUpload = closeUpload;
window.openProfile = openProfile;
window.closeProfile = closeProfile;
window.openSearch = openSearch;
window.closeSearch = closeSearch;
window.switchTab = switchTab;
