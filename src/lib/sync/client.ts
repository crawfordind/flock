import type { BirdRecord, ProcessingSession } from "../types";

export type SyncPayload = {
  sessions: ProcessingSession[];
  birds: BirdRecord[];
};

/** Push pending local changes to /api/sync (no-op success without Turso). */
export async function syncPending(): Promise<{
  ok: boolean;
  synced: boolean;
  message: string;
}> {
  if (typeof window === "undefined") {
    return { ok: true, synced: false, message: "server" };
  }

  try {
    const { getDb } = await import("../db/dexie");
    const db = getDb();
    const [sessions, birds] = await Promise.all([
      db.sessions.where("syncStatus").equals("pending").toArray(),
      db.birds.where("syncStatus").equals("pending").toArray(),
    ]);

    if (sessions.length === 0 && birds.length === 0) {
      return { ok: true, synced: true, message: "nothing pending" };
    }

    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessions, birds } satisfies SyncPayload),
    });

    if (!res.ok) {
      return { ok: false, synced: false, message: `HTTP ${res.status}` };
    }

    const data = (await res.json()) as {
      cloudEnabled: boolean;
      message?: string;
    };

    if (data.cloudEnabled) {
      const now = new Date().toISOString();
      await db.transaction("rw", db.sessions, db.birds, async () => {
        for (const s of sessions) {
          await db.sessions.update(s.id, {
            syncStatus: "synced",
            updatedAt: now,
          });
        }
        for (const b of birds) {
          await db.birds.update(b.id, {
            syncStatus: "synced",
            updatedAt: now,
          });
        }
      });
    }

    return {
      ok: true,
      synced: data.cloudEnabled,
      message: data.message ?? "ok",
    };
  } catch (err) {
    return {
      ok: false,
      synced: false,
      message: err instanceof Error ? err.message : "sync failed",
    };
  }
}

export function startBackgroundSync(intervalMs = 30_000): () => void {
  if (typeof window === "undefined") return () => {};

  const run = () => {
    if (navigator.onLine) void syncPending();
  };

  run();
  const id = window.setInterval(run, intervalMs);
  window.addEventListener("online", run);

  return () => {
    window.clearInterval(id);
    window.removeEventListener("online", run);
  };
}
