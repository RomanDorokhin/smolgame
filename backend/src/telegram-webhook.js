/**
 * Входящий webhook Telegram: ответ на /start в чате с ботом (мини-апп живёт отдельно).
 * Настройка: setWebhook + секрет в заголовке X-Telegram-Bot-Api-Secret-Token.
 */

function miniAppBaseUrl(env) {
  const origin = String(env.FRONTEND_ORIGIN || 'https://romandorokhin.github.io')
    .trim()
    .replace(/\/$/, '');
  let path = String(env.GITHUB_APP_PATH || '/smolgame').trim();
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/$/, '');
  return `${origin}${path}`;
}

function miniAppPublicUrl(env) {
  return `${miniAppBaseUrl(env)}/`;
}

/** GIF на GitHub Pages: `assets/telegram-start-logo.gif` (пересборка: `scripts/generate-telegram-start-gif.sh`). */
function startAnimationGifUrl(env) {
  return `${miniAppBaseUrl(env)}/assets/telegram-start-logo.gif`;
}

async function telegramApi(token, method, body) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.ok) {
    const desc = data?.description || r.statusText || 'telegram api error';
    throw new Error(desc);
  }
  return data;
}

async function sendStartAnimation(env, token, chatId) {
  const gifUrl = startAnimationGifUrl(env);
  try {
    await telegramApi(token, 'sendAnimation', {
      chat_id: chatId,
      animation: gifUrl,
    });
  } catch (e) {
    console.warn('telegram webhook sendAnimation failed (проверь, что GIF залит на Pages)', e?.message || e);
  }
}

async function sendStartMessage(env, token, chatId) {
  const webAppUrl = miniAppPublicUrl(env);
  const text =
    'Привет! Это бот <b>SmolGame</b> — лента мини-игр в Telegram.\n\n' +
    'Нажми зелёную кнопку ниже. Если её не видно — слева внизу нажми <b>«Игры»</b> в панели чата: это то же приложение (в настройках Telegram оно может называться «мини-приложение»).';

  const base = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  await sendStartAnimation(env, token, chatId);

  // `web_app` требует, чтобы домен URL был привязан к боту в @BotFather; иначе Telegram API отдаёт ошибку и ответа в чате не будет.
  try {
    await telegramApi(token, 'sendMessage', {
      ...base,
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть SmolGame', web_app: { url: webAppUrl } }]],
      },
    });
  } catch (e) {
    console.warn('telegram webhook: web_app button failed, falling back to url', e?.message || e);
    await telegramApi(token, 'sendMessage', {
      ...base,
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть SmolGame', url: webAppUrl }]],
      },
    });
  }
}

/**
 * POST /api/telegram/webhook
 * Заголовок X-Telegram-Bot-Api-Secret-Token должен совпадать с TELEGRAM_WEBHOOK_SECRET.
 */
export async function telegramWebhook(req, env) {
  const secret = String(env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    console.warn('telegram webhook: TELEGRAM_WEBHOOK_SECRET not set — ответы на /start отключены');
    return new Response('webhook secret not configured', { status: 503 });
  }

  const hdr = String(req.headers.get('x-telegram-bot-api-secret-token') || '').trim();
  if (hdr !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) {
    console.error('telegram webhook: TELEGRAM_BOT_TOKEN missing');
    return new Response('bot token not configured', { status: 503 });
  }

  let update;
  try {
    update = await req.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const msg = update.message || update.edited_message;
  const text = typeof msg?.text === 'string' ? msg.text.trim() : '';
  const chatId = msg?.chat?.id;

  if (chatId != null && text.toLowerCase().startsWith('/start')) {
    try {
      await sendStartMessage(env, token, chatId);
    } catch (e) {
      console.error('telegram webhook sendMessage', e);
      return new Response('send failed', { status: 500 });
    }
  }

  return new Response('ok', { status: 200 });
}
