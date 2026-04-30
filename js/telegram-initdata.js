/**
 * Telegram иногда отдаёт пустой `Telegram.WebApp.initData`, хотя подпись лежит в URL
 * (#tgWebAppData=... или ?tgWebAppData=...). Без строки initData все запросы к API
 * идут «гостем» / 401 — ломаются лента, поиск (данные из GAMES), профиль.
 */
(function () {
  const INIT_DATA_SS_KEY = 'smolgame:tgInitData:v1';

  function decodeMaybe(s) {
    if (s == null) return '';
    try {
      return decodeURIComponent(String(s).replace(/\+/g, ' '));
    } catch (e) {
      return String(s || '');
    }
  }

  /** Похоже на query-string initData от Telegram (есть hash= и подпись). */
  function looksLikeTelegramInitData(s) {
    const t = String(s || '').trim();
    if (t.length < 30) return false;
    if (!t.includes('hash=')) return false;
    return true;
  }

  function extractTgWebAppDataFromQueryString(qs) {
    const raw = String(qs || '');
    if (!raw.includes('tgWebAppData=')) return '';
    const needle = 'tgWebAppData=';
    let i = raw.indexOf(needle);
    while (i >= 0) {
      const start = i + needle.length;
      let j = start;
      while (j < raw.length && raw[j] !== '&') j++;
      const part = raw.slice(start, j);
      if (part) {
        try {
          const dec = decodeMaybe(part);
          if (looksLikeTelegramInitData(dec)) return dec;
        } catch (e) { /* next */ }
      }
      i = raw.indexOf(needle, j + 1);
    }
    return '';
  }

  function readPersistedInitData() {
    try {
      const s = sessionStorage.getItem(INIT_DATA_SS_KEY);
      return s && looksLikeTelegramInitData(s) ? s : '';
    } catch (e) {
      return '';
    }
  }

  function persistInitDataIfValid(s) {
    const t = String(s || '').trim();
    if (!looksLikeTelegramInitData(t)) return;
    try {
      sessionStorage.setItem(INIT_DATA_SS_KEY, t);
    } catch (e) { /* ignore */ }
  }

  function extractFromSearch() {
    try {
      const qs = window.location.search || '';
      if (qs.startsWith('?')) {
        const d = extractTgWebAppDataFromQueryString(qs.slice(1));
        if (d) return d;
      }
      const q = new URLSearchParams(window.location.search);
      const d2 = q.get('tgWebAppData');
      return d2 ? decodeMaybe(d2) : '';
    } catch (e) {
      return '';
    }
  }

  function extractFromHash() {
    try {
      const hash = window.location.hash || '';
      if (!hash || hash.length < 12) return '';
      const raw = hash.startsWith('#') ? hash.slice(1) : hash;
      const d = extractTgWebAppDataFromQueryString(raw);
      if (d) return d;
      const params = new URLSearchParams(raw);
      const d2 = params.get('tgWebAppData');
      return d2 ? decodeMaybe(d2) : '';
    } catch (e) {
      return '';
    }
  }

  function applyOverride(initDataStr) {
    const s = String(initDataStr || '').trim();
    if (!looksLikeTelegramInitData(s)) return false;
    window.__smolgameInitDataOverride = s;
    persistInitDataIfValid(s);
    try {
      const tw = window.Telegram?.WebApp;
      if (tw && !tw.initData) {
        try {
          tw.initData = s;
        } catch (e) { /* read-only в части клиентов */ }
      }
    } catch (e) { /* ignore */ }
    return true;
  }

  /**
   * Вытащить initData из URL и положить в window.__smolgameInitDataOverride (+ попытка tw.initData).
   * Вызывать как можно раньше (до state.js / api).
   */
  function ensureSmolgameInitDataFromUrl() {
    const fromHash = extractFromHash();
    if (applyOverride(fromHash)) return true;
    const fromSearch = extractFromSearch();
    if (applyOverride(fromSearch)) return true;
    const cached = readPersistedInitData();
    if (cached && applyOverride(cached)) return true;
    return Boolean(window.__smolgameInitDataOverride && looksLikeTelegramInitData(window.__smolgameInitDataOverride));
  }

  /** user= из строки initData (без полной зависимости от URLSearchParams на длинных строках). */
  function extractTelegramUserFromInitDataString(raw) {
    try {
      const s = String(raw || '').trim();
      if (!s) return null;
      try {
        const enc = new URLSearchParams(s).get('user');
        if (enc) {
          const u = JSON.parse(String(enc));
          if (u && u.id != null) return u;
        }
      } catch (e1) { /* ignore */ }
      const key = 'user=';
      let i = s.indexOf(key);
      while (i >= 0) {
        const start = i + key.length;
        let j = start;
        while (j < s.length && s[j] !== '&') j++;
        const part = s.slice(start, j);
        if (part) {
          try {
            const u = JSON.parse(decodeURIComponent(part.replace(/\+/g, ' ')));
            if (u && u.id != null) return u;
          } catch (e2) { /* next */ }
        }
        i = s.indexOf(key, j + 1);
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  /** Сразу после появления window.USER (state.js) и при смене URL — подставить id из initData. */
  function syncUSERFromTelegramInit() {
    try {
      if (!window.USER) return;
      ensureSmolgameInitDataFromUrl();
      let u = null;
      try {
        u = window.Telegram?.WebApp?.initDataUnsafe?.user;
      } catch (e) { /* ignore */ }
      if (u && u.id != null) {
        console.log('[TG-Init] Using initDataUnsafe.user', u);
        window.USER.id = String(u.id);
        window.USER.tgId = String(u.id);
        const nm = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
        if (nm) window.USER.name = nm;
        const ph = u.photo_url && String(u.photo_url).trim();
        if (ph) window.USER.avatar = ph;
        else if (u.first_name) {
          const ch = String(u.first_name).trim()[0];
          if (ch) window.USER.avatar = ch;
        }
        return;
      }
      const raw =
        (window.__smolgameInitDataOverride && String(window.__smolgameInitDataOverride).trim()) ||
        (function () {
          try {
            return String(window.Telegram?.WebApp?.initData || '').trim();
          } catch (e2) {
            return '';
          }
        })();
      console.log('[TG-Init] Raw initData length:', raw.length);
      u = extractTelegramUserFromInitDataString(raw);
      if (!u || u.id == null) {
        console.warn('[TG-Init] Failed to extract user from raw initData');
        return;
      }
      console.log('[TG-Init] Extracted user from raw initData', u);
      window.USER.id = String(u.id);
      window.USER.tgId = String(u.id);
      const nm = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
      if (nm) window.USER.name = nm;
      const ph = u.photo_url && String(u.photo_url).trim();
      if (ph) window.USER.avatar = ph;
      else if (u.first_name) {
        const ch = String(u.first_name).trim()[0];
        if (ch) window.USER.avatar = ch;
      }
    } catch (e) {
      console.error('[TG-Init] Error in syncUSERFromTelegramInit', e);
    }
  }

  window.syncUSERFromTelegramInit = syncUSERFromTelegramInit;
  /**
   * Подождать, пока Telegram заполнит initData или пока не выйдет timeout.
   */
  function waitForTelegramInitData(opts) {
    const timeoutMs = (opts && Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 5000);
    const stepMs = (opts && Number(opts.stepMs) > 0 ? Number(opts.stepMs) : 80);
    const deadline = Date.now() + timeoutMs;
    return new Promise(resolve => {
      function tick() {
        ensureSmolgameInitDataFromUrl();
        let raw = '';
        try {
          raw = String(window.__smolgameInitDataOverride || window.Telegram?.WebApp?.initData || '').trim();
        } catch (e) {
          raw = '';
        }
        if (looksLikeTelegramInitData(raw)) {
          persistInitDataIfValid(raw);
          resolve(true);
          return;
        }
        if (Date.now() >= deadline) {
          resolve(false);
          return;
        }
        setTimeout(tick, stepMs);
      }
      tick();
    });
  }

  window.ensureSmolgameInitDataFromUrl = ensureSmolgameInitDataFromUrl;
  window.waitForTelegramInitData = waitForTelegramInitData;
  ensureSmolgameInitDataFromUrl();

  window.addEventListener('hashchange', function () {
    ensureSmolgameInitDataFromUrl();
    syncUSERFromTelegramInit();
  });
  window.addEventListener('popstate', function () {
    ensureSmolgameInitDataFromUrl();
    syncUSERFromTelegramInit();
  });
})();
