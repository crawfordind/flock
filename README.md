# Flock

Capture-first poultry processing tracker (Module 1 of Run-a-Muck).

**One-line bet:** During processing, hands are wet/cold/bloody and moving fast. Enter one number per bird; enter everything else once. Derive every metric.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

No cloud services are required for the local happy path (setup → capture → results, Load sample, PDF export).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm test` | Metrics unit tests (worked example) |
| `npm run lint` | ESLint |

## What you can do

1. **Home** — session list, **New session**, **Load sample**, edit / delete with confirmation
2. **Setup** — new or existing flock, birds started, costs, target $/lb, optional avg live / notes
3. **Capture** (dark UI) — numpad, Log bird, Condemned, Live sample, **Undo last**, Finish
4. **Edit** — update flock name/breed, costs, notes (metrics recalculate)
5. **Results** — KPIs, reopen capture, edit costs, delete session, PDF + email

**Load sample** creates the Freedom Rangers worked example (50 birds, 48 saleable, ~247.6 lb dressed, ~$1.94/lb, ~68% margin, FCR ~2.6).

## Stack

- Next.js 15 App Router + TypeScript + Tailwind CSS
- Dexie / IndexedDB (offline-first)
- Optional Turso/libSQL via `POST /api/sync`
- jsPDF (client PDF download)
- Nodemailer (email route; stubs if SMTP unset)

## Environment variables

Copy `.env.example` to `.env.local` if you want cloud sync or real email.

| Variable | Purpose |
|----------|---------|
| `TURSO_DATABASE_URL` | libSQL/Turso URL — enables sync upserts |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Email delivery |
| `SMTP_SECURE` | `true` for TLS port 465 |

Without Turso: sync endpoint returns `{ cloudEnabled: false }` and local data stays in IndexedDB.

Without SMTP: email endpoint returns a stub success with a text preview.

## Data model (MVP)

Local Dexie tables mirror the PRD: `users`, `flocks`, `feedLogs`, `sessions`, `birds`, `media`.

Session-level cost fields (`chickCost`, `feedLbs`, `feedCost`, `suppliesCost`, optional `avgLiveWeight`) are stored on `processing_sessions` for offline simplicity. UUID v7 IDs + `clientId` / `updatedAt` support LWW sync.

## Metrics

Pure functions in `src/lib/metrics/calculate.ts`. Verified against the PRD worked example via `npm test`.

## Out of scope (Phase 2+)

Multi-user roles, feed grow-out timeline, OCR, shared cost ledger, layer/egg tracking, labels, Cloudflare R2 PDF storage.

## Contributing

Contributions, bug reports, and ideas are welcome — please open an issue or a
pull request. If you're planning a larger change, open an issue first so we can
discuss the approach.

## License

Released under the [MIT License](LICENSE). © 2026 Daniel Crawford.
