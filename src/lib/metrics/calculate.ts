import type { BirdRecord, MetricsResult, ProcessingSession } from "../types";

function safeDiv(n: number, d: number): number | null {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  return n / d;
}

/** Build weight distribution buckets for saleable dressed weights */
export function buildWeightBuckets(
  weights: number[]
): MetricsResult["weightBuckets"] {
  if (weights.length === 0) {
    return [
      { label: "< 4 lb", count: 0, min: 0, max: 4 },
      { label: "4–5 lb", count: 0, min: 4, max: 5 },
      { label: "5–6 lb", count: 0, min: 5, max: 6 },
      { label: "6–7 lb", count: 0, min: 6, max: 7 },
      { label: "7+ lb", count: 0, min: 7, max: Infinity },
    ];
  }

  const buckets: MetricsResult["weightBuckets"] = [
    { label: "< 4 lb", count: 0, min: 0, max: 4 },
    { label: "4–5 lb", count: 0, min: 4, max: 5 },
    { label: "5–6 lb", count: 0, min: 5, max: 6 },
    { label: "6–7 lb", count: 0, min: 6, max: 7 },
    { label: "7+ lb", count: 0, min: 7, max: Infinity },
  ];

  for (const w of weights) {
    const bucket = buckets.find(
      (b) => w >= b.min && (b.max === Infinity ? true : w < b.max)
    );
    if (bucket) bucket.count += 1;
    else buckets[buckets.length - 1].count += 1;
  }

  return buckets;
}

/**
 * Pure metrics engine — formulas from Flock PRD.
 * Pass session costs/setup + bird records; returns derived KPIs.
 */
export function calculateMetrics(
  session: Pick<
    ProcessingSession,
    | "birdsStarted"
    | "chickCost"
    | "feedLbs"
    | "feedCost"
    | "suppliesCost"
    | "targetPricePerLb"
    | "avgLiveWeight"
  >,
  birds: Pick<
    BirdRecord,
    "dressedWeightLb" | "liveWeightLb" | "condemned"
  >[]
): MetricsResult {
  const birdsProcessed = birds.length;
  const saleable = birds.filter((b) => !b.condemned);
  const birdsSaleable = saleable.length;
  const birdsCondemned = birdsProcessed - birdsSaleable;

  const totalDressedLb = saleable.reduce(
    (sum, b) => sum + (b.dressedWeightLb || 0),
    0
  );
  const avgDressedLb = safeDiv(totalDressedLb, birdsSaleable);
  const lossRate = safeDiv(
    session.birdsStarted - birdsSaleable,
    session.birdsStarted
  );

  const sample = saleable.filter(
    (b) => b.liveWeightLb != null && b.liveWeightLb > 0
  );
  const sampleDressed = sample.reduce((s, b) => s + b.dressedWeightLb, 0);
  const sampleLive = sample.reduce((s, b) => s + (b.liveWeightLb ?? 0), 0);
  const dressoutPct = safeDiv(sampleDressed, sampleLive);

  let estTotalLiveLb: number | null = null;
  if (dressoutPct != null && dressoutPct > 0) {
    estTotalLiveLb = totalDressedLb / dressoutPct;
  } else if (
    session.avgLiveWeight != null &&
    session.avgLiveWeight > 0 &&
    birdsSaleable > 0
  ) {
    estTotalLiveLb = birdsSaleable * session.avgLiveWeight;
  }

  const totalCost =
    session.chickCost + session.feedCost + session.suppliesCost;
  const costPerBird = safeDiv(totalCost, birdsSaleable);
  const costPerLb = safeDiv(totalCost, totalDressedLb);
  const feedCostPerLb = safeDiv(session.feedCost, totalDressedLb);

  const breakEvenPricePerLb = costPerLb;
  const revenueAtTarget =
    totalDressedLb > 0
      ? session.targetPricePerLb * totalDressedLb
      : null;
  const profitAtTarget =
    revenueAtTarget != null ? revenueAtTarget - totalCost : null;
  const profitPerBird = safeDiv(profitAtTarget ?? NaN, birdsSaleable);
  const marginPct = safeDiv(profitAtTarget ?? NaN, revenueAtTarget ?? NaN);

  const hasLiveData =
    sample.length > 0 ||
    (session.avgLiveWeight != null && session.avgLiveWeight > 0);
  const fcr =
    hasLiveData && estTotalLiveLb != null && estTotalLiveLb > 0
      ? safeDiv(session.feedLbs, estTotalLiveLb)
      : null;

  const weightBuckets = buildWeightBuckets(
    saleable.map((b) => b.dressedWeightLb)
  );

  return {
    birdsProcessed,
    birdsSaleable,
    birdsCondemned,
    birdsStarted: session.birdsStarted,
    totalDressedLb,
    avgDressedLb,
    lossRate,
    dressoutPct,
    estTotalLiveLb,
    sampleBirdCount: sample.length,
    totalCost,
    costPerBird,
    costPerLb,
    feedCostPerLb,
    breakEvenPricePerLb,
    revenueAtTarget,
    profitAtTarget,
    profitPerBird,
    marginPct,
    fcr,
    fcrVisible: fcr != null,
    weightBuckets,
  };
}

export function formatMoney(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toFixed(digits)}`;
}

export function formatLb(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)} lb`;
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function formatNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}
