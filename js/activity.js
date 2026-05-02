/**
 * Activity & Notifications System
 */
(function() {
  window.refreshActivity = async function() {
    if (!window.USER?.id) return;
    try {
      const data = await API.getActivity();
      const list = document.getElementById('activityList');
      if (!list) return;

      const activities = data.activities || [];
      if (activities.length === 0) {
        list.innerHTML = `<div class="activity-empty-placeholder" data-i18n="activity_empty">${uilang()('activity_empty')}</div>`;
        updateActivityBadges(0);
        return;
      }

      const unreadCount = activities.filter(a => !a.is_read).length;
      updateActivityBadges(unreadCount);

      list.innerHTML = activities.map(a => renderActivityItem(a)).join('');
    } catch (e) {
      console.warn('refreshActivity failed', e);
    }
  };

  function renderActivityItem(a) {
    const t = uilang();
    const actorName = a.actorFirst ? `${a.actorFirst} ${a.actorLast || ''}`.trim() : (a.actorHandle || 'Someone');
    const time = typeof formatTimeAgo === 'function' ? formatTimeAgo(a.created_at) : a.created_at;
    
    let text = '';
    if (a.type === 'like') text = t('act_like', { game: a.gameTitle || '???' });
    else if (a.type === 'review') text = t('act_review', { game: a.gameTitle || '???' });
    else if (a.type === 'reply') text = t('act_reply', { game: a.gameTitle || '???' });
    else if (a.type === 'follow') text = t('act_follow');
    else if (a.type === 'repost') text = t('act_repost', { game: a.gameTitle || '???' });

    const avatarHtml = a.actorPhoto 
      ? `<img src="${a.actorPhoto}" class="activity-avatar" alt="">`
      : `<div class="activity-avatar" style="background: ${getHashColor(actorName)}">${(actorName || '?')[0].toUpperCase()}</div>`;

    return `
      <div class="activity-item ${a.is_read ? '' : 'unread'}" data-action="open-activity" data-id="${a.id}" data-game-id="${a.game_id || ''}" data-actor-id="${a.actor_id}">
        ${avatarHtml}
        <div class="activity-content">
          <span class="activity-user">${actorName}</span> ${text}
          <div class="activity-time">${time}</div>
        </div>
      </div>
    `;
  }

  function updateActivityBadges(count) {
    const profileBadge = document.getElementById('profileTabBadge');
    const activityBadge = document.getElementById('activityTabBadge');
    
    if (profileBadge) {
      profileBadge.style.display = count > 0 ? 'block' : 'none';
      profileBadge.textContent = count > 99 ? '99+' : count;
    }
    if (activityBadge) {
      activityBadge.style.display = count > 0 ? 'block' : 'none';
      activityBadge.textContent = count > 99 ? '99+' : count;
    }
  }

  function getHashColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
  }

  // Poll for notifications
  setInterval(() => {
    if (window.USER?.id && document.body.classList.contains('is-tab-profile')) {
      refreshActivity();
    }
  }, 60000);

  // Mark as read when entering activity tab
  window.markNotificationsRead = async function() {
    try {
      await API.markActivityRead();
      updateActivityBadges(0);
      // Wait a bit then refresh to show read state
      setTimeout(refreshActivity, 500);
    } catch (e) {}
  };

})();
