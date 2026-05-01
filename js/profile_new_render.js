async function renderProfile() {
  try {
    console.log('[Profile] renderProfile start. USER.id:', USER.id);
    const bioRead = document.getElementById('profileBio');
    const handleRead = document.getElementById('profileSiteHandleRead');

    await waitTelegramUserForProfile(4000);
    syncUserFromTelegramWebApp();
    setProfileMeBannerVisible(false);

    setProfileAvatar(USER.avatar);
    const nameEl = document.getElementById('profileName');
    if (nameEl) nameEl.textContent = USER.name || USER.id || tf('guest');
    
    const handleEl = document.getElementById('profileHandle');
    if (handleEl) handleEl.textContent = '@' + (USER.siteHandle || USER.id || '—');
    
    if (handleRead) handleRead.textContent = USER.siteHandle || USER.id || '—';
    if (bioRead) bioRead.textContent = '';

    const setStatGames = v => { const el = document.getElementById('statGames'); if (el) el.textContent = v; };
    const setStatFollowers = v => { const el = document.getElementById('statFollowers'); if (el) el.textContent = v; };
    const setStatLikes = v => { const el = document.getElementById('statLikes'); if (el) el.textContent = v; };
    setStatGames('…');
    setStatFollowers('…');
    setStatLikes('…');
    
    const compose = document.getElementById('profileWallCompose');
    if (compose) compose.hidden = false;

    const devBadge = document.getElementById('devBadge');
    if (devBadge) devBadge.style.display = USER.isGithubConnected ? '' : 'none';
    
    const premBadge = document.getElementById('premiumBadge');
    if (premBadge) premBadge.style.display = USER.isPremium ? '' : 'none';

    let me = null;
    try {
      me = await API.me();
      console.log('[Profile] API.me success:', Boolean(me?.user));
      applyMeToProfileUi(me, { bioRead, handleRead, premBadge, setStatGames, setStatFollowers, setStatLikes });
    } catch (err) {
      console.error('[Profile] API.me failed', err);
    }

    let myGames = [];
    try {
      const myGamesRes = await API.myGames();
      myGames = Array.isArray(myGamesRes?.games) ? myGamesRes.games : [];
    } catch (e) {
      console.warn('[Profile] API.myGames failed', e);
      myGames = Array.isArray(window.GAMES) ? window.GAMES.filter(g => sameTelegramUserId(g.authorId, USER.id)) : [];
    }

    const publishedCount = myGames.filter(g => g && g.status === 'published').length;
    setStatGames(String(publishedCount));
    
    const sumLikes = myGames.reduce((acc, g) => acc + (Number(g?.likes) || 0), 0);
    setStatLikes(fmtNum(sumLikes));
    setStatFollowers('0');

    // Загружаем стену
    if (USER.id) {
      void loadUserPosts(USER.id, 'profilePostList');
    }

    const grid = document.getElementById('myGamesGrid');
    if (!grid) {
      console.warn('renderProfile: #myGamesGrid missing');
      return;
    }

    if (myGames.length === 0) {
      grid.innerHTML =
        typeof sgEmptyGridHtml === 'function'
          ? sgEmptyGridHtml(tf('profile_empty_games_title'), tf('profile_empty_games_sub'))
          : `<div class="sg-empty-state sg-empty-state--grid"><div class="sg-empty-state-title">${esc(tf('profile_empty_games_title'))}</div><div class="sg-empty-state-sub">${esc(tf('profile_empty_games_sub'))}</div></div>`;
    } else {
      grid.innerHTML = myGames.map(g => {
        if (!g) return '';
        const idRaw = String(g.id || '');
        const gid = esc(idRaw);
        const canEdit = g.status !== 'rejected';
        const genreRaw = (g.genre && String(g.genre).trim()) ? g.genre : genreOtherApi();
        const genreEsc = esc(genreRaw);
        const titleEsc = esc(g.title || '');
        const descEsc = esc(g.description || '');
        const urlEsc = esc(g.url || '');
        const imgEsc = esc(g.imageUrl || '');
        const statEsc = esc(g.status || '');
        const pillsId = 'genrePillsEdit-' + idRaw;
        const editorHtml = canEdit ? `
        <div id="profileGameEditor-${idRaw}" class="profile-game-editor" hidden>
          <p class="profile-game-editor-lead">${esc(tf('profile_editor_lead'))}</p>
          <div class="field-group">
            <div class="field-label">${esc(tf('field_title'))}</div>
            <input class="field-input profile-game-editor-title" type="text" maxlength="40" placeholder="${esc(tf('field_title_placeholder'))}" value="${titleEsc}">
          </div>
          <div class="field-group">
            <div class="field-label">${esc(tf('field_desc'))}</div>
            <textarea class="field-input profile-game-editor-desc" maxlength="120" rows="3" placeholder="${esc(tf('field_desc_short'))}">${descEsc}</textarea>
          </div>
          <div class="field-group">
            <div class="field-label">${esc(tf('field_genre'))}</div>
            <div class="genre-pills" id="${pillsId}"></div>
          </div>
          <div class="field-group">
            <div class="field-label">${esc(tf('cover_optional'))}</div>
            <input class="field-input profile-game-editor-cover-url" type="url" placeholder="${esc(tf('profile_cover_url_hint'))}" value="${imgEsc}">
            <label class="image-upload">
              <input type="file" accept="image/*" class="profile-game-editor-cover-file" data-input="cover-profile" data-game-id="${idRaw}">
              <span>${esc(tf('profile_choose_file'))}</span>
            </label>
            <div class="image-preview profile-game-editor-preview">${g.imageUrl ? `<img src="${imgEsc}" alt="">` : `<span>${esc(tf('no_cover'))}</span>`}</div>
            <button type="button" class="profile-text-btn" data-action="game-editor-clear-cover" data-game-id="${idRaw}">${esc(tf('profile_clear_cover'))}</button>
          </div>
          <p class="field-hint profile-game-editor-url-hint">${esc(tf('profile_game_url_label'))} <code class="profile-game-editor-url">${urlEsc || '—'}</code></p>
          <div class="profile-game-editor-actions">
            <button type="button" class="profile-text-btn" data-action="profile-game-editor-cancel" data-game-id="${idRaw}">${esc(tf('profile_discard'))}</button>
            <button type="button" class="submit-btn" data-action="profile-game-editor-save" data-game-id="${idRaw}">${esc(tf('profile_save_review'))}</button>
          </div>
        </div>` : '';
        return `
        <div class="profile-game-row" id="profileGameRow-${idRaw}" data-profile-game-id="${idRaw}" data-title="${titleEsc}" data-description="${descEsc}" data-genre="${genreEsc}" data-url="${urlEsc}" data-image-url="${imgEsc}" data-status="${statEsc}">
          <div class="game-card sg-store-card" data-action="open-game-detail" data-game-id="${gid}">
            <div class="game-card-thumb sg-store-card-thumb">
              ${gameStatusBadgeHtml(g.status)}
              ${typeof gameThumbHtml === 'function' ? gameThumbHtml(g) : ''}
            </div>
            ${typeof sgStorefrontCardInfoHtml === 'function' ? sgStorefrontCardInfoHtml(g, { author: false, desc: true }) : `<div class="game-card-info"><div class="game-card-name">${esc(g.title)}</div><div class="game-card-stats"><span class="sg-mini-stat">${sgStatHeartSvg()}${fmtNum(g.likes)}</span><span class="sg-mini-sep">·</span><span class="sg-mini-stat">${sgStatEyeSvg()}${fmtNum(g.plays)}</span></div></div>`}
          </div>
          <div class="profile-game-actions profile-game-actions--icons" role="toolbar" aria-label="${esc(tf('profile_game_actions_aria'))}">
            ${canEdit ? `<button type="button" class="profile-game-icon-btn" data-action="toggle-profile-game-editor" data-game-id="${idRaw}" title="${esc(tf('gd_edit'))}" aria-label="${esc(tf('gd_edit'))}"><svg class="sg-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M15 6l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>` : ''}
            <button type="button" class="profile-game-icon-btn" data-action="open-game-in-feed" data-game-id="${gid}" title="${esc(tf('to_feed'))}" aria-label="${esc(tf('profile_open_in_feed_aria'))}"><svg class="sg-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h14" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/></svg></button>
            <button type="button" class="profile-game-icon-btn profile-game-icon-btn--danger" data-action="delete-game" data-game-id="${gid}" data-game-title="${titleEsc}" title="${esc(tf('gd_delete'))}" aria-label="${esc(tf('profile_delete_game_aria'))}"><svg class="sg-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 3h6M4 7h16M6 7l1 14h10l1-14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
          </div>
          ${editorHtml}
        </div>`;
      }).join('');
      myGames.forEach(g => {
        if (g.status === 'rejected') return;
        const sk = 'edit_' + g.id;
        if (typeof renderGenrePills === 'function') {
          window.selectedGenres[sk] = (g.genre && String(g.genre).trim()) ? g.genre : genreOtherApi();
          renderGenrePills('genrePillsEdit-' + g.id, sk);
        }
      });
    }
  } catch (fatal) {
    console.error('[Profile] FATAL renderProfile error', fatal);
  }
}
