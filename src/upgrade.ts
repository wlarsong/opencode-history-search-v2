#!/usr/bin/env bun
/**
 * Config upgrade helper for moving from opencode-history-search (V1) to
 * opencode-history-search-v2 (OpenCode V2).
 *
 * Usage:
 *   bun src/upgrade.ts            # or: node src/upgrade.ts (Node >= 23.6)
 *   bun src/upgrade.ts --global   # also update the global config
 *
 * What it does:
 *   1. Detects your OpenCode version (V1 vs V2).
 *   2. Finds project config files (cwd and every ancestor) that reference
 *      the V1 package; with --global, the global config as well.
 *   3. Replaces "opencode-history-search" with "opencode-history-search-v2"
 *      (backing up each file first).
 *
 * What it does NOT do:
 *   - Your conversation history is untouched — both versions read the same
 *     OpenCode SQLite database.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const V1_NAME = "opencode-history-search";
const V2_NAME = "opencode-history-search-v2";

async function detectOpencodeVersion(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("opencode", ["--version"], {
      timeout: 10_000,
    });
    const match = stdout.trim().match(/v?(\d+)\.(\d+)\.(\d+)/);
    if (match) return `${match[1]}.${match[2]}.${match[3]}`;
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Strip // and block comments from JSONC, leaving string contents intact.
 */
function stripJsonc(text: string): string {
  let out = "";
  let i = 0;
  let inString = false;
  let escape = false;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  // Remove trailing commas before } or ] (common in JSONC, invalid in JSON).
  return out.replace(/,(\s*[}\]])/g, "$1");
}

function parseConfigFile(file: string): any | null {
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(stripJsonc(raw));
  } catch {
    return null;
  }
}

function globalConfigFiles(): string[] {
  const xdgConfig =
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  const dir = path.join(xdgConfig, "opencode");
  return ["opencode.json", "opencode.jsonc"]
    .map((name) => path.join(dir, name))
    .filter((file) => fs.existsSync(file));
}

function projectConfigFiles(cwd: string): string[] {
  const files: string[] = [];
  let dir = cwd;
  // Walk up to the filesystem root, collecting candidate config paths.
  for (;;) {
    for (const candidate of [
      path.join(dir, "opencode.json"),
      path.join(dir, "opencode.jsonc"),
      path.join(dir, ".opencode", "opencode.json"),
      path.join(dir, ".opencode", "opencode.jsonc"),
    ]) {
      if (fs.existsSync(candidate)) files.push(candidate);
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return files;
}

function isV1Reference(entry: any): boolean {
  const name =
    typeof entry === "string"
      ? entry
      : Array.isArray(entry)
        ? entry[0]
        : typeof entry === "object" && entry !== null
          ? entry.package
          : undefined;
  if (typeof name !== "string") return false;
  const bare = name.split("@").slice(0, 2).join("@"); // strip version suffix
  return (
    bare === V1_NAME || name.startsWith(`${V1_NAME}@`)
  );
}

function isV2Reference(entry: any): boolean {
  const name =
    typeof entry === "string"
      ? entry
      : Array.isArray(entry)
        ? entry[0]
        : typeof entry === "object" && entry !== null
          ? entry.package
          : undefined;
  if (typeof name !== "string") return false;
  const bare = name.split("@").slice(0, 2).join("@");
  return bare === V2_NAME;
}

function replaceV1Entry(entry: any): any {
  if (typeof entry === "string") return V2_NAME;
  if (Array.isArray(entry)) {
    const copy = [...entry];
    copy[0] = V2_NAME;
    return copy;
  }
  if (typeof entry === "object" && entry !== null) {
    return { ...entry, package: V2_NAME };
  }
  return entry;
}

type FileOutcome = "changed" | "already-v2" | "clean" | "parse-error";

function migrateFile(file: string, options?: { dryRun?: boolean }): FileOutcome {
  const config = parseConfigFile(file);
  if (config === null || typeof config !== "object") {
    return "parse-error";
  }

  let changed = false;
  let hasV2 = false;

  for (const key of ["plugin", "plugins"]) {
    const list = config[key];
    if (!Array.isArray(list)) continue;
    for (let i = 0; i < list.length; i++) {
      if (isV1Reference(list[i])) {
        list[i] = replaceV1Entry(list[i]);
        changed = true;
      }
      if (isV2Reference(list[i])) hasV2 = true;
    }
  }

  if (!changed) {
    return hasV2 ? "already-v2" : "clean";
  }

  if (options?.dryRun) return "changed";

  const backup = `${file}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  fs.copyFileSync(file, backup);
  fs.writeFileSync(
    file,
    JSON.stringify(config, null, 2) + "\n",
    "utf8",
  );
  return "changed";
}

async function main(): Promise<void> {
  const includeGlobal = process.argv.slice(2).includes("--global");
  console.log("opencode-history-search-v2 upgrade helper");
  console.log("------------------------------------------\n");

  const version = await detectOpencodeVersion();
  if (version === null) {
    console.log("note: could not find an `opencode` binary on PATH.");
  } else {
    const major = Number(version.split(".")[0]);
    console.log(`detected OpenCode ${version}`);
    if (major < 2) {
      console.log(`
You are still on OpenCode V1.
This package only runs on OpenCode V2 (the V2 plugin API is a breaking
change; V1 plugins do not load in V2 and vice versa).

Nothing to do right now: keep using "opencode-history-search" on V1.
After you upgrade OpenCode to V2, re-run this script and it will swap
your config entry for you.
`);
      return;
    }
  }

  const files = [
    ...(includeGlobal ? globalConfigFiles() : []),
    ...projectConfigFiles(process.cwd()),
  ];
  if (files.length === 0) {
    console.log("No OpenCode config files found.");
  }

  const outcomes = new Map<string, FileOutcome>();
  for (const file of files) {
    const outcome = migrateFile(file);
    outcomes.set(file, outcome);
    if (outcome === "changed") console.log(`updated:  ${file}`);
    else if (outcome === "already-v2") console.log(`already:  ${file} (V2 package present)`);
    else if (outcome === "parse-error") console.log(`skipped:  ${file} (could not parse as JSON/JSONC)`);
  }

  // Notice (without modifying) V1 references in the global config when the
  // user did not ask for it.
  if (!includeGlobal) {
    for (const file of globalConfigFiles()) {
      const outcome = migrateFile(file, { dryRun: true });
      if (outcome === "changed") {
        console.log(`\nnote: ${file} also references the V1 package.`);
        console.log("Re-run with --global to update it too.");
      }
    }
  }

  const changed = files.filter((f) => outcomes.get(f) === "changed");
  if (changed.length > 0) {
    console.log(`
Done. Backups were written next to each updated file (.bak-*).
Note: if a config file contained comments, the rewritten file is plain
JSON (see its .bak-* backup for the original).

Restart OpenCode to load the V2 plugin:
  opencode service restart
`);
    return;
  }

  const already = files.some((f) => outcomes.get(f) === "already-v2");
  if (already) {
    console.log(`
Your config already references the V2 package. Nothing to do — just
restart OpenCode if you haven't since the change.
`);
    return;
  }

  console.log(`
No references to "${V1_NAME}" found in your config files.
If you want the V2 plugin, add it to opencode.json(c):

  {
    "plugins": [
      "${V2_NAME}"
    ]
  }
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
