import { jsPDF } from "jspdf";
import type { CaptureBreakdown, MetricsResult, ProcessingSession } from "./types";
import {
  formatLb,
  formatMoney,
  formatNum,
  formatPct,
} from "./metrics/calculate";

export function buildSessionSummaryText(
  session: ProcessingSession,
  metrics: MetricsResult,
  harvests?: CaptureBreakdown[]
): string {
  const lines = [
    `Flock processing summary — ${session.flockName}`,
    `Date: ${new Date(session.processedAt).toLocaleString()}`,
    "",
    `Birds started: ${session.birdsStarted}`,
    `Processed: ${metrics.birdsProcessed}`,
    `Saleable: ${metrics.birdsSaleable}`,
    `Condemned: ${metrics.birdsCondemned}`,
    `Total dressed: ${formatLb(metrics.totalDressedLb)}`,
    `Avg dressed: ${formatLb(metrics.avgDressedLb)}`,
    `Loss rate: ${formatPct(metrics.lossRate)}`,
    "",
    `Dress-out: ${formatPct(metrics.dressoutPct)}`,
    `FCR: ${metrics.fcrVisible ? formatNum(metrics.fcr, 2) : "n/a"}`,
    "",
    `Total cost: ${formatMoney(metrics.totalCost)}`,
    `  Chicks: ${formatMoney(session.chickCost)}`,
    `  Feed: ${formatMoney(session.feedCost)} (${session.feedLbs} lb)`,
    `  Supplies: ${formatMoney(session.suppliesCost)}`,
    `Cost / lb: ${formatMoney(metrics.costPerLb)}`,
    `Break-even: ${formatMoney(metrics.breakEvenPricePerLb)}/lb`,
    "",
    `Target: ${formatMoney(session.targetPricePerLb)}/lb`,
    `Revenue at target: ${formatMoney(metrics.revenueAtTarget)}`,
    `Profit at target: ${formatMoney(metrics.profitAtTarget)}`,
    `Margin: ${formatPct(metrics.marginPct)}`,
    `Profit / bird: ${formatMoney(metrics.profitPerBird)}`,
  ];

  if (harvests && harvests.length > 1) {
    lines.push("", "By harvest:");
    for (const h of harvests) {
      lines.push(
        `  Harvest ${h.captureIndex}: ${h.birdsSaleable} saleable, ${formatLb(h.totalDressedLb)}`
      );
    }
  }

  return lines.join("\n");
}

export function downloadSessionPdf(
  session: ProcessingSession,
  metrics: MetricsResult
): void {
  const doc = new jsPDF();
  const title = "Flock — Processing Summary";
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 14, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(session.flockName, 14, y);
  y += 7;
  doc.text(new Date(session.processedAt).toLocaleString(), 14, y);
  y += 12;

  const rows: [string, string][] = [
    ["Birds saleable", String(metrics.birdsSaleable)],
    ["Total dressed", formatLb(metrics.totalDressedLb)],
    ["Avg dressed", formatLb(metrics.avgDressedLb)],
    ["Dress-out", formatPct(metrics.dressoutPct)],
    ["Cost / lb", formatMoney(metrics.costPerLb)],
    ["Break-even", `${formatMoney(metrics.breakEvenPricePerLb)}/lb`],
    ["Target price", `${formatMoney(session.targetPricePerLb)}/lb`],
    ["Revenue @ target", formatMoney(metrics.revenueAtTarget)],
    ["Profit @ target", formatMoney(metrics.profitAtTarget)],
    ["Margin", formatPct(metrics.marginPct)],
    ["FCR", metrics.fcrVisible ? formatNum(metrics.fcr, 2) : "—"],
    ["Total cost", formatMoney(metrics.totalCost)],
  ];

  for (const [label, value] of rows) {
    doc.setFont("helvetica", "normal");
    doc.text(label, 14, y);
    doc.setFont("helvetica", "bold");
    doc.text(value, 100, y);
    y += 8;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  }

  const safeName = session.flockName.replace(/[^\w\-]+/g, "_").slice(0, 40);
  doc.save(`flock-${safeName}.pdf`);
}
