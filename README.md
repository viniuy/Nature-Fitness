# Nature Fitness

An offline-first gym log for phone and desktop: sets, reps, weight, body stats
and Evolt 360 scans. It installs from the browser as an app and works with no
signal. When online, it syncs between devices through Supabase.

## How it works

- **Static Next.js export + service worker.** Every page and asset is cached on
  first visit (`scripts/build-sw.mjs` writes `out/sw.js`), so the app opens offline.
- **Local database first.** Everything is saved to IndexedDB (Dexie) on the
  device. Edits are queued in an outbox and pushed when there is a connection.
- **Sync.** `src/lib/sync.ts` pushes queued edits with the `gym_push` RPC and
  pulls rows newer than the last pull from `gym_programs`, `gym_sessions` and
  `gym_body_stats`. The newest edit (`updated_at`, ms) wins. Deletes are soft.
- **Evolt import.** `src/lib/evolt/` finds the white value boxes on a screenshot
  of the Evolt Active "Result Sheet", reads each box with Tesseract (served from
  `/ocr`, so it works offline) and maps boxes to fields by their place in the
  grid. Values that contradict their own range ("Optimal" but outside it) are
  re-read, then flagged on the review screen.
- **Program.** First run loads the Gym Log 6-day split from
  `src/lib/seed-program.json`; edit it on the Program page.

## Setup

```bash
npm install
cp .env.example .env.local   # Supabase URL and publishable key
npm run dev
```

`npm run build` produces `out/`, which any static host can serve (Vercel works
with no extra settings). Apply `supabase/migrations/0001_gym_tables.sql` to the
Supabase project once.

Sign-in uses the same Supabase account as the dashboard: email, password, then
the 6-digit authenticator code (the tables require MFA, like the dashboard's).

## Editing the data directly (for the dashboard assistant)

The tables are designed to be read and edited outside the app:

- `gym_sessions` (one row per date and program day), `gym_body_stats`,
  `gym_programs`. Column comments describe the jsonb shapes.
- `gym_sets` is a read-only view with one row per logged set
  (date, exercise, set_no, weight, reps), handy for questions like
  "best squat this month".
- Never hard-delete rows: set `deleted = true`.
- A plain `UPDATE` is enough. A trigger bumps `updated_at` and `server_ts`, so
  the apps pull the change on their next sync.

## Scripts

- `npm run test:evolt -- path/to/screenshot.png` runs the Evolt reader in Node.
  Keep scan screenshots out of the repo; they are personal data.
- `node scripts/render-icons.cjs` re-renders the app icons from `assets/logo.svg`.
