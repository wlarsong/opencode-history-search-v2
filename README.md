# opencode-history-search-v2

> ## ⚠️ This is an OpenCode **V2** modification
>
> This package is a **port of
> [joeyism/opencode-history-search](https://github.com/joeyism/opencode-history-search)
> (MIT) to the OpenCode V2 plugin API.**
>
> - The original `opencode-history-search` npm package is built for
>   **OpenCode V1** and **does not load in OpenCode V2** — V2 introduced a
>   new plugin API (plugins must default-export
>   `Plugin.define({ id, setup })`), which is an intentional breaking
>   change. V2 refuses to start V1 plugins with:
>   *"Plugin must export a default definition with an id and an effect or
>   setup function."*
> - This repository is the drop-in V2 equivalent: same search engine, same
>   tool, same history data — rewritten for the V2 plugin API.
> - If you are still on **OpenCode V1**, keep using the original package;
>   nothing here is needed. See [Upgrading from V1](#upgrading-from-v1).

Search through your OpenCode conversation history across **all projects**
or within the **current repository**. Supports keyword, regex, fuzzy, and
global search.

## Features

- **Keyword Search** — Find exact matches in your conversation history
- **Regex Search** — Use regular expressions for advanced pattern matching
- **Fuzzy Search** — Typo-tolerant search that finds matches even with
  spelling errors
- **Multi-Term AND Search** — Find sessions matching multiple concepts at
  once (e.g., `["truck", "vertex", "gemini"]`)
- **Date Filtering** — Filter by `"today"`, `"last 7 days"`, `"2024-01"`,
  date ranges, and more
- **Role Filtering** — Search only your messages (`user`) or only AI
  responses (`assistant`)
- **File Modification Tracking** — Find which sessions created or modified
  specific files
- **Multiple Match Types** — Search across session titles, messages, tool
  invocations, and file paths
- **Global Search** — Search across **all** projects on your machine with
  `searchAllProjects: true`
- **Project-Aware Results** — See which project directory each result came
  from

## Requirements

- **OpenCode V2** (the V2 plugin API). Your conversation history is read
  from the standard OpenCode SQLite database
  (`~/.local/share/opencode/opencode.db`), which V2 writes to.

## Installation

### From npm (once published)

Add to your OpenCode config (`~/.config/opencode/opencode.json`):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "opencode-history-search-v2"
  ]
}
```

Then restart OpenCode.

### From a local clone (before npm publish)

```sh
git clone https://github.com/wlarsong/opencode-history-search-v2
cd opencode-history-search-v2
npm install          # installs @opencode/plugin + fuse.js
```

Then point your config at the local directory (absolute path):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "/absolute/path/to/opencode-history-search-v2"
  ]
}
```

Restart OpenCode and the `history_search` tool is available.

> No build step: OpenCode runs plugin TypeScript directly under Bun, and
> the package `exports` point at `src/index.ts`.

## Upgrading from V1

If you upgrade **OpenCode** from V1 to V2 and were using
`opencode-history-search`, your config entry will stop working (that is the
intentional V2 plugin API breaking change). This package ships a config
upgrade helper:

```sh
bunx opencode-history-search-v2            # after npm publish
# or from a clone:
bun src/upgrade.ts                         # or: node src/upgrade.ts (Node >= 23.6)
bun src/upgrade.ts --global                # also update the global config
```

It will:

1. Detect your OpenCode version (and tell you there is nothing to do if you
   are still on V1).
2. Find project config files (and the global config with `--global`) that
   reference `opencode-history-search`.
3. Replace the entry with `opencode-history-search-v2`, writing a
   `.bak-*` backup of each file first.

Your conversation history is untouched — both versions read the same
OpenCode database.

## What changed versus the V1 package

| Area | V1 (`opencode-history-search`) | V2 (this package) |
| --- | --- | --- |
| Plugin API | V1 plugin function (`server()` returning hooks/tools) | `Plugin.define({ id, setup })`; tool registered via `ctx.tool.transform` |
| Tool name | `history-search` | `history_search` (V2 normalizes dashes to underscores) |
| Project ID | Repo root commit hash (`git rev-list --max-parents=0`) | V2 project ID from `ctx.location.project.id`; the legacy root-commit ID is matched **as well**, so history created under V1 stays searchable |
| Storage readers | `bun` runtime APIs (`Bun.file`, `Glob`) | `node:fs` (works under Bun and Node); SQLite via `bun:sqlite` (dynamic import) |
| Config key | `plugin` | `plugins` (V2 also still normalizes `plugin`) |
| Build step | `bun run build` → `dist/` | None — source is loaded directly |
| Installers | `npx opencode-history-search` file copiers | Not needed — plugins load from config |

The search behavior (keyword / regex / fuzzy / multi-term AND / date /
role / file trace) and output format are unchanged.

## Development

```sh
npm install
npm run typecheck   # tsc --noEmit
npm run smoke       # runs the real search code against your local OpenCode DB (read-only)
```

`npm run smoke` works under Node (>= 23.6, via a `node:sqlite` shim in
`scripts/`) or directly under Bun (`bun scripts/smoke.ts`).

## Storage

OpenCode (V1.2+ and V2) stores history in SQLite:

```
~/.local/share/opencode/opencode.db
```

For very old OpenCode v1.1.x histories (JSON files in
`~/.local/share/opencode/storage/`), the JSON fallback from the original
package is retained.

## License

MIT — based on
[opencode-history-search](https://github.com/joeyism/opencode-history-search)
(MIT) by its contributors. See [LICENSE](./LICENSE).
