function renderProfile() {
  document.getElementById('profileAvatar').textContent = USER.avatar;
  document.getElementById('profileName').textContent = USER.name;
  document.getElementById('profileHandle').textContent = '@' + USER.username;

  const myGames = GAMES.filter(g => g.authorId === USER.id);
  document.getElementById('statGames').textContent = myGames.length;
  // TODO: заменить на значения из API.
  document.getElementById('statFollowers').textContent = fmtNum(Math.floor(Math.random() * 100));
  document.getElementById('statLikes').textContent =
    fmtNum(myGames.reduce((s, g) => s + g.likes, 0));

  if (USER.isGithubConnected) document.getElementById('devBadge').style.display = '';

  const grid = document.getElementById('myGamesGrid');
  if (myGames.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:var(--muted);font-size:14px;">Ты ещё не загружал игры</div>`;
  } else {
    grid.innerHTML = myGames.map(g => `
      <div class="game-card">
        <div class="game-card-thumb">${g.genreEmoji || '🎮'}</div>
        <div class="game-card-info">
          <div class="game-card-name">${g.title}</div>
          <div class="game-card-stats">❤️ ${fmtNum(g.likes)} · 👁 ${fmtNum(g.plays)}</div>
        </div>
      </div>
    `).join('');
  }
}

window.renderProfile = renderProfile;
