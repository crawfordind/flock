/** Shared domain types for Flock offline + sync */

export type SyncStatus = "pending" | "synced" | "conflict";

export interface User {
  id: string;
  email: string | null;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  clientId: string;
}

export interface Flock {
  id: string;
  userId: string;
  name: string;
  breed: string | null;
  hatchDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  clientId: string;
}

export interface FeedLog {
  id: string;
  flockId: string;
  lbs: number;
  cost: number;
  loggedAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  clientId: string;
}

export interface ProcessingSession {
  id: string;
  userId: string;
  flockId: string;
  /** Denormalized for list/results without joins */
  flockName: string;
  processedAt: string;
  birdsStarted: number;
  chickCost: number;
  feedLbs: number;
  feedCost: number;
  suppliesCost: number;
  targetPricePerLb: number;
  /** Optional fallback for FCR when no live samples */
  avgLiveWeight: number | null;
  notes: string | null;
  status: "setup" | "capturing" | "complete";
  createdAt: string;
  updatedAt: string;
  clientId: string;
  syncStatus: SyncStatus;
}

export interface BirdRecord {
  id: string;
  sessionId: string;
  sequence: number;
  dressedWeightLb: number;
  liveWeightLb: number | null;
  condemned: boolean;
  notes: string | null;
  capturedAt: string;
  createdAt: string;
  updatedAt: string;
  clientId: string;
  syncStatus: SyncStatus;
}

export interface Media {
  id: string;
  sessionId: string | null;
  birdId: string | null;
  kind: "photo" | "pdf" | "other";
  url: string;
  createdAt: string;
  updatedAt: string;
  clientId: string;
}

export interface SessionInput {
  /** Reuse an existing flock instead of creating a new one */
  flockId?: string;
  flockName: string;
  breed?: string;
  birdsStarted: number;
  chickCost: number;
  feedLbs: number;
  feedCost: number;
  suppliesCost: number;
  targetPricePerLb: number;
  avgLiveWeight?: number | null;
  notes?: string | null;
}

/** Patch fields for editing an existing session (and linked flock name/breed). */
export interface SessionUpdate {
  flockName?: string;
  breed?: string | null;
  flockNotes?: string | null;
  birdsStarted?: number;
  chickCost?: number;
  feedLbs?: number;
  feedCost?: number;
  suppliesCost?: number;
  targetPricePerLb?: number;
  avgLiveWeight?: number | null;
  notes?: string | null;
}

export interface MetricsResult {
  birdsProcessed: number;
  birdsSaleable: number;
  birdsCondemned: number;
  birdsStarted: number;
  totalDressedLb: number;
  avgDressedLb: number | null;
  lossRate: number | null;

  dressoutPct: number | null;
  estTotalLiveLb: number | null;
  sampleBirdCount: number;

  totalCost: number;
  costPerBird: number | null;
  costPerLb: number | null;
  feedCostPerLb: number | null;

  breakEvenPricePerLb: number | null;
  revenueAtTarget: number | null;
  profitAtTarget: number | null;
  profitPerBird: number | null;
  marginPct: number | null;

  fcr: number | null;
  fcrVisible: boolean;

  weightBuckets: { label: string; count: number; min: number; max: number }[];
}
