/** D1/SQLite: missing column (wording differs between drivers). */
export function isMissingColumnError(e) {
  const m = String(e?.message || e || '');
  return /no such column/i.test(m) || /has no column named/i.test(m);
}
