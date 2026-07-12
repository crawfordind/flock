"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createSession, listFlocks } from "@/lib/db/sessions";
import type { Flock } from "@/lib/types";

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

const initial: FormState = {
  flockName: "",
  breed: "",
  birdsStarted: "50",
  chickCost: "",
  feedLbs: "",
  feedCost: "",
  suppliesCost: "",
  targetPricePerLb: "6.00",
  avgLiveWeight: "",
  notes: "",
};

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initial);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [selectedFlockId, setSelectedFlockId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listFlocks()
      .then(setFlocks)
      .catch(() => setFlocks([]));
  }, []);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
    setFieldError(null);
  }

  function onSelectFlock(flockId: string) {
    setSelectedFlockId(flockId);
    setError(null);
    setFieldError(null);
    if (!flockId) return;
    const flock = flocks.find((f) => f.id === flockId);
    if (!flock) return;
    setForm((f) => ({
      ...f,
      flockName: flock.name,
      breed: flock.breed ?? "",
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    if (!form.flockName.trim()) {
      setFieldError("flockName");
      setError("Give this flock a name so you can find the session later.");
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
      const session = await createSession({
        flockId: selectedFlockId || undefined,
        flockName: form.flockName,
        breed: form.breed || undefined,
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
      router.push(`/capture/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start session");
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <Link href="/" className="brand">
            Flock <span>·</span>
          </Link>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            Session setup — enter once
          </div>
        </div>
        <Link href="/" className="btn btn-ghost">
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
          New processing session
        </h1>
        <p className="muted animate-in delay-1" style={{ marginTop: 0 }}>
          Batch costs and flock info once. On the line you only enter dressed
          weight.
        </p>

        <form
          className="panel animate-in delay-2"
          onSubmit={(e) => void onSubmit(e)}
          style={{ marginTop: "1.25rem" }}
          noValidate
        >
          <fieldset className="form-section">
            <legend>Flock</legend>
            {flocks.length > 0 && (
              <div className="field" style={{ marginBottom: "1rem" }}>
                <label htmlFor="existingFlock">Use existing flock</label>
                <select
                  id="existingFlock"
                  value={selectedFlockId}
                  onChange={(e) => onSelectFlock(e.target.value)}
                >
                  <option value="">New flock</option>
                  {flocks.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                      {f.breed ? ` (${f.breed})` : ""}
                    </option>
                  ))}
                </select>
                <p className="field-hint">
                  Reuse a flock you&apos;ve processed before, or create a new
                  one below.
                </p>
              </div>
            )}
            <div className="grid-form two">
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="flockName">Flock name</label>
                <input
                  id="flockName"
                  value={form.flockName}
                  onChange={(e) => set("flockName", e.target.value)}
                  placeholder="e.g. Freedom Rangers — Spring"
                  autoFocus
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
                  placeholder="Freedom Ranger"
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
            <p className="field-hint" style={{ marginTop: 0 }}>
              Totals for this flock — used for cost/lb and break-even.
            </p>
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
                  placeholder="130"
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
                  placeholder="60"
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
                  placeholder="900"
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
                  placeholder="290"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Pricing & yield</legend>
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
                <p className="field-hint">
                  Sale price you plan to charge — drives margin on results.
                </p>
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
                <p className="field-hint">
                  Optional. Used for FCR if you skip live samples on the line.
                  Leave blank if you&apos;ll weigh a few birds live during
                  capture.
                </p>
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="notes">Session notes (optional)</label>
                <input
                  id="notes"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Weather, crew, anything to remember"
                  autoComplete="off"
                />
              </div>
            </div>
          </fieldset>

          {error && (
            <p
              role="alert"
              style={{ color: "var(--danger)", marginTop: "1rem", marginBottom: 0 }}
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
              {busy ? "Starting…" : "Start capture"}
            </button>
            <Link href="/" className="btn btn-ghost">
              Back
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
