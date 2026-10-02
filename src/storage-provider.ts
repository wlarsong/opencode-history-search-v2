import {
  dbExists,
  listSessionsSqlite,
  listMessagesSqlite,
  listPartsSqlite,
} from "./storage-sqlite.ts";
import {
  listSessionsJSON,
  listMessagesJSON,
  listPartsJSON,
  getStorageDir,
} from "./storage.ts";
import type { Session, Message, Part } from "./storage.ts";

const useSqlite = dbExists();

export async function* listSessions(
  projectIDs: string[] | null,
): AsyncGenerator<Session> {
  if (useSqlite) {
    yield* listSessionsSqlite(projectIDs);
  } else {
    yield* listSessionsJSON(projectIDs);
  }
}

export async function* listMessages(
  sessionID: string,
  role?: "user" | "assistant",
): AsyncGenerator<Message> {
  if (useSqlite) {
    yield* listMessagesSqlite(sessionID, role);
  } else {
    yield* listMessagesJSON(sessionID, role);
  }
}

export async function* listParts(messageID: string): AsyncGenerator<Part> {
  if (useSqlite) {
    yield* listPartsSqlite(messageID);
  } else {
    yield* listPartsJSON(messageID);
  }
}

export { getStorageDir };
export type { Session, Message, Part };
