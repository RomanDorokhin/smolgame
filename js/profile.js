async function renderProfile() {
  document.getElementById('profileAvatar').textContent = USER.avatar;
  document.getElementById('profileName').textContent = USER.name;
  document.getElementById('profileHandle').textContent = '@' + USER.username;

  // Пока не пришёл ответ — показываем черновые значения.
  const myGames = GAMES.filter(g => g.authorId === USER.id);
  document.getElementById('statGames').textContent = myGames.length;
  document.getElementById('statFollowers').textContent = '—';
  document.getElementById('statLikes').textContent =
    fmtNum(myGames.reduce((s, g) => s + g.likes, 0));

  if (USER.isGithubConnected) document.getElementById('devBadge').style.display = '';

  // Реальные данные с сервера.
  try {
    const me = await API.me();
    if (me?.stats) {
      document.getElementById('statGames').textContent     = me.stats.games;
      document.getElementById('statLikes').textContent     = fmtNum(me.stats.likes);
      document.getElementById('statFollowers').textContent = fmtNum(me.stats.followers);
    }
    if (me?.user?.isAdmin) {
      document.body.classList.add('is-admin');
    }
  } catch (e) {
    // Не критично — оставляем черновые значения.
  }

  const grid = document.getElementById('myGamesGrid');
  if (myGames.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:var(--muted);font-size:14px;">Ты ещё не загружал игры</div>`;
  } else {
    grid.innerHTML = myGames.map(g => `
      <div class="game-card">
        <div class="game-card-thumb">${esc(g.genreEmoji || '🎮')}</div>
        <div class="game-card-info">
          <div class="game-card-name">${esc(g.title)}</div>
          <div class="game-card-stats">❤️ ${fmtNum(g.likes)} · 👁 ${fmtNum(g.plays)}</div>
        </div>
      </div>
    `).join('');
  }
}

window.renderProfile = renderProfile;
