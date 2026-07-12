"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addBird,
  finishSession,
  getRunningTally,
  getSession,
  undoLastBird,
} from "@/lib/db/sessions";
import type { ProcessingSession } from "@/lib/types";

function parseWeight(raw: string): number | null {
  if (!raw || raw === ".") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function vibrate(ms = 12) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(ms);
    }
  } catch {
    /* ignore — not all browsers allow it */
  }
}

export default function CapturePage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const router = useRouter();

  const [session, setSession] = useState<ProcessingSession | null>(null);
  const [tally, setTally] = useState({ count: 0, saleable: 0, totalDressedLb: 0 });
  const [input, setInput] = useState("");
  const [condemned, setCondemned] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [liveBuffer, setLiveBuffer] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const logging = useRef(false);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const data = await getSession(sessionId);
    if (!data) {
      setError("Session not found");
      return;
    }
    setSession(data.session);
    setTally(await getRunningTally(sessionId));
  }, [sessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    };
  }, []);

  function showConfirm(message: string, ok = true) {
    setFlash(message);
    if (ok) {
      setPulse(true);
      vibrate(14);
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      pulseTimer.current = setTimeout(() => setPulse(false), 420);
    }
  }

  function press(key: string) {
    setFlash(null);
    setConfirmFinish(false);
    if (key === "C") {
      setInput("");
      return;
    }
    if (key === "⌫") {
      setInput((v) => v.slice(0, -1));
      return;
    }
    if (key === ".") {
      setInput((v) => (v.includes(".") ? v : v === "" ? "0." : `${v}.`));
      return;
    }
    setInput((v) => {
      if (v.includes(".")) {
        const [, dec = ""] = v.split(".");
        if (dec.length >= 2) return v;
      }
      if (v.replace(".", "").length >= 5) return v;
      return `${v}${key}`;
    });
  }

  async function logBird() {
    if (logging.current || busy) return;
    const weight = parseWeight(input);
    if (weight == null) {
      showConfirm("Enter weight", false);
      vibrate(30);
      return;
    }

    logging.current = true;
    setBusy(true);
    setFlash(null);
    setConfirmFinish(false);

    try {
      if (liveMode && liveBuffer == null) {
        setLiveBuffer(weight);
        setInput("");
        showConfirm("Live saved — enter dressed");
        return;
      }

      const liveWeightLb = liveMode ? liveBuffer : null;
      const wasCondemned = condemned;
      await addBird({
        sessionId,
        dressedWeightLb: weight,
        liveWeightLb,
        condemned,
      });

      setInput("");
      setLiveBuffer(null);
      if (wasCondemned) setCondemned(false);
      showConfirm(
        wasCondemned
          ? `Condemned · ${weight.toFixed(2)} lb`
          : `Logged · ${weight.toFixed(2)} lb`
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Log failed");
    } finally {
      logging.current = false;
      setBusy(false);
    }
  }

  async function onUndo() {
    if (busy || tally.count === 0) return;
    setBusy(true);
    setConfirmFinish(false);
    setError(null);
    try {
      const removed = await undoLastBird(sessionId);
      if (!removed) {
        showConfirm("Nothing to undo", false);
        return;
      }
      setLiveBuffer(null);
      showConfirm(
        removed.condemned
          ? `Undid condemned · ${removed.dressedWeightLb.toFixed(2)} lb`
          : `Undid · ${removed.dressedWeightLb.toFixed(2)} lb`
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Undo failed");
    } finally {
      setBusy(false);
    }
  }

  async function onFinishConfirmed() {
    setBusy(true);
    setConfirmFinish(false);
    try {
      await finishSession(sessionId);
      router.push(`/results/${sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish");
      setBusy(false);
    }
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

  const prompt =
    liveMode && liveBuffer == null
      ? "Live weight"
      : liveMode
        ? "Dressed weight"
        : condemned
          ? "Condemned weight"
          : "Dressed weight";

  return (
    <div className={`capture-root${pulse ? " capture-pulse" : ""}`}>
      <div className="capture-top">
        <div>
          <div style={{ fontWeight: 700 }}>{session?.flockName ?? "Capture"}</div>
          <div className="tally">
            Bird{" "}
            <strong>
              {tally.count + 1}
              {session ? ` / ${session.birdsStarted}` : ""}
            </strong>
            {" · "}
            {tally.saleable} saleable · {tally.totalDressedLb.toFixed(1)} lb
          </div>
        </div>
        <div className="capture-top-links">
          <Link href={`/edit/${sessionId}`} className="capture-top-link">
            Edit
          </Link>
          <Link href="/" className="capture-top-link">
            Home
          </Link>
        </div>
      </div>

      <div className="readout">
        <div className="unit">{prompt}</div>
        <div className={`number${pulse ? " number-flash" : ""}`}>
          {input || "0"}
        </div>
        <div
          style={{
            marginTop: "0.5rem",
            color: flash ? "var(--cap-accent)" : "transparent",
            fontWeight: 600,
            minHeight: "1.25rem",
            fontSize: "1rem",
          }}
          aria-live="polite"
        >
          {flash || "\u00a0"}
        </div>
        {error && (
          <div style={{ marginTop: "0.5rem", color: "var(--cap-danger)" }}>
            {error}
          </div>
        )}
        {liveMode && liveBuffer != null && (
          <div style={{ marginTop: "0.35rem", color: "var(--cap-warn)" }}>
            Live: {liveBuffer.toFixed(2)} lb → now dressed
          </div>
        )}
      </div>

      <div className="flags">
        <button
          type="button"
          className={`flag-btn ${condemned ? "on-condemned" : ""}`}
          aria-label="Condemned"
          aria-pressed={condemned}
          onClick={() => {
            setCondemned((v) => !v);
            if (!condemned) setLiveMode(false);
            setConfirmFinish(false);
          }}
        >
          <span className="flag-title">Condemned</span>
          <span className="flag-hint">Not for sale</span>
        </button>
        <button
          type="button"
          className={`flag-btn ${liveMode ? "on-live" : ""}`}
          aria-label="Live sample"
          aria-pressed={liveMode}
          onClick={() => {
            setLiveMode((v) => {
              if (v) setLiveBuffer(null);
              return !v;
            });
            if (!liveMode) setCondemned(false);
            setConfirmFinish(false);
          }}
        >
          <span className="flag-title">Live sample</span>
          <span className="flag-hint">Live, then dressed</span>
        </button>
      </div>

      <div className="numpad">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            className="num-key"
            aria-label={k === "⌫" ? "Backspace" : k === "." ? "Decimal" : k}
            onClick={() => press(k)}
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          className="num-key num-clear"
          aria-label="Clear weight"
          onClick={() => press("C")}
        >
          Clear
        </button>
      </div>

      {confirmFinish ? (
        <div className="capture-confirm" role="alertdialog" aria-labelledby="finish-title">
          <div id="finish-title" className="capture-confirm-title">
            Finish this session?
          </div>
          <p className="capture-confirm-body">
            {tally.count} bird{tally.count === 1 ? "" : "s"} logged ·{" "}
            {tally.saleable} saleable. You can still open results afterward, but
            capture closes.
          </p>
          <div className="capture-confirm-actions">
            <button
              type="button"
              className="cap-btn finish"
              disabled={busy}
              onClick={() => setConfirmFinish(false)}
            >
              Keep capturing
            </button>
            <button
              type="button"
              className="cap-btn log"
              disabled={busy}
              onClick={() => void onFinishConfirmed()}
            >
              Finish session
            </button>
          </div>
        </div>
      ) : (
        <div className="capture-actions">
          <button
            type="button"
            className="cap-btn undo"
            disabled={busy || tally.count === 0}
            onClick={() => void onUndo()}
            aria-label="Undo last bird"
            title="Remove the last logged weight"
          >
            Undo last
          </button>
          <button
            type="button"
            className="cap-btn finish"
            disabled={busy || tally.count === 0}
            onClick={() => setConfirmFinish(true)}
          >
            Finish
          </button>
          <button
            type="button"
            className="cap-btn log"
            disabled={busy}
            onClick={() => void logBird()}
          >
            {liveMode && liveBuffer == null ? "Save live" : "Log bird"}
          </button>
        </div>
      )}
    </div>
  );
}
