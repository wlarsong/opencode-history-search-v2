import { DatabaseSync } from "node:sqlite";

/**
 * Minimal bun:sqlite-compatible adapter on top of node:sqlite, used only
 * by the Node-based smoke test (scripts/smoke.ts). OpenCode itself runs
 * plugins under Bun, where the real bun:sqlite module is used.
 *
 * Keep this file plain JS — it is loaded as .mjs, where Node does not
 * strip TypeScript syntax.
 */
export class Database {
  constructor(path, _options) {
    this.db = new DatabaseSync(path, { readOnly: true });
  }

  query(sql) {
    const stmt = this.db.prepare(sql);
    return {
      all: (...params) => stmt.all(...params),
      get: (...params) => stmt.get(...params),
      run: (...params) => stmt.run(...params),
    };
  }

  close() {
    this.db.close();
  }
}
