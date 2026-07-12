"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  deleteSession,
  getSession,
  reopenSession,
} from "@/lib/db/sessions";
import {
  formatLb,
  formatMoney,
  formatNum,
  formatPct,
  groupBirdsByCapture,
} from "@/lib/metrics/calculate";
import { buildSessionSummaryText, downloadSessionPdf } from "@/lib/pdf";
import type {
  CaptureBreakdown,
  MetricsResult,
  ProcessingSession,
} from "@/lib/types";

export default function ResultsPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const router = useRouter();

  const [session, setSession] = useState<ProcessingSession | null>(null);
  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
  const [harvests, setHarvests] = useState<CaptureBreakdown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await getSession(sessionId);
      if (!data) {
        setError("Session not found");
        return;
      }
      setSession(data.session);
      setMetrics(data.metrics);
      setHarvests(groupBirdsByCapture(data.birds));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function sendEmail() {
    if (!session || !metrics || !email.trim()) return;
    setEmailBusy(true);
    setEmailMsg(null);
    try {
      const text = buildSessionSummaryText(session, metrics, harvests);
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email.trim(),
          subject: `Flock summary — ${session.flockName}`,
          text,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailMsg(data.error ?? "Send failed");
      } else if (data.stubbed) {
        setEmailMsg("Email stubbed (SMTP not configured). Summary ready locally.");
      } else {
        setEmailMsg("Email sent.");
      }
    } catch (e) {
      setEmailMsg(e instanceof Error ? e.message : "Send failed");
    } finally {
      setEmailBusy(false);
    }
  }

  async function onReopen() {
    setBusy(true);
    setActionError(null);
    try {
      await reopenSession(sessionId);
      router.push(`/capture/${sessionId}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not reopen");
      setBusy(false);
    }
  }

  async function onDeleteConfirmed() {
    setBusy(true);
    setActionError(null);
    try {
      await deleteSession(sessionId);
      router.push("/");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  if (error) {
    return (
      <div className="app-shell" style={{ padding: "2rem" }}>
        <p style={{ color: "var(--danger)" }}>{error}</p>
        <Link href="/" className="btn btn-ghost">
          Home
        </Link>
      </div>
    );
  }

  if (!session || !metrics) {
    return (
      <div className="app-shell" style={{ padding: "2rem" }}>
        <p className="muted">Loading results…</p>
      </div>
    );
  }

  const maxBucket = Math.max(1, ...metrics.weightBuckets.map((b) => b.count));
  const noBirds = metrics.birdsProcessed === 0;
  const capturing = session.status === "capturing";

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <Link href="/" className="brand">
            Flock <span>·</span>
          </Link>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            {session.flockName} ·{" "}
            {new Date(session.processedAt).toLocaleDateString()}
            {harvests.length > 1
              ? ` · ${harvests.length} harvests`
              : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {capturing ? (
            <Link href={`/capture/${session.id}`} className="btn btn-secondary">
              Resume capture
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void onReopen()}
            >
              {busy ? "Opening…" : "Reopen capture"}
            </button>
          )}
          <Link href={`/edit/${session.id}`} className="btn btn-ghost">
            Edit
          </Link>
          <Link href="/" className="btn btn-ghost">
            All sessions
          </Link>
        </div>
      </header>

      <main
        style={{
          maxWidth: 920,
          margin: "0 auto",
          padding: "1.5rem 1.25rem 3rem",
          display: "grid",
          gap: "1.5rem",
        }}
      >
        <section className="animate-in">
          <h1
            style={{
              fontSize: "1.75rem",
              letterSpacing: "-0.03em",
              margin: "0 0 1rem",
            }}
          >
            Results
          </h1>

          {actionError && (
            <p
              role="alert"
              style={{ color: "var(--danger)", marginBottom: "1rem" }}
            >
              {actionError}
            </p>
          )}

          {noBirds ? (
            <div className="panel">
              <h2
                style={{
                  margin: "0 0 0.4rem",
                  fontSize: "1.15rem",
                  letterSpacing: "-0.02em",
                }}
              >
                No birds logged yet
              </h2>
              <p className="muted" style={{ margin: "0 0 1rem" }}>
                Cost and yield numbers need at least one dressed weight.
                {capturing
                  ? " Resume capture to start logging on the line."
                  : " This session was finished without birds."}
              </p>
              {capturing && (
                <Link
                  href={`/capture/${session.id}`}
                  className="btn btn-primary"
                >
                  Resume capture
                </Link>
              )}
            </div>
          ) : (
            <div className="hero-metrics">
              <div className="hero-card">
                <div className="eyebrow">Break-even price</div>
                <div className="big">
                  {formatMoney(metrics.breakEvenPricePerLb)}
                  <span style={{ fontSize: "1rem", opacity: 0.8 }}>/lb</span>
                </div>
                <div style={{ marginTop: "0.5rem", opacity: 0.8 }}>
                  What you need per dressed pound to cover costs
                </div>
              </div>
              <div className="hero-card alt">
                <div className="eyebrow">Margin at your target</div>
                <div className="big">{formatPct(metrics.marginPct)}</div>
                <div style={{ marginTop: "0.5rem", opacity: 0.8 }}>
                  At {formatMoney(session.targetPricePerLb)}/lb · profit{" "}
                  {formatMoney(metrics.profitAtTarget)}
                </div>
              </div>
            </div>
          )}
        </section>

        {harvests.length > 1 && (
          <section className="panel animate-in delay-1">
            <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>
              By harvest
            </h2>
            <p
              className="muted"
              style={{ margin: "0 0 1rem", fontSize: "0.9rem" }}
            >
              Yield per harvest day. Session costs and overall totals still
              roll up everything.
            </p>
            <div style={{ display: "grid", gap: "0.65rem" }}>
              {harvests.map((h) => (
                <div
                  key={h.captureIndex}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(5.5rem, auto) 1fr auto",
                    gap: "0.75rem",
                    alignItems: "baseline",
                    padding: "0.55rem 0",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    Harvest {h.captureIndex}
                  </div>
                  <div className="muted" style={{ fontSize: "0.9rem" }}>
                    {h.birdsSaleable} saleable
                    {h.birdsCondemned > 0
                      ? ` · ${h.birdsCondemned} condemned`
                      : ""}
                    {" · "}
                    {h.birdsProcessed} logged
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      textAlign: "right",
                    }}
                  >
                    {formatNum(h.totalDressedLb, 1)} lb
                    {h.avgDressedLb != null && (
                      <div
                        className="muted"
                        style={{ fontSize: "0.8rem", fontWeight: 500 }}
                      >
                        avg {formatLb(h.avgDressedLb)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="panel animate-in delay-1">
          <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem" }}>
            Yield & cost
          </h2>
          <div className="kpi-grid">
            <div className="kpi">
              <div className="label">Saleable birds</div>
              <div className="value">
                {metrics.birdsSaleable}
                <span style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>
                  /{metrics.birdsStarted}
                </span>
              </div>
            </div>
            <div className="kpi">
              <div className="label">Total dressed lb</div>
              <div className="value">{formatNum(metrics.totalDressedLb, 1)}</div>
            </div>
            <div className="kpi">
              <div className="label">Avg dressed lb</div>
              <div className="value">{formatLb(metrics.avgDressedLb)}</div>
            </div>
            <div className="kpi">
              <div className="label">Loss rate</div>
              <div className="value">{formatPct(metrics.lossRate)}</div>
            </div>
            <div className="kpi">
              <div className="label">Cost / lb</div>
              <div className="value">{formatMoney(metrics.costPerLb)}</div>
            </div>
            <div className="kpi">
              <div className="label">Cost / bird</div>
              <div className="value">{formatMoney(metrics.costPerBird)}</div>
            </div>
            <div className="kpi">
              <div className="label">Dress-out %</div>
              <div className="value">{formatPct(metrics.dressoutPct)}</div>
            </div>
            <div className="kpi">
              <div className="label">Feed conversion</div>
              <div className="value">
                {metrics.fcrVisible ? formatNum(metrics.fcr, 2) : "—"}
              </div>
            </div>
          </div>
          {!metrics.fcrVisible && (
            <p
              className="muted"
              style={{ marginBottom: 0, marginTop: "0.85rem", fontSize: "0.9rem" }}
            >
              Feed conversion (FCR) needs a live weight — sample birds during
              capture, or set average live weight at setup.
            </p>
          )}
          <p
            className="muted"
            style={{ marginBottom: 0, marginTop: "0.5rem", fontSize: "0.85rem" }}
          >
            Dress-out % is dressed ÷ live when live weights are available.
          </p>
        </section>

        <section className="panel animate-in delay-2">
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>
            Cost ledger
          </h2>
          <LedgerRow label="Chicks" value={formatMoney(session.chickCost)} />
          <LedgerRow
            label={`Feed (${session.feedLbs} lb)`}
            value={formatMoney(session.feedCost)}
          />
          <LedgerRow label="Supplies" value={formatMoney(session.suppliesCost)} />
          <LedgerRow label="Total cost" value={formatMoney(metrics.totalCost)} bold />
          <LedgerRow
            label="Feed cost / lb dressed"
            value={formatMoney(metrics.feedCostPerLb)}
          />
        </section>

        <section className="panel">
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>
            Profit at target
          </h2>
          <LedgerRow
            label="Revenue"
            value={formatMoney(metrics.revenueAtTarget)}
          />
          <LedgerRow label="Profit" value={formatMoney(metrics.profitAtTarget)} bold />
          <LedgerRow
            label="Profit / bird"
            value={formatMoney(metrics.profitPerBird)}
          />
        </section>

        <section className="panel">
          <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem" }}>
            Weight distribution
          </h2>
          {noBirds ? (
            <p className="muted" style={{ margin: 0 }}>
              Buckets appear after you log dressed weights.
            </p>
          ) : (
            metrics.weightBuckets.map((b) => (
              <div className="bar-row" key={b.label}>
                <div className="muted" style={{ fontSize: "0.85rem" }}>
                  {b.label}
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(b.count / maxBucket) * 100}%` }}
                  />
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    textAlign: "right",
                  }}
                >
                  {b.count}
                </div>
              </div>
            ))
          )}
        </section>

        <section className="panel">
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>Export</h2>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={noBirds}
              onClick={() => downloadSessionPdf(session, metrics)}
            >
              Download PDF
            </button>
          </div>
          <div
            className="grid-form"
            style={{ marginTop: "1rem", maxWidth: 420 }}
          >
            <div className="field">
              <label htmlFor="email">Email summary</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@farm.example"
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={emailBusy || !email.trim() || noBirds}
              onClick={() => void sendEmail()}
            >
              {emailBusy ? "Sending…" : "Email summary"}
            </button>
            {emailMsg && (
              <p className="muted" style={{ margin: 0 }}>
                {emailMsg}
              </p>
            )}
          </div>
        </section>

        <section className="panel">
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>
            Session actions
          </h2>
          {confirmDelete ? (
            <div
              className="confirm-panel"
              role="alertdialog"
              aria-labelledby="results-delete-title"
            >
              <h3
                id="results-delete-title"
                style={{ margin: "0 0 0.4rem", fontSize: "1.05rem" }}
              >
                Delete this session?
              </h3>
              <p className="muted" style={{ margin: "0 0 1rem" }}>
                Removes {metrics.birdsProcessed} bird
                {metrics.birdsProcessed === 1 ? "" : "s"} and this session.
                Cannot be undone.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep session
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() => void onDeleteConfirmed()}
                >
                  {busy ? "Deleting…" : "Delete session"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link href={`/edit/${session.id}`} className="btn btn-secondary">
                Edit costs & flock
              </Link>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                Delete session
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function LedgerRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "1rem",
        padding: "0.55rem 0",
        borderBottom: "1px solid var(--line)",
        fontWeight: bold ? 700 : 400,
      }}
    >
      <span>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)" }}>{value}</span>
    </div>
  );
}
