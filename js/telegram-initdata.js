/**
 * Telegram иногда отдаёт пустой `Telegram.WebApp.initData`, хотя подпись лежит в URL
 * (#tgWebAppData=... или ?tgWebAppData=...). Без строки initData все запросы к API
 * идут «гостем» / 401 — ломаются лента, поиск (данные из GAMES), профиль.
 */
(function () {
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

  function extractFromSearch() {
    try {
      const q = new URLSearchParams(window.location.search);
      const d = q.get('tgWebAppData');
      return d ? decodeMaybe(d) : '';
    } catch (e) {
      return '';
    }
  }

  function extractFromHash() {
    try {
      const hash = window.location.hash || '';
      if (!hash || hash.length < 12) return '';
      const raw = hash.startsWith('#') ? hash.slice(1) : hash;
      const params = new URLSearchParams(raw);
      const d = params.get('tgWebAppData');
      return d ? decodeMaybe(d) : '';
    } catch (e) {
      return '';
    }
  }

  function applyOverride(initDataStr) {
    const s = String(initDataStr || '').trim();
    if (!looksLikeTelegramInitData(s)) return false;
    window.__smolgameInitDataOverride = s;
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
    return Boolean(window.__smolgameInitDataOverride && looksLikeTelegramInitData(window.__smolgameInitDataOverride));
  }

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
})();
