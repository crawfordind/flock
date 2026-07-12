import { calculateMetrics } from "../metrics/calculate";
import type {
  BirdRecord,
  Flock,
  MetricsResult,
  ProcessingSession,
  SessionInput,
  SessionUpdate,
} from "../types";
import { nowIso, uuidv7 } from "../uuid";
import { ensureDemoUser, getDb } from "./dexie";

export async function listSessions(): Promise<
  (ProcessingSession & { metrics: MetricsResult })[]
> {
  const db = getDb();
  const sessions = await db.sessions.orderBy("processedAt").reverse().toArray();
  const results = await Promise.all(
    sessions.map(async (session) => {
      const birds = await db.birds.where("sessionId").equals(session.id).toArray();
      return { ...session, metrics: calculateMetrics(session, birds) };
    })
  );
  return results;
}

export async function listFlocks(): Promise<Flock[]> {
  const db = getDb();
  const flocks = await db.flocks.orderBy("updatedAt").reverse().toArray();
  return flocks;
}

export async function getSession(
  sessionId: string
): Promise<{
  session: ProcessingSession;
  flock: Flock | undefined;
  birds: BirdRecord[];
  metrics: MetricsResult;
} | null> {
  const db = getDb();
  const session = await db.sessions.get(sessionId);
  if (!session) return null;
  const [flock, birds] = await Promise.all([
    db.flocks.get(session.flockId),
    db.birds.where("sessionId").equals(sessionId).sortBy("sequence"),
  ]);
  return {
    session,
    flock,
    birds,
    metrics: calculateMetrics(session, birds),
  };
}

export async function createSession(
  input: SessionInput
): Promise<ProcessingSession> {
  const db = getDb();
  const user = await ensureDemoUser();
  const now = nowIso();

  let flock: Flock;
  if (input.flockId) {
    const existing = await db.flocks.get(input.flockId);
    if (!existing) {
      throw new Error("Selected flock not found");
    }
    const name = input.flockName.trim() || existing.name;
    const breed =
      input.breed !== undefined
        ? input.breed.trim() || null
        : existing.breed;
    flock = {
      ...existing,
      name,
      breed,
      updatedAt: now,
    };
  } else {
    flock = {
      id: uuidv7(),
      userId: user.id,
      name: input.flockName.trim(),
      breed: input.breed?.trim() || null,
      hatchDate: null,
      notes: null,
      createdAt: now,
      updatedAt: now,
      clientId: uuidv7(),
    };
  }

  const session: ProcessingSession = {
    id: uuidv7(),
    userId: user.id,
    flockId: flock.id,
    flockName: flock.name,
    processedAt: now,
    birdsStarted: input.birdsStarted,
    chickCost: input.chickCost,
    feedLbs: input.feedLbs,
    feedCost: input.feedCost,
    suppliesCost: input.suppliesCost,
    targetPricePerLb: input.targetPricePerLb,
    avgLiveWeight: input.avgLiveWeight ?? null,
    notes: input.notes ?? null,
    status: "capturing",
    createdAt: now,
    updatedAt: now,
    clientId: uuidv7(),
    syncStatus: "pending",
  };

  await db.transaction("rw", db.flocks, db.sessions, async () => {
    await db.flocks.put(flock);
    await db.sessions.put(session);
  });

  queueMicrotask(() => {
    void import("../sync/client").then((m) => m.syncPending()).catch(() => {});
  });

  return session;
}

export async function updateFlock(
  flockId: string,
  patch: { name?: string; breed?: string | null; notes?: string | null }
): Promise<Flock> {
  const db = getDb();
  const existing = await db.flocks.get(flockId);
  if (!existing) throw new Error("Flock not found");

  const now = nowIso();
  const next: Flock = {
    ...existing,
    name:
      patch.name !== undefined ? patch.name.trim() || existing.name : existing.name,
    breed: patch.breed !== undefined ? patch.breed : existing.breed,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    updatedAt: now,
  };

  await db.transaction("rw", db.flocks, db.sessions, async () => {
    await db.flocks.put(next);
    if (patch.name !== undefined && next.name !== existing.name) {
      const linked = await db.sessions.where("flockId").equals(flockId).toArray();
      await Promise.all(
        linked.map((s) =>
          db.sessions.update(s.id, {
            flockName: next.name,
            updatedAt: now,
            syncStatus: "pending",
          })
        )
      );
    }
  });

  queueMicrotask(() => {
    void import("../sync/client").then((m) => m.syncPending()).catch(() => {});
  });

  return next;
}

export async function updateSession(
  sessionId: string,
  patch: SessionUpdate
): Promise<ProcessingSession> {
  const db = getDb();
  const existing = await db.sessions.get(sessionId);
  if (!existing) throw new Error("Session not found");

  const now = nowIso();
  const flockName =
    patch.flockName !== undefined
      ? patch.flockName.trim() || existing.flockName
      : existing.flockName;

  const next: ProcessingSession = {
    ...existing,
    flockName,
    birdsStarted:
      patch.birdsStarted !== undefined ? patch.birdsStarted : existing.birdsStarted,
    chickCost: patch.chickCost !== undefined ? patch.chickCost : existing.chickCost,
    feedLbs: patch.feedLbs !== undefined ? patch.feedLbs : existing.feedLbs,
    feedCost: patch.feedCost !== undefined ? patch.feedCost : existing.feedCost,
    suppliesCost:
      patch.suppliesCost !== undefined ? patch.suppliesCost : existing.suppliesCost,
    targetPricePerLb:
      patch.targetPricePerLb !== undefined
        ? patch.targetPricePerLb
        : existing.targetPricePerLb,
    avgLiveWeight:
      patch.avgLiveWeight !== undefined
        ? patch.avgLiveWeight
        : existing.avgLiveWeight,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    updatedAt: now,
    syncStatus: "pending",
  };

  await db.transaction("rw", db.sessions, db.flocks, async () => {
    await db.sessions.put(next);
    if (
      patch.flockName !== undefined ||
      patch.breed !== undefined ||
      patch.flockNotes !== undefined
    ) {
      const flock = await db.flocks.get(existing.flockId);
      if (flock) {
        await db.flocks.put({
          ...flock,
          name: flockName,
          breed:
            patch.breed !== undefined ? patch.breed : flock.breed,
          notes:
            patch.flockNotes !== undefined ? patch.flockNotes : flock.notes,
          updatedAt: now,
        });
      }
    }
  });

  queueMicrotask(() => {
    void import("../sync/client").then((m) => m.syncPending()).catch(() => {});
  });

  return next;
}

export async function reopenSession(sessionId: string): Promise<void> {
  const db = getDb();
  const existing = await db.sessions.get(sessionId);
  if (!existing) throw new Error("Session not found");
  await db.sessions.update(sessionId, {
    status: "capturing",
    updatedAt: nowIso(),
    syncStatus: "pending",
  });
  queueMicrotask(() => {
    void import("../sync/client").then((m) => m.syncPending()).catch(() => {});
  });
}

export async function addBird(params: {
  sessionId: string;
  dressedWeightLb: number;
  liveWeightLb?: number | null;
  condemned?: boolean;
}): Promise<BirdRecord> {
  const db = getDb();
  const now = nowIso();
  const birds = await db.birds
    .where("sessionId")
    .equals(params.sessionId)
    .sortBy("sequence");
  const maxSeq = birds.at(-1)?.sequence ?? 0;

  const bird: BirdRecord = {
    id: uuidv7(),
    sessionId: params.sessionId,
    sequence: maxSeq + 1,
    dressedWeightLb: params.dressedWeightLb,
    liveWeightLb: params.liveWeightLb ?? null,
    condemned: params.condemned ?? false,
    notes: null,
    capturedAt: now,
    createdAt: now,
    updatedAt: now,
    clientId: uuidv7(),
    syncStatus: "pending",
  };

  await db.birds.put(bird);
  await db.sessions.update(params.sessionId, {
    updatedAt: now,
    syncStatus: "pending",
  });

  queueMicrotask(() => {
    void import("../sync/client").then((m) => m.syncPending()).catch(() => {});
  });

  return bird;
}

export async function undoLastBird(
  sessionId: string
): Promise<BirdRecord | null> {
  const db = getDb();
  const birds = await db.birds
    .where("sessionId")
    .equals(sessionId)
    .sortBy("sequence");
  const last = birds.at(-1);
  if (!last) return null;

  await db.transaction("rw", db.birds, db.sessions, async () => {
    await db.birds.delete(last.id);
    await db.sessions.update(sessionId, {
      updatedAt: nowIso(),
      syncStatus: "pending",
    });
  });

  queueMicrotask(() => {
    void import("../sync/client").then((m) => m.syncPending()).catch(() => {});
  });

  return last;
}

export async function finishSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db.sessions.update(sessionId, {
    status: "complete",
    updatedAt: nowIso(),
    syncStatus: "pending",
  });
  queueMicrotask(() => {
    void import("../sync/client").then((m) => m.syncPending()).catch(() => {});
  });
}

/** Deletes session + birds. Removes the flock only when no other sessions use it. */
export async function deleteSession(sessionId: string): Promise<void> {
  const db = getDb();
  const session = await db.sessions.get(sessionId);
  if (!session) return;

  await db.transaction("rw", db.sessions, db.birds, db.flocks, async () => {
    await db.birds.where("sessionId").equals(sessionId).delete();
    await db.sessions.delete(sessionId);
    const remaining = await db.sessions
      .where("flockId")
      .equals(session.flockId)
      .count();
    if (remaining === 0) {
      await db.flocks.delete(session.flockId);
    }
  });
}

/** Deletes a flock only when it has no sessions (safe hard-delete). */
export async function deleteFlockIfUnused(flockId: string): Promise<boolean> {
  const db = getDb();
  const count = await db.sessions.where("flockId").equals(flockId).count();
  if (count > 0) return false;
  await db.flocks.delete(flockId);
  return true;
}

export async function getRunningTally(sessionId: string): Promise<{
  count: number;
  saleable: number;
  totalDressedLb: number;
}> {
  const db = getDb();
  const birds = await db.birds.where("sessionId").equals(sessionId).toArray();
  const saleable = birds.filter((b) => !b.condemned);
  return {
    count: birds.length,
    saleable: saleable.length,
    totalDressedLb: saleable.reduce((s, b) => s + b.dressedWeightLb, 0),
  };
}
