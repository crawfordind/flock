import Dexie, { type EntityTable } from "dexie";
import type {
  BirdRecord,
  FeedLog,
  Flock,
  Media,
  ProcessingSession,
  User,
} from "../types";
import { nowIso, uuidv7 } from "../uuid";

export class FlockDB extends Dexie {
  users!: EntityTable<User, "id">;
  flocks!: EntityTable<Flock, "id">;
  feedLogs!: EntityTable<FeedLog, "id">;
  sessions!: EntityTable<ProcessingSession, "id">;
  birds!: EntityTable<BirdRecord, "id">;
  media!: EntityTable<Media, "id">;
  meta!: EntityTable<{ key: string; value: string }, "key">;

  constructor() {
    super("flock_db");
    this.version(1).stores({
      users: "id, clientId, updatedAt",
      flocks: "id, userId, clientId, updatedAt, name",
      feedLogs: "id, flockId, clientId, updatedAt",
      sessions:
        "id, userId, flockId, clientId, updatedAt, processedAt, status, syncStatus",
      birds:
        "id, sessionId, clientId, updatedAt, sequence, [sessionId+sequence], syncStatus",
      media: "id, sessionId, birdId, clientId, updatedAt",
      meta: "key",
    });
  }
}

let dbInstance: FlockDB | null = null;

export function getDb(): FlockDB {
  if (typeof window === "undefined") {
    throw new Error("Dexie is only available in the browser");
  }
  if (!dbInstance) dbInstance = new FlockDB();
  return dbInstance;
}

const DEMO_USER_KEY = "demo_user_id";

export async function ensureDemoUser(): Promise<User> {
  const db = getDb();
  const existingId = (await db.meta.get(DEMO_USER_KEY))?.value;
  if (existingId) {
    const user = await db.users.get(existingId);
    if (user) return user;
  }

  const now = nowIso();
  const user: User = {
    id: uuidv7(),
    email: null,
    displayName: "Local Processor",
    createdAt: now,
    updatedAt: now,
    clientId: uuidv7(),
  };
  await db.users.put(user);
  await db.meta.put({ key: DEMO_USER_KEY, value: user.id });
  return user;
}
