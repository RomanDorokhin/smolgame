// Валидация Telegram WebApp initData.
// Описание протокола: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// Суть: клиент присылает `initData` = query-строку. В ней поле `hash` — HMAC-SHA-256
// от остальных полей, ключ = SHA-256("WebAppData" + BOT_TOKEN). Если совпало — данные
// действительно от Telegram и им можно доверять.

async function hmacSha256(key, msg) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, msg));
}

async function sha256(msg) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', msg));
}

function toHex(u8) {
  return [...u8].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Проверяет initData. Возвращает объект юзера Telegram или null.
 * Дополнительно проверяет, что data не старше maxAgeSec секунд.
 */
export async function verifyInitData(initData, botToken, maxAgeSec = 86400) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  // data_check_string: все поля, отсортированные по имени, каждое в формате key=value, через \n.
  const keys = [...params.keys()].sort();
  const dataCheckString = keys.map(k => `${k}=${params.get(k)}`).join('\n');

  const enc = new TextEncoder();
  const secretKey = await hmacSha256(enc.encode('WebAppData'), enc.encode(botToken));
  const computed  = await hmacSha256(secretKey, enc.encode(dataCheckString));

  if (toHex(computed) !== hash) return null;

  // Защита от переиспользования старых initData.
  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || (Math.floor(Date.now() / 1000) - authDate) > maxAgeSec) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;
  try {
    const user = JSON.parse(userRaw);
    if (!user.id) return null;
    return {
      id:         String(user.id),
      username:   user.username || null,
      first_name: user.first_name || null,
      last_name:  user.last_name  || null,
      photo_url:  user.photo_url  || null,
    };
  } catch (e) {
    return null;
  }
}
