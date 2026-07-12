import type { BirdRecord, ProcessingSession } from "../types";
import { nowIso, uuidv7 } from "../uuid";
import { ensureDemoUser, getDb } from "./dexie";

/** Deterministic weights summing to target total */
function buildSaleableWeights(count: number, total: number): number[] {
  const base = Math.floor((total / count) * 100) / 100;
  const weights = Array.from({ length: count }, () => base);
  let sum = weights.reduce((a, b) => a + b, 0);
  const diff = Math.round((total - sum) * 100) / 100;
  weights[0] = Math.round((weights[0] + diff) * 100) / 100;
  sum = weights.reduce((a, b) => a + b, 0);
  const residual = Math.round((total - sum) * 100) / 100;
  weights[count - 1] = Math.round((weights[count - 1] + residual) * 100) / 100;
  return weights;
}

/**
 * Load MVP sample: 50 Freedom Rangers matching PRD worked example.
 * 48 saleable ≈ 247.6 lb, 2 condemned, dress-out sample ≈ 71.7%.
 */
export async function loadSampleSession(): Promise<ProcessingSession> {
  const db = getDb();
  const user = await ensureDemoUser();
  const now = nowIso();

  const flockId = uuidv7();
  const sessionId = uuidv7();

  await db.flocks.put({
    id: flockId,
    userId: user.id,
    name: "Freedom Rangers — Spring Batch",
    breed: "Freedom Ranger",
    hatchDate: null,
    notes: "MVP sample flock",
    createdAt: now,
    updatedAt: now,
    clientId: uuidv7(),
  });

  const session: ProcessingSession = {
    id: sessionId,
    userId: user.id,
    flockId,
    flockName: "Freedom Rangers — Spring Batch",
    processedAt: now,
    birdsStarted: 50,
    chickCost: 130,
    feedLbs: 900,
    feedCost: 290,
    suppliesCost: 60,
    targetPricePerLb: 6.0,
    avgLiveWeight: null,
    notes: "Sample session from PRD worked example",
    status: "complete",
    createdAt: now,
    updatedAt: now,
    clientId: uuidv7(),
    syncStatus: "pending",
  };

  await db.sessions.put(session);

  const weights = buildSaleableWeights(48, 247.6);
  const birds: BirdRecord[] = [];

  for (let i = 0; i < weights.length; i++) {
    const dressed = weights[i];
    // First 6 birds have live weights for ~71.7% dress-out sample
    const live = i < 6 ? Math.round((dressed / 0.717) * 100) / 100 : null;
    birds.push({
      id: uuidv7(),
      sessionId,
      sequence: i + 1,
      dressedWeightLb: dressed,
      liveWeightLb: live,
      condemned: false,
      notes: null,
      capturedAt: now,
      createdAt: now,
      updatedAt: now,
      clientId: uuidv7(),
      syncStatus: "pending",
    });
  }

  birds.push(
    {
      id: uuidv7(),
      sessionId,
      sequence: 49,
      dressedWeightLb: 4.2,
      liveWeightLb: null,
      condemned: true,
      notes: "Condemned",
      capturedAt: now,
      createdAt: now,
      updatedAt: now,
      clientId: uuidv7(),
      syncStatus: "pending",
    },
    {
      id: uuidv7(),
      sessionId,
      sequence: 50,
      dressedWeightLb: 3.9,
      liveWeightLb: null,
      condemned: true,
      notes: "Condemned",
      capturedAt: now,
      createdAt: now,
      updatedAt: now,
      clientId: uuidv7(),
      syncStatus: "pending",
    }
  );

  await db.birds.bulkPut(birds);
  return session;
}
