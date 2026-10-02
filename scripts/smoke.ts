/**
 * Smoke test: runs the real search code against the local OpenCode SQLite
 * database (read-only) so it can be verified without restarting OpenCode.
 *
 * Usage:
 *   npm run smoke        # Node >= 23.6 (uses the node:sqlite shim)
 *   bun scripts/smoke.ts # under Bun (uses the real bun:sqlite)
 */
import { getDbPath, dbExists } from "../src/storage-sqlite.ts";
import { resolveProjectIDs } from "../src/project.ts";
import { searchKeyword } from "../src/search/keyword.ts";
import { searchFuzzy } from "../src/search/fuzzy.ts";
import { searchMultiterm } from "../src/search/multiterm-sql.ts";
import { traceFile } from "../src/search/file-trace.ts";
import { formatResults, formatMultitermResults, formatTraceResults } from "../src/format.ts";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

if (!dbExists()) {
  console.error(`No OpenCode database found at ${getDbPath()}; nothing to smoke test.`);
  process.exit(1);
}

// All projects (null) so the test does not depend on the current directory.
const projectIDs = null;

section("keyword search (single term)");
const kw = await searchKeyword(projectIDs, "plugin", { limit: 5 });
console.log(`${kw.length} matches`);
console.log(formatResults(kw.slice(0, 2)));

section("keyword search (regex)");
const re = await searchKeyword(projectIDs, "^src/", { regex: true, limit: 3 });
console.log(`${re.length} matches`);

section("fuzzy search");
const fz = await searchFuzzy(projectIDs, "histroy", { limit: 5 });
console.log(`${fz.length} matches`);
console.log(formatResults(fz.slice(0, 1)));

section("multi-term AND search");
const mt = await searchMultiterm(projectIDs, ["opencode", "plugin"], { limit: 3 });
console.log(`${mt.length} sessions`);
console.log(formatMultitermResults(mt.slice(0, 1)));

section("file trace");
const tr = await traceFile(projectIDs, "index.ts", { limit: 3 });
console.log(`${tr.length} touches`);
console.log(formatTraceResults(tr.slice(0, 1)));

section("project ID resolution (current dir)");
const resolved = await resolveProjectIDs(undefined);
console.log(resolved);

console.log("\nsmoke test complete");
