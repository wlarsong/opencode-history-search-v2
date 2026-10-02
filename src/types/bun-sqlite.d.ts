/**
 * Minimal type surface for bun:sqlite, used when running under Node or
 * typechecking without bun-types installed. When running under Bun, the
 * real bun:sqlite module is loaded at runtime via dynamic import.
 */
declare module "bun:sqlite" {
  export class Database {
    constructor(path: string, options?: { readonly?: boolean; create?: boolean });
    query(
      sql: string,
    ): {
      all(...params: unknown[]): unknown[];
      get(...params: unknown[]): unknown;
      run(...params: unknown[]): unknown;
    };
    close(): void;
  }
}
