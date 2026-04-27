// Админка. Активируется, если сервер в /api/me вернул isAdmin=true.
// Тогда в профиле появляется блок "На модерации".

async function loadAdminPending() {
  if (!document.body.classList.contains('is-admin')) return;
  const host = document.getElementById('adminPendingList');
  if (!host) return;
  host.innerHTML = '<div class="admin-empty">Загрузка...</div>';

  try {
    const { games } = await API.admin.pending();
    if (!games || games.length === 0) {
      host.innerHTML = '<div class="admin-empty">Очередь пуста 🎉</div>';
      return;
    }
    host.innerHTML = games.map(g => `
      <div class="admin-card" data-game-id="${esc(g.id)}">
        <div class="admin-card-title admin-card-title--row">${typeof genreIconSvg === 'function' && typeof genreIconKeyFromStored === 'function' ? genreIconSvg(genreIconKeyFromStored(g.genre_emoji, g.genre), 'sg-genre-ic--sm') : ''}<span>${esc(g.title)}</span></div>
        <div class="admin-card-meta">
          ${esc(g.genre || 'Без жанра')} · от ${esc(g.authorFirst || g.authorHandle || g.author_id)}<br>
          <a href="${esc(g.url)}" target="_blank" rel="noopener noreferrer">${esc(g.url)}</a>
        </div>
        ${g.description ? `<div style="font-size:13px;color:var(--muted);margin-bottom:10px;">${esc(g.description)}</div>` : ''}
        <div class="admin-actions">
          <button class="admin-btn approve" data-action="admin-approve">✓ Одобрить</button>
          <button class="admin-btn reject"  data-action="admin-reject">✗ Отклонить</button>
          <button class="admin-btn delete"  data-action="admin-delete">🗑 Удалить</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    host.innerHTML = `<div class="admin-empty">⚠️ ${esc(e.message || 'ошибка')}</div>`;
  }
}

async function adminApproveGame(card) {
  const id = card?.dataset.gameId;
  if (!id) return;
  try {
    await API.admin.approve(id);
    card.remove();
    showToast('✅ Одобрено');
    // Если список опустел — покажем пустое состояние.
    const host = document.getElementById('adminPendingList');
    if (host && host.children.length === 0) loadAdminPending();
    // Обновим ленту, чтобы игра появилась у всех.
    if (typeof loadGames === 'function') loadGames();
  } catch (e) {
    showToast('⚠️ ' + (e.message || 'ошибка'));
  }
}

async function adminRejectGame(card) {
  const id = card?.dataset.gameId;
  if (!id) return;
  try {
    await API.admin.reject(id);
    card.remove();
    showToast('✗ Отклонено');
    const host = document.getElementById('adminPendingList');
    if (host && host.children.length === 0) loadAdminPending();
    if (typeof loadGames === 'function') loadGames();
  } catch (e) {
    showToast('⚠️ ' + (e.message || 'ошибка'));
  }
}

async function adminDeleteGame(card) {
  const id = card?.dataset.gameId;
  if (!id) return;
  if (!confirm('Удалить игру из базы?')) return;
  try {
    await API.delete(id);
    card.remove();
    showToast('🗑 Удалено');
    const host = document.getElementById('adminPendingList');
    if (host && host.children.length === 0) loadAdminPending();
    loadGames();
  } catch (e) {
    showToast('⚠️ ' + (e.message || 'ошибка'));
  }
}

window.loadAdminPending = loadAdminPending;
window.adminApproveGame = adminApproveGame;
window.adminRejectGame = adminRejectGame;
window.adminDeleteGame = adminDeleteGame;
