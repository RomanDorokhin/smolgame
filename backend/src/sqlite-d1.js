import Database from 'better-sqlite3';

/**
 * Mock-обертка для D1 (Cloudflare), чтобы запускать Worker-код на Node.js.
 * Реализует основные методы: prepare, bind, all, run, first.
 */
export class D1DatabaseMock {
  constructor(dbPath) {
    this.db = new Database(dbPath);
  }

  prepare(sql) {
    const stmt = this.db.prepare(sql);
    return new D1PreparedStatementMock(stmt);
  }

  // Другие методы D1 можно добавить по мере необходимости (batch, exec и т.д.)
  async exec(sql) {
    return this.db.exec(sql);
  }
}

class D1PreparedStatementMock {
  constructor(stmt, params = []) {
    this.stmt = stmt;
    this.params = params;
  }

  bind(...args) {
    // В D1 .bind() заменяет старые параметры новыми
    this.params = args;
    return this;
  }

  async all(...args) {
    const finalParams = args.length > 0 ? args : this.params;
    const results = this.stmt.all(...finalParams);
    return { results, success: true };
  }

  async run(...args) {
    const finalParams = args.length > 0 ? args : this.params;
    const info = this.stmt.run(...finalParams);
    return { success: true, meta: info };
  }

  async first(column) {
    const row = this.stmt.get(...this.params);
    if (!row) return null;
    return column ? row[column] : row;
  }
}
