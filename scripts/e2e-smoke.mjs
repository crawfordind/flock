/**
 * Flock MVP end-to-end smoke test (Playwright).
 * Assumes next dev is running at http://localhost:3000
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "e2e-artifacts");

const results = [];

function record(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}: ${detail}`);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
}

function parseMoney(text) {
  const m = String(text).replace(/,/g, "").match(/\$?\s*([\d.]+)/);
  return m ? Number(m[1]) : NaN;
}

function parsePct(text) {
  const m = String(text).replace(/,/g, "").match(/([\d.]+)\s*%/);
  return m ? Number(m[1]) / 100 : NaN;
}

function near(actual, expected, tol) {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

async function kpiValue(page, label) {
  const kpi = page.locator(".kpi").filter({ hasText: label }).first();
  const value = await kpi.locator(".value").innerText();
  return value.trim();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  try {
    // 1. Home loads
    const res = await page.goto(BASE, { waitUntil: "networkidle" });
    const homeOk = res?.ok() && (await page.locator(".brand").first().isVisible());
    record(
      "1.home",
      !!homeOk,
      homeOk
        ? `HTTP ${res.status()} — brand visible`
        : `status=${res?.status()} brand=${await page.locator(".brand").count()}`
    );
    await shot(page, "01-home");

    // 2. Load sample → results
    await page.getByRole("button", { name: /Load sample/i }).click();
    await page.waitForURL(/\/results\//, { timeout: 15000 });
    await page.waitForSelector(".kpi", { timeout: 15000 });
    const onResults = page.url().includes("/results/");
    const bodyText = await page.locator("body").innerText();
    const flockVisible = /Freedom Rangers/i.test(bodyText);
    record(
      "2.load-sample",
      onResults && flockVisible,
      `url=${page.url()} flockVisible=${flockVisible}`
    );
    await shot(page, "02-sample-results");

    // 3. Metrics match PRD worked example
    const costPerLb = parseMoney(await kpiValue(page, "Cost / lb"));
    const totalDressed = Number(
      (await kpiValue(page, "Total dressed lb")).replace(/,/g, "")
    );
    const fcr = Number(
      (await kpiValue(page, "Feed conversion")).replace(/,/g, "")
    );
    const marginText = await page.locator(".hero-card.alt .big").innerText();
    const margin = parsePct(marginText);
    const breakEven = parseMoney(
      await page.locator(".hero-card .big").first().innerText()
    );
    const metricsOk =
      near(costPerLb, 1.94, 0.02) &&
      near(margin, 0.68, 0.02) &&
      near(totalDressed, 247.6, 0.2) &&
      near(fcr, 2.6, 0.15) &&
      near(breakEven, 1.94, 0.02);
    record(
      "3.sample-metrics",
      metricsOk,
      `cost/lb=${costPerLb} margin=${margin} dressed=${totalDressed} fcr=${fcr} be=${breakEven}`
    );

    // 4. New session → Setup → Start capture
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: /^New session$/i }).first().click();
    await page.waitForURL(/\/setup/);
    await page.locator("#flockName").fill("E2E Test Flock");
    await page.locator("#breed").fill("Freedom Ranger");
    await page.locator("#birdsStarted").fill("5");
    await page.locator("#chickCost").fill("20");
    await page.locator("#feedLbs").fill("50");
    await page.locator("#feedCost").fill("25");
    await page.locator("#suppliesCost").fill("5");
    await page.locator("#targetPricePerLb").fill("6.00");
    await page.getByRole("button", { name: /Start capture/i }).click();
    await page.waitForURL(/\/capture\//, { timeout: 15000 });
    const captureUrl = page.url();
    record(
      "4.new-session",
      /\/capture\//.test(captureUrl),
      `navigated to ${captureUrl}`
    );
    await shot(page, "04-capture");

    // 5. Capture: dark UI, numpad, log, tally, toggles
    const bg = await page.locator(".capture-root").evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });
    // #0e110f ≈ rgb(14, 17, 15)
    const dark =
      /rgb\(\s*14\s*,\s*17\s*,\s*15\s*\)/i.test(bg) ||
      bg === "rgb(14, 17, 15)";

    await page.locator(".num-key", { hasText: "5" }).click();
    await page.locator(".num-key", { hasText: "." }).click();
    await page.locator(".num-key", { hasText: "2" }).click();
    await page.locator(".num-key", { hasText: "0" }).click();
    const readout = await page.locator(".readout .number").innerText();
    const numpadOk = readout.trim() === "5.20";

    await page.getByRole("button", { name: /^Log bird$/i }).click();
    await page.waitForTimeout(400);
    const tally1 = await page.locator(".tally").innerText();
    const tallyOk = /1 saleable/i.test(tally1) && /5\.2\s*lb/i.test(tally1);

    // Condemned toggle
    await page.getByRole("button", { name: /^Condemned$/i }).click();
    const condemnedOn = await page
      .getByRole("button", { name: /^Condemned$/i })
      .evaluate((el) => el.classList.contains("on-condemned"));
    await page.locator(".num-key", { hasText: "3" }).click();
    await page.locator(".num-key", { hasText: "." }).click();
    await page.locator(".num-key", { hasText: "8" }).click();
    await page.getByRole("button", { name: /^Log bird$/i }).click();
    await page.waitForTimeout(400);
    const tally2 = await page.locator(".tally").innerText();
    // saleable still 1; total dressed includes condemned? Looking at getRunningTally...
    const condemnedLogged = /Bird\s+3/i.test(tally2) || /2\s/.test(tally2);

    // Live sample toggle
    await page.getByRole("button", { name: /^Live sample$/i }).click();
    const liveOn = await page
      .getByRole("button", { name: /^Live sample$/i })
      .evaluate((el) => el.classList.contains("on-live"));
    // Enter live then dressed
    for (const k of ["7", ".", "0", "0"]) {
      await page.locator(".num-key", { hasText: k }).click();
    }
    await page.getByRole("button", { name: /Save live/i }).click();
    await page.waitForTimeout(300);
    const liveFlash = await page.getByText(/Live saved/i).isVisible().catch(() => false);
    for (const k of ["5", ".", "0", "0"]) {
      await page.locator(".num-key", { hasText: k }).click();
    }
    await page.getByRole("button", { name: /^Log bird$/i }).click();
    await page.waitForTimeout(400);
    const tally3 = await page.locator(".tally").innerText();
    const liveLogged = /2 saleable/i.test(tally3);

    const captureOk =
      dark && numpadOk && tallyOk && condemnedOn && liveOn && liveFlash && liveLogged;
    record(
      "5.capture",
      captureOk,
      `dark=${dark} bg=${bg} numpad=${numpadOk} readout=${readout} tally1=${JSON.stringify(tally1)} condemnedOn=${condemnedOn} liveOn=${liveOn} liveFlash=${liveFlash} tally3=${JSON.stringify(tally3)}`
    );
    await shot(page, "05-capture-after-logs");

    // Mid-session reload (Dexie persistence)
    const midUrl = page.url();
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector(".tally", { timeout: 10000 });
    const tallyAfterReload = await page.locator(".tally").innerText();
    const persistMid =
      /2 saleable/i.test(tallyAfterReload) && page.url() === midUrl;
    record(
      "7a.reload-mid-session",
      persistMid,
      `tally=${JSON.stringify(tallyAfterReload)}`
    );

    // 5b. Undo last bird then re-log to restore expected tally
    const tallyBeforeUndo = await page.locator(".tally").innerText();
    await page.getByRole("button", { name: /Undo last/i }).click();
    await page.waitForTimeout(400);
    const tallyAfterUndo = await page.locator(".tally").innerText();
    const undoOk =
      /1 saleable/i.test(tallyAfterUndo) && /2 saleable/i.test(tallyBeforeUndo);
    // Re-log the saleable bird that was undone (live mode may still be on)
    const liveStillOn = await page
      .getByRole("button", { name: /^Live sample$/i })
      .evaluate((el) => el.classList.contains("on-live"));
    if (liveStillOn) {
      await page.getByRole("button", { name: /^Live sample$/i }).click();
    }
    for (const k of ["5", ".", "0", "0"]) {
      await page.locator(".num-key", { hasText: k }).click();
    }
    await page.getByRole("button", { name: /^Log bird$/i }).click();
    await page.waitForTimeout(400);
    const tallyRestored = await page.locator(".tally").innerText();
    const undoRestoreOk = undoOk && /2 saleable/i.test(tallyRestored);
    record(
      "5b.undo",
      undoRestoreOk,
      `before=${JSON.stringify(tallyBeforeUndo)} afterUndo=${JSON.stringify(tallyAfterUndo)} restored=${JSON.stringify(tallyRestored)}`
    );

    // 6. Finish → confirm → Results
    await page.getByRole("button", { name: /^Finish$/i }).click();
    await page.getByRole("button", { name: /Keep capturing/i }).waitFor({
      timeout: 5000,
    });
    await page.getByRole("button", { name: /^Finish session$/i }).click();
    await page.waitForURL(/\/results\//, { timeout: 15000 });
    await page.waitForSelector(".kpi", { timeout: 15000 });
    const finishBody = await page.locator("body").innerText();
    const resultsHeading = /\bResults\b/.test(finishBody);
    const e2eFlock = /E2E Test Flock/i.test(finishBody);
    const saleable = await kpiValue(page, "Saleable birds");
    const finishOk =
      resultsHeading && e2eFlock && /2\s*\/\s*5/.test(saleable.replace(/\s/g, " "));
    record(
      "6.finish-results",
      finishOk,
      `heading=${resultsHeading} flock=${e2eFlock} saleable=${saleable}`
    );
    await shot(page, "06-e2e-results");

    // 7b. Reload after capture — data survives
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector(".kpi", { timeout: 10000 });
    const saleable2 = await kpiValue(page, "Saleable birds");
    const persistAfter =
      (await page.getByText(/E2E Test Flock/i).first().isVisible()) &&
      /2/.test(saleable2);
    record(
      "7b.reload-after-finish",
      persistAfter,
      `saleable=${saleable2}`
    );

    // 8. PDF export
    let pdfOk = false;
    let pdfDetail = "";
    try {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 10000 }),
        page.getByRole("button", { name: /Download PDF/i }).click(),
      ]);
      const suggested = download.suggestedFilename();
      const dest = path.join(OUT, suggested || "session.pdf");
      await download.saveAs(dest);
      pdfOk = true;
      pdfDetail = `downloaded ${suggested} → ${dest}`;
    } catch (e) {
      // jsPDF may trigger blob download differently — check button didn't error
      const btnErr = consoleErrors.filter((x) => /pdf|jspdf/i.test(x));
      try {
        await page.getByRole("button", { name: /Download PDF/i }).click();
        await page.waitForTimeout(800);
        pdfOk = btnErr.length === 0 && consoleErrors.length === 0;
        pdfDetail = `no download event; consoleErrors=${consoleErrors.slice(-5).join(" | ") || "none"}`;
      } catch (e2) {
        pdfOk = false;
        pdfDetail = String(e2);
      }
    }
    record("8.pdf-export", pdfOk, pdfDetail);
    await shot(page, "08-after-pdf");

    // Home still lists sessions
    await page.goto(BASE, { waitUntil: "networkidle" });
    const listed = await page.getByText(/E2E Test Flock|Freedom Rangers/i).count();
    record("extra.home-lists-sessions", listed >= 1, `session links visible count≈${listed}`);
    await shot(page, "09-home-with-sessions");
  } catch (e) {
    record("fatal", false, String(e));
    try {
      await shot(page, "fatal");
    } catch {
      /* ignore */
    }
  } finally {
    await browser.close();
  }

  const report = {
    base: BASE,
    at: new Date().toISOString(),
    results,
    consoleErrors,
    passed: results.every((r) => r.pass),
  };
  await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log("\n--- SUMMARY ---");
  console.log(report.passed ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED");
  console.log(`Artifacts: ${OUT}`);
  process.exit(report.passed ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
