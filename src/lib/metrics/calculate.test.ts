import { describe, expect, it } from "vitest";
import { calculateMetrics } from "./calculate";

/** Worked Freedom Rangers sample from PRD */
describe("calculateMetrics — Freedom Rangers worked example", () => {
  const session = {
    birdsStarted: 50,
    chickCost: 130,
    feedLbs: 900,
    feedCost: 290,
    suppliesCost: 60,
    targetPricePerLb: 6.0,
    avgLiveWeight: null as number | null,
  };

  // 48 saleable averaging ~5.1583 lb → 247.6 total
  // Plus 2 condemned (weights ignored for saleable totals)
  // Live samples sized for ~71.7% dress-out
  const saleableWeights = buildSaleableWeights(48, 247.6);
  const birds = [
    ...saleableWeights.map((dressedWeightLb, i) => ({
      dressedWeightLb,
      liveWeightLb: i < 6 ? dressedWeightLb / 0.717 : null,
      condemned: false,
    })),
    { dressedWeightLb: 4.2, liveWeightLb: null, condemned: true },
    { dressedWeightLb: 3.8, liveWeightLb: null, condemned: true },
  ];

  it("matches yield and cost worked numbers", () => {
    const m = calculateMetrics(session, birds);

    expect(m.birdsProcessed).toBe(50);
    expect(m.birdsSaleable).toBe(48);
    expect(m.birdsCondemned).toBe(2);
    expect(m.totalDressedLb).toBeCloseTo(247.6, 1);
    expect(m.avgDressedLb!).toBeCloseTo(5.16, 1);
    expect(m.lossRate!).toBeCloseTo(0.04, 3);

    expect(m.totalCost).toBe(480);
    expect(m.costPerLb!).toBeCloseTo(1.94, 2);
    expect(m.revenueAtTarget!).toBeCloseTo(1485.6, 1);
    expect(m.profitAtTarget!).toBeCloseTo(1005.6, 1);
    expect(m.marginPct!).toBeCloseTo(0.68, 2);
    expect(m.profitPerBird!).toBeCloseTo(20.95, 1);
  });

  it("matches dress-out and FCR", () => {
    const m = calculateMetrics(session, birds);
    expect(m.dressoutPct!).toBeCloseTo(0.717, 2);
    expect(m.estTotalLiveLb!).toBeCloseTo(345, 0);
    expect(m.fcr!).toBeCloseTo(2.6, 1);
    expect(m.fcrVisible).toBe(true);
  });

  it("hides FCR when no live data", () => {
    const noLive = birds.map((b) => ({ ...b, liveWeightLb: null }));
    const m = calculateMetrics(session, noLive);
    expect(m.fcrVisible).toBe(false);
    expect(m.fcr).toBeNull();
    expect(m.dressoutPct).toBeNull();
  });

  it("uses avg live weight fallback for FCR", () => {
    const noLive = birds.map((b) => ({ ...b, liveWeightLb: null }));
    const m = calculateMetrics(
      { ...session, avgLiveWeight: 7.2 },
      noLive
    );
    expect(m.fcrVisible).toBe(true);
    expect(m.estTotalLiveLb!).toBeCloseTo(48 * 7.2, 5);
    expect(m.fcr!).toBeCloseTo(900 / (48 * 7.2), 5);
  });
});

function buildSaleableWeights(count: number, total: number): number[] {
  const base = Math.floor((total / count) * 100) / 100;
  const weights = Array.from({ length: count }, () => base);
  let sum = weights.reduce((a, b) => a + b, 0);
  const diff = Math.round((total - sum) * 100) / 100;
  weights[0] = Math.round((weights[0] + diff) * 100) / 100;
  sum = weights.reduce((a, b) => a + b, 0);
  // Final nudge on last bird if needed
  const residual = Math.round((total - sum) * 100) / 100;
  weights[count - 1] = Math.round((weights[count - 1] + residual) * 100) / 100;
  return weights;
}
