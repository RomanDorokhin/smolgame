/**
 * GET /auth/github/done — лендинг после GitHub OAuth (на Worker), с кликабельной ссылкой в Telegram.
 */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function botUserFromEnv(env) {
  return String(env.TELEGRAM_BOT_USERNAME ?? 'smolgame_bot')
    .replace(/^@/, '')
    .trim() || 'smolgame_bot';
}

function miniAppTgUrl(env) {
  const bot = botUserFromEnv(env);
  const short = String(env.TELEGRAM_MINI_APP_SHORT_NAME || '').trim();
  if (short) {
    return `https://t.me/${bot}/${short}`;
  }
  return `https://t.me/${bot}`;
}

export function githubOAuthDonePage(req, env) {
  const url = new URL(req.url);
  const gh = url.searchParams.get('github') || '';
  const msgRaw = url.searchParams.get('message') || '';

  const ok = gh === 'connected';
  const title = ok ? 'GitHub подключён' : 'Ошибка GitHub';
  const lead = ok
    ? 'Связка с GitHub сохранена. Открой мини-апп в Telegram и зайди в «Загрузить» → «GitHub» — там появится форма.'
    : 'Вход через GitHub не завершился. Ниже — ссылка в приложение; детали в тексте ошибки.';

  const tgUrl = miniAppTgUrl(env);
  const tgDeep = `tg://resolve?domain=${botUserFromEnv(env)}`;

  const errBlock =
    msgRaw && !ok
      ? `<p class="err">${esc(msgRaw)}</p>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} — SmolGame</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#0a0a0c;color:#eee;padding:24px;max-width:28rem;margin:0 auto;line-height:1.5}
    h1{font-size:1.25rem;margin:0 0 12px}
    p{margin:0 0 12px;color:#bbb}
    .err{background:#2a1515;border:1px solid #553333;border-radius:10px;padding:12px;color:#ffb4b4;word-break:break-word}
    a.btn{display:inline-block;margin:12px 0;padding:14px 20px;background:linear-gradient(135deg,#ff2d55,#7b5cff);color:#fff;text-decoration:none;border-radius:12px;font-weight:600}
    a.sub{color:#8ab4ff;font-size:0.95rem}
  </style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <p>${esc(lead)}</p>
  ${errBlock}
  <a class="btn" href="${esc(tgUrl)}">Открыть в Telegram</a>
  <p><a class="sub" href="${esc(tgDeep)}">Открыть через tg://</a> (если браузер не открывает приложение)</p>
  <p style="font-size:13px;color:#666">Потом: SmolGame → Загрузить → GitHub</p>
</body>
</html>`;

  return new Response(html, {
    status: ok ? 200 : 400,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
