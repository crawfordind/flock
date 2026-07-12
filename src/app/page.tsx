"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { deleteSession, listSessions } from "@/lib/db/sessions";
import { loadSampleSession } from "@/lib/db/sample";
import {
  formatMoney,
  formatNum,
} from "@/lib/metrics/calculate";
import type { MetricsResult, ProcessingSession } from "@/lib/types";

type Row = ProcessingSession & { metrics: MetricsResult };

function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function HomePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listSessions();
      setSessions(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onLoadSample() {
    setBusy(true);
    setError(null);
    try {
      const session = await loadSampleSession();
      router.push(`/results/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sample");
      setBusy(false);
    }
  }

  async function onDeleteConfirmed(sessionId: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteSession(sessionId);
      setConfirmDeleteId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const pendingDelete = sessions.find((s) => s.id === confirmDeleteId);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="brand">
            Flock <span>·</span>
          </div>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            Processing tracker — one number per bird
          </div>
        </div>
        <Link href="/setup" className="btn btn-primary">
          New session
        </Link>
      </header>

      <main
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "1.5rem 1.25rem 3rem",
        }}
      >
        <section className="animate-in" style={{ marginBottom: "1.25rem" }}>
          <h1
            style={{
              fontSize: "1.75rem",
              letterSpacing: "-0.03em",
              margin: "0 0 0.35rem",
            }}
          >
            Sessions
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Offline-first capture. Metrics derive from dressed weights.
          </p>
        </section>

        {error && (
          <p
            role="alert"
            style={{ color: "var(--danger)", marginBottom: "1rem" }}
          >
            {error}
          </p>
        )}

        {confirmDeleteId && pendingDelete && (
          <div
            className="panel confirm-panel animate-in"
            role="alertdialog"
            aria-labelledby="delete-session-title"
            style={{ marginBottom: "1rem" }}
          >
            <h2
              id="delete-session-title"
              style={{ margin: "0 0 0.4rem", fontSize: "1.15rem" }}
            >
              Delete this session?
            </h2>
            <p className="muted" style={{ margin: "0 0 1rem" }}>
              <strong style={{ color: "var(--ink)" }}>
                {pendingDelete.flockName}
              </strong>{" "}
              · {pendingDelete.metrics.birdsProcessed} bird
              {pendingDelete.metrics.birdsProcessed === 1 ? "" : "s"} logged.
              This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => setConfirmDeleteId(null)}
              >
                Keep session
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() => void onDeleteConfirmed(confirmDeleteId)}
              >
                {busy ? "Deleting…" : "Delete session"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="muted">Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <div className="panel animate-in delay-1 empty-state">
            <h2
              style={{
                margin: "0 0 0.4rem",
                fontSize: "1.2rem",
                letterSpacing: "-0.02em",
              }}
            >
              Ready for processing day
            </h2>
            <p className="muted" style={{ margin: "0 0 1.25rem" }}>
              Enter flock costs once, then log one dressed weight per bird on the
              line. Or load the Freedom Rangers sample to see a finished results
              screen.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link href="/setup" className="btn btn-primary">
                Start new session
              </Link>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => void onLoadSample()}
              >
                {busy ? "Loading sample…" : "Load sample"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              className="animate-in delay-1"
              style={{
                display: "flex",
                gap: "0.75rem",
                marginBottom: "1rem",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => void onLoadSample()}
              >
                {busy ? "Loading sample…" : "Load sample"}
              </button>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                {sessions.length} session{sessions.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul
              className="animate-in delay-2"
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gap: "0.75rem",
              }}
            >
              {sessions.map((s) => {
                const capturing = s.status === "capturing";
                const href = capturing
                  ? `/capture/${s.id}`
                  : `/results/${s.id}`;
                return (
                  <li key={s.id}>
                    <div className="panel session-row">
                      <Link href={href} className="session-row-link">
                        <div className="session-row-main">
                          <div className="session-row-title">
                            <span className="session-name">{s.flockName}</span>
                            <span
                              className={`status-pill ${capturing ? "open" : "done"}`}
                            >
                              {capturing ? "Open" : "Done"}
                            </span>
                          </div>
                          <div className="muted session-meta">
                            {formatSessionDate(s.processedAt)}
                            {capturing
                              ? " · tap to resume capture"
                              : " · view results"}
                          </div>
                        </div>
                        <div className="session-kpis">
                          <div>
                            <div className="session-kpi-label">Birds</div>
                            <div className="session-kpi-value">
                              {s.metrics.birdsSaleable}/{s.birdsStarted}
                            </div>
                          </div>
                          <div>
                            <div className="session-kpi-label">Cost / lb</div>
                            <div className="session-kpi-value session-kpi-accent">
                              {s.metrics.costPerLb != null
                                ? formatMoney(s.metrics.costPerLb)
                                : "—"}
                            </div>
                          </div>
                          <div>
                            <div className="session-kpi-label">Margin</div>
                            <div className="session-kpi-value">
                              {s.metrics.marginPct != null
                                ? `${formatNum(s.metrics.marginPct * 100, 0)}%`
                                : "—"}
                            </div>
                          </div>
                        </div>
                      </Link>
                      <div className="session-actions">
                        <Link
                          href={`/edit/${s.id}`}
                          className="btn btn-ghost session-action-btn"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="btn btn-ghost session-action-btn"
                          disabled={busy}
                          onClick={() => setConfirmDeleteId(s.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
