import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * The V1 convention for a project's ID was the repo's root commit hash.
 * OpenCode V2 uses its own stable project IDs (see the `project` table),
 * which do not match the root commit. We return the V1 root-commit ID so
 * histories created under OpenCode V1 remain searchable when scoped to
 * the current project.
 */
export async function getGitRootCommit(cwd?: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-list", "--max-parents=0", "--all"],
      { cwd, timeout: 10_000 },
    );
    const commits = stdout.split("\n").filter(Boolean).sort();
    return commits[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve the set of project IDs that belong to the current location.
 *
 * - `preferred` is the V2 project ID from the plugin location
 *   (`ctx.location.project.id`), when available.
 * - The legacy V1 root-commit ID is added when cwd is inside a git repo.
 * - Falls back to "global" when nothing else matches (V1 behavior for
 *   non-repo directories).
 */
export async function resolveProjectIDs(
  preferred?: string | null,
  cwd?: string,
): Promise<string[]> {
  const ids = new Set<string>();
  if (preferred) ids.add(preferred);
  const rootCommit = await getGitRootCommit(cwd);
  if (rootCommit) ids.add(rootCommit);
  if (ids.size === 0) ids.add("global");
  return [...ids];
}
