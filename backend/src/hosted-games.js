import { json, error } from './http.js';

const GONE_MSG =
  'Хостинг HTML на сервере SmolGame отключён: код игры публикуй через вкладку «GitHub» (репозиторий и GitHub Pages) или вставь готовую ссылку.';

/** GET /g/:id/ — legacy; игры больше не хостим на Worker. */
export async function serveHostedGame() {
  return new Response('Not found', { status: 404 });
}

/** POST /api/submit-html-game — отключено (HTML не храним на Worker). */
export async function submitHtmlGame() {
  return error(GONE_MSG, 410);
}
