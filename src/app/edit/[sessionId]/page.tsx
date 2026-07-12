"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getSession, updateSession } from "@/lib/db/sessions";

type FormState = {
  flockName: string;
  breed: string;
  birdsStarted: string;
  chickCost: string;
  feedLbs: string;
  feedCost: string;
  suppliesCost: string;
  targetPricePerLb: string;
  avgLiveWeight: string;
  notes: string;
};

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function EditSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const router = useRouter();

  const [form, setForm] = useState<FormState | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSession(sessionId);
      if (!data) {
        setError("Session not found");
        return;
      }
      setStatus(data.session.status);
      setForm({
        flockName: data.session.flockName,
        breed: data.flock?.breed ?? "",
        birdsStarted: String(data.session.birdsStarted),
        chickCost: String(data.session.chickCost),
        feedLbs: String(data.session.feedLbs),
        feedCost: String(data.session.feedCost),
        suppliesCost: String(data.session.suppliesCost),
        targetPricePerLb: String(data.session.targetPricePerLb),
        avgLiveWeight:
          data.session.avgLiveWeight != null
            ? String(data.session.avgLiveWeight)
            : "",
        notes: data.session.notes ?? "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setError(null);
    setFieldError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setFieldError(null);

    if (!form.flockName.trim()) {
      setFieldError("flockName");
      setError("Flock name is required.");
      return;
    }
    const birdsStarted = Math.floor(num(form.birdsStarted));
    if (birdsStarted < 1) {
      setFieldError("birdsStarted");
      setError("Birds started must be at least 1.");
      return;
    }
    if (form.targetPricePerLb.trim() && num(form.targetPricePerLb) <= 0) {
      setFieldError("targetPricePerLb");
      setError("Target price must be greater than zero.");
      return;
    }

    setBusy(true);
    try {
      await updateSession(sessionId, {
        flockName: form.flockName,
        breed: form.breed.trim() || null,
        birdsStarted,
        chickCost: num(form.chickCost),
        feedLbs: num(form.feedLbs),
        feedCost: num(form.feedCost),
        suppliesCost: num(form.suppliesCost),
        targetPricePerLb: num(form.targetPricePerLb),
        avgLiveWeight: form.avgLiveWeight.trim()
          ? num(form.avgLiveWeight)
          : null,
        notes: form.notes.trim() || null,
      });
      const dest =
        status === "capturing"
          ? `/capture/${sessionId}`
          : `/results/${sessionId}`;
      router.push(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setBusy(false);
    }
  }

  const backHref =
    status === "capturing" ? `/capture/${sessionId}` : `/results/${sessionId}`;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <Link href="/" className="brand">
            Flock <span>·</span>
          </Link>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            Edit session — costs & flock
          </div>
        </div>
        <Link href={form ? backHref : "/"} className="btn btn-ghost">
          Cancel
        </Link>
      </header>

      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "1.5rem 1.25rem 3rem",
        }}
      >
        <h1
          className="animate-in"
          style={{
            fontSize: "1.75rem",
            letterSpacing: "-0.03em",
            margin: "0 0 0.35rem",
          }}
        >
          Edit session
        </h1>
        <p className="muted animate-in delay-1" style={{ marginTop: 0 }}>
          Fix flock name, birds started, or batch costs. Metrics recalculate from
          logged weights.
        </p>

        {loading && <p className="muted">Loading…</p>}

        {error && !form && (
          <p role="alert" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}

        {form && (
          <form
            className="panel animate-in delay-2"
            onSubmit={(e) => void onSubmit(e)}
            style={{ marginTop: "1.25rem" }}
            noValidate
          >
            <fieldset className="form-section">
              <legend>Flock</legend>
              <div className="grid-form two">
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="flockName">Flock name</label>
                  <input
                    id="flockName"
                    value={form.flockName}
                    onChange={(e) => set("flockName", e.target.value)}
                    autoComplete="off"
                    aria-invalid={fieldError === "flockName"}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="breed">Breed (optional)</label>
                  <input
                    id="breed"
                    value={form.breed}
                    onChange={(e) => set("breed", e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="field">
                  <label htmlFor="birdsStarted">Birds started</label>
                  <input
                    id="birdsStarted"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    step="1"
                    min="1"
                    value={form.birdsStarted}
                    onChange={(e) => set("birdsStarted", e.target.value)}
                    aria-invalid={fieldError === "birdsStarted"}
                    required
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>Batch costs</legend>
              <div className="grid-form two">
                <div className="field">
                  <label htmlFor="chickCost">Chick cost ($)</label>
                  <input
                    id="chickCost"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={form.chickCost}
                    onChange={(e) => set("chickCost", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="suppliesCost">Supplies cost ($)</label>
                  <input
                    id="suppliesCost"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={form.suppliesCost}
                    onChange={(e) => set("suppliesCost", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="feedLbs">Feed total (lb)</label>
                  <input
                    id="feedLbs"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    value={form.feedLbs}
                    onChange={(e) => set("feedLbs", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="feedCost">Feed cost ($)</label>
                  <input
                    id="feedCost"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={form.feedCost}
                    onChange={(e) => set("feedCost", e.target.value)}
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>Pricing & notes</legend>
              <div className="grid-form two">
                <div className="field">
                  <label htmlFor="targetPricePerLb">Target price ($/lb)</label>
                  <input
                    id="targetPricePerLb"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={form.targetPricePerLb}
                    onChange={(e) => set("targetPricePerLb", e.target.value)}
                    aria-invalid={fieldError === "targetPricePerLb"}
                  />
                </div>
                <div className="field">
                  <label htmlFor="avgLiveWeight">Avg live weight (lb)</label>
                  <input
                    id="avgLiveWeight"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={form.avgLiveWeight}
                    onChange={(e) => set("avgLiveWeight", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="notes">Session notes</label>
                  <input
                    id="notes"
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    placeholder="Optional"
                    autoComplete="off"
                  />
                </div>
              </div>
            </fieldset>

            {error && (
              <p
                role="alert"
                style={{
                  color: "var(--danger)",
                  marginTop: "1rem",
                  marginBottom: 0,
                }}
              >
                {error}
              </p>
            )}

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                marginTop: "1.5rem",
                flexWrap: "wrap",
              }}
            >
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
              <Link href={backHref} className="btn btn-ghost">
                Cancel
              </Link>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
