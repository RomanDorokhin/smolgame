/** Собрать текст ошибки вместе с cause (Wrangler/D1 часто кладут текст во вложенный cause). */
function errorTextChain(e) {
  const parts = [];
  let cur = e;
  for (let i = 0; i < 6 && cur != null; i++) {
    if (typeof cur === 'string') parts.push(cur);
    else if (typeof cur === 'object' && cur.message != null) parts.push(String(cur.message));
    else parts.push(String(cur));
    cur = typeof cur === 'object' && cur != null ? cur.cause : null;
  }
  return parts.join(' ');
}

/** D1/SQLite: missing column (wording differs между драйверами и обёртками). */
export function isMissingColumnError(e) {
  const m = errorTextChain(e);
  return /no such column/i.test(m) || /has no column named/i.test(m);
}

/** Таблица ещё не создана (миграция не прогнана). */
export function isMissingTableError(e) {
  const m = errorTextChain(e);
  return /no such table/i.test(m);
}
