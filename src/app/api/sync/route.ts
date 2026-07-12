import { NextResponse } from "next/server";
import type { BirdRecord, ProcessingSession } from "@/lib/types";
import {
  ensureCloudSchema,
  getTursoClient,
  upsertBird,
  upsertSession,
} from "@/lib/sync/turso";

type SyncPayload = {
  sessions: ProcessingSession[];
  birds: BirdRecord[];
};

export async function POST(request: Request) {
  let body: SyncPayload;
  try {
    body = (await request.json()) as SyncPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessions = Array.isArray(body.sessions) ? body.sessions : [];
  const birds = Array.isArray(body.birds) ? body.birds : [];

  const db = await getTursoClient();
  if (!db) {
    return NextResponse.json({
      ok: true,
      cloudEnabled: false,
      message: "Local-only mode — Turso not configured",
      received: { sessions: sessions.length, birds: birds.length },
    });
  }

  try {
    await ensureCloudSchema(db);
    for (const s of sessions) await upsertSession(db, s);
    for (const b of birds) await upsertBird(db, b);

    return NextResponse.json({
      ok: true,
      cloudEnabled: true,
      message: "Synced",
      received: { sessions: sessions.length, birds: birds.length },
    });
  } catch (err) {
    console.error("sync error", err);
    return NextResponse.json(
      {
        ok: false,
        cloudEnabled: true,
        error: err instanceof Error ? err.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}
