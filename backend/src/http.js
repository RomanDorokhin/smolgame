// Мелкие хелперы для HTTP-ответов и CORS.

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}

/**
 * Навешивает CORS-заголовки на ответ. Разрешаем только наш origin.
 */
export function withCors(resp, origin) {
  const h = new Headers(resp.headers);
  const allowOrigin = origin === '*' || !origin ? '*' : origin;
  h.set('access-control-allow-origin', allowOrigin);
  // С `*` браузер не принимает credentials: true — у нас нет cookie, только заголовок initData.
  if (allowOrigin === '*') {
    h.delete('access-control-allow-credentials');
  } else {
    h.set('access-control-allow-credentials', 'true');
  }
  h.set('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS,PATCH');
  h.set('access-control-allow-headers', 'content-type, x-telegram-init-data, x-web-id');
  h.set('vary', 'origin');
  return new Response(resp.body, { status: resp.status, headers: h });
}

export function preflight(origin) {
  return withCors(new Response(null, { status: 204 }), origin);
}

/**
 * Простейший id-генератор (URL-safe, 12 символов). Криптостойкий.
 */
export function newId() {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
