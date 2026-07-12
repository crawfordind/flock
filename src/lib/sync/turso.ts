import type { Client } from "@libsql/client";
import type { BirdRecord, ProcessingSession } from "../types";

let client: Client | null | undefined;

export function isTursoConfigured(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL);
}

export async function getTursoClient(): Promise<Client | null> {
  if (client !== undefined) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    client = null;
    return null;
  }

  const { createClient } = await import("@libsql/client");
  client = createClient({ url, authToken });
  return client;
}

export async function ensureCloudSchema(db: Client): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      display_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      client_id TEXT NOT NULL UNIQUE
    )`,
    `CREATE TABLE IF NOT EXISTS flocks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      breed TEXT,
      hatch_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      client_id TEXT NOT NULL UNIQUE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_flocks_user ON flocks(user_id)`,
    `CREATE TABLE IF NOT EXISTS feed_logs (
      id TEXT PRIMARY KEY,
      flock_id TEXT NOT NULL,
      lbs REAL NOT NULL,
      cost REAL NOT NULL,
      logged_at TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      client_id TEXT NOT NULL UNIQUE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_feed_flock ON feed_logs(flock_id)`,
    `CREATE TABLE IF NOT EXISTS processing_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      flock_id TEXT NOT NULL,
      flock_name TEXT NOT NULL,
      processed_at TEXT NOT NULL,
      birds_started INTEGER NOT NULL,
      chick_cost REAL NOT NULL,
      feed_lbs REAL NOT NULL,
      feed_cost REAL NOT NULL,
      supplies_cost REAL NOT NULL,
      target_price_per_lb REAL NOT NULL,
      avg_live_weight REAL,
      notes TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      client_id TEXT NOT NULL UNIQUE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_user ON processing_sessions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_flock ON processing_sessions(flock_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_updated ON processing_sessions(updated_at)`,
    `CREATE TABLE IF NOT EXISTS bird_records (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      dressed_weight_lb REAL NOT NULL,
      live_weight_lb REAL,
      condemned INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      captured_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      client_id TEXT NOT NULL UNIQUE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_birds_session ON bird_records(session_id)`,
    `CREATE INDEX IF NOT EXISTS idx_birds_updated ON bird_records(updated_at)`,
    `CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      bird_id TEXT,
      kind TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      client_id TEXT NOT NULL UNIQUE
    )`,
  ];

  for (const sql of statements) {
    await db.execute(sql);
  }
}

/** LWW upsert by id using updated_at */
export async function upsertSession(
  db: Client,
  s: ProcessingSession
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO processing_sessions (
      id, user_id, flock_id, flock_name, processed_at, birds_started,
      chick_cost, feed_lbs, feed_cost, supplies_cost, target_price_per_lb,
      avg_live_weight, notes, status, created_at, updated_at, client_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      flock_name=excluded.flock_name,
      processed_at=excluded.processed_at,
      birds_started=excluded.birds_started,
      chick_cost=excluded.chick_cost,
      feed_lbs=excluded.feed_lbs,
      feed_cost=excluded.feed_cost,
      supplies_cost=excluded.supplies_cost,
      target_price_per_lb=excluded.target_price_per_lb,
      avg_live_weight=excluded.avg_live_weight,
      notes=excluded.notes,
      status=excluded.status,
      updated_at=excluded.updated_at
    WHERE excluded.updated_at >= processing_sessions.updated_at`,
    args: [
      s.id,
      s.userId,
      s.flockId,
      s.flockName,
      s.processedAt,
      s.birdsStarted,
      s.chickCost,
      s.feedLbs,
      s.feedCost,
      s.suppliesCost,
      s.targetPricePerLb,
      s.avgLiveWeight,
      s.notes,
      s.status,
      s.createdAt,
      s.updatedAt,
      s.clientId,
    ],
  });
}

export async function upsertBird(db: Client, b: BirdRecord): Promise<void> {
  await db.execute({
    sql: `INSERT INTO bird_records (
      id, session_id, sequence, dressed_weight_lb, live_weight_lb, condemned,
      notes, captured_at, created_at, updated_at, client_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      sequence=excluded.sequence,
      dressed_weight_lb=excluded.dressed_weight_lb,
      live_weight_lb=excluded.live_weight_lb,
      condemned=excluded.condemned,
      notes=excluded.notes,
      captured_at=excluded.captured_at,
      updated_at=excluded.updated_at
    WHERE excluded.updated_at >= bird_records.updated_at`,
    args: [
      b.id,
      b.sessionId,
      b.sequence,
      b.dressedWeightLb,
      b.liveWeightLb,
      b.condemned ? 1 : 0,
      b.notes,
      b.capturedAt,
      b.createdAt,
      b.updatedAt,
      b.clientId,
    ],
  });
}
