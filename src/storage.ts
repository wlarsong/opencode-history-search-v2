import fs from "fs";
import path from "path";
import os from "os";

export interface Session {
  id: string;
  projectID: string;
  title: string;
  directory: string;
  time: { created: number; updated: number };
}

export interface Message {
  id: string;
  sessionID: string;
  role: "user" | "assistant";
  agent: string;
  time: { created: number };
}

export interface Part {
  id: string;
  messageID: string;
  sessionID: string;
  type: "text" | "tool" | "file" | "patch";
  text?: string;
  tool?: string;
  state?: {
    input?: any;
    output?: string;
    title?: string;
  };
  files?: string[]; // For patch parts — list of modified file paths
}

export async function getStorageDir(): Promise<string> {
  const xdgData =
    process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  return path.join(xdgData, "opencode", "storage");
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

async function* scanJsonDir<T>(dir: string): AsyncGenerator<T> {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    try {
      const content = JSON.parse(
        fs.readFileSync(path.join(dir, entry), "utf8"),
      );
      yield content as T;
    } catch {
      continue;
    }
  }
}

/**
 * Legacy OpenCode v1.1.x JSON storage fallback.
 * Modern OpenCode (V1.2+ and V2) uses SQLite, so this only matters for
 * very old histories.
 */
export async function* listSessionsJSON(
  projectIDs: string[] | null,
): AsyncGenerator<Session> {
  const storageDir = await getStorageDir();
  const sessionDir = path.join(storageDir, "session");

  let dirs: string[];
  if (projectIDs !== null) {
    dirs = projectIDs;
  } else {
    try {
      dirs = fs
        .readdirSync(sessionDir)
        .filter((entry) => isDirectory(path.join(sessionDir, entry)));
    } catch {
      return;
    }
  }

  for (const dir of dirs) {
    yield* scanJsonDir<Session>(path.join(sessionDir, dir));
  }
}

export async function* listMessagesJSON(
  sessionID: string,
  role?: "user" | "assistant",
): AsyncGenerator<Message> {
  const storageDir = await getStorageDir();
  const messageDir = path.join(storageDir, "message", sessionID.trim());

  for await (const content of scanJsonDir<Message>(messageDir)) {
    if (role && (content as Message).role !== role) continue;
    yield content as Message;
  }
}

export async function* listPartsJSON(
  messageID: string,
): AsyncGenerator<Part> {
  const storageDir = await getStorageDir();
  const partDir = path.join(storageDir, "part", messageID.trim());

  yield* scanJsonDir<Part>(partDir);
}
