# Offline-First PWA Upgrade Plan

Goal: turn Church Companion into a true offline-first PWA. Zero UI/UX changes. Existing routes, auth, admin flows, and Supabase data model stay intact. We add a local-first data layer, a sync engine, an upload queue, and tighten the service worker.

## Scope check before we start

A few of the asks don't map 1:1 to this project, and I want your call before I build them:

1. **Backend sync endpoints (`/sync/push`, `/sync/pull`) + PostgreSQL schema.** This app talks directly to Supabase (Lovable Cloud) via RLS. We don't have a custom Node/Express server. Two options:
   - **A. Supabase-native sync** (recommended): implement Push/Pull as TanStack server functions backed by Supabase, using existing tables + new `updated_at`/`is_deleted` columns and a Postgres function for delta pull. Same semantics (LWW, soft delete, batched push), no extra infra.
   - **B. Add Node/Express service** in front of Supabase. More code, another deploy target, no real benefit here.
2. **All data in IndexedDB + intercept every API call.** Today: songs/sections/today's-sets are read-mostly for end users; only admins write. I'll make *all reads* IndexedDB-first with background revalidate, but I'll only queue *admin writes* offline (songs/sections/today). Auth, role checks, and notifications stay online-only — queueing those offline is unsafe. Tell me if you want end-user writes too (e.g. bookmarks already local; favorites; "request admin" form).
3. **No UI changes** — I'll keep every screen pixel-identical. The new connectivity/sync status will surface only in the existing Diagnostics page (no new chrome). If you want a small status pill somewhere, say where.

Assuming **1A** and **2 as scoped above** unless you say otherwise.

## Architecture

```text
UI (unchanged)
  │
  ▼
Repositories  ──►  Dexie (IndexedDB)  ◄── Sync Engine ──► Supabase (RLS)
  │                     ▲                     ▲
  ▼                     │                     │
React Query        Upload Queue          Workbox SW
                   (Blobs + jobs)        (shell + API cache)
```

Folders:
```
src/offline/
  db.ts                 // Dexie schema + migrations
  repos/                // songs, sections, books, today, bookmarks, uploads
  sync/
    engine.ts           // orchestrator (push → pull → revalidate)
    push.ts  pull.ts    // batched delta sync
    conflict.ts         // LWW
  uploads/
    queue.ts            // job store, retry, backoff, resume
    processor.ts        // sequential worker, Background Sync hook
  hooks/                // useOffline, useConnectivity, useSync,
                        // useUploadQueue, useBackgroundSync
  net/
    fetch-interceptor.ts
    online.ts
  index.ts
src/lib/sync.functions.ts  // server fns: sync.push / sync.pull
```

## Phased delivery

### Phase 1 — Local-first data layer (no behavior change)
- Add `dexie` + `dexie-react-hooks`.
- `db.ts` tables: `books`, `book_sections`, `songs`, `today_sets`, `today_items`, `bookmarks`, `meta` (last-sync cursors), `outbox` (pending writes), `uploads` (file jobs + Blobs). Every row: `id` (uuid), `created_at`, `updated_at`, `is_dirty`, `is_deleted`, plus per-table indexes (`number`, `book_id`, `for_date`, etc.).
- Migrate existing `idb-keyval` snapshots → Dexie on first load; keep `localStorage` only for prefs and bookmark IDs that already live there.
- Repos expose `list/get/upsert/remove` that read Dexie first, return instantly, and trigger a background pull.
- Wire existing TanStack Query `queryFn`s through repos. `initialData` comes from Dexie — same `useQuery` call sites, no component changes.

### Phase 2 — Sync engine (Supabase-native)
- Migration: add `updated_at timestamptz default now()` + `is_deleted bool default false` + update triggers on `songs`, `book_sections`, `today_song_sets`, `today_song_items` (books already static). Index `(updated_at)`.
- Postgres function `sync_pull(since timestamptz)` returns changed rows per table since cursor (RLS-respecting, `SECURITY INVOKER`).
- Server fns in `src/lib/sync.functions.ts`:
  - `syncPull({ since })` → calls `sync_pull`, returns `{ rows, server_time }`.
  - `syncPush({ ops })` → validates with Zod, applies upserts/soft-deletes via authenticated supabase client, returns per-op `{ id, status, server_updated_at }`. Admin-only ops gated by `has_role`.
- Engine loop:
  1. Drain `outbox` in batches of 100 → `syncPush` → on success mark clean, store server `updated_at`.
  2. `syncPull(since=meta.lastSyncedAt)` → upsert into Dexie using LWW (`server.updated_at >= local.updated_at` wins; deletions tombstoned).
  3. Update `meta.lastSyncedAt = server_time`.
- Triggers: online event, app focus, route change to data-heavy pages, periodic 5-min timer, Background Sync tag `cc-sync` when supported.

### Phase 3 — Upload queue for admin file ingest
- New table `uploads`: `{ id, kind: 'songs-import'|'pdf'|'docx'|'txt', blob, filename, mime, status, retries, progress, created_at, updated_at, error }`.
- Wrap existing admin upload flow: enqueue Blob immediately, return success to UI, processor uploads sequentially with exponential backoff (1s → 30s, cap 5 retries), resumes on `online` / Background Sync.
- Existing parsing (`mammoth`, `pdfjs-dist`) happens locally before push; parsed payload goes into `outbox`, original Blob optionally stored in Supabase Storage if you want — say the word.

### Phase 4 — Service worker hardening (Workbox via existing `vite-plugin-pwa`)
- Keep current guarded `pwa-register.ts` (no SW in preview/iframe).
- Strategies:
  - **CacheFirst** — `/assets/*`, fonts, icons, manifest (already in place; expand globs).
  - **NetworkFirst w/ cache fallback** — HTML navigations and Supabase REST `GET`s (4s timeout, cache 30d).
  - **StaleWhileRevalidate** — book/song listing endpoints (tag `supabase-lists`).
  - **NetworkOnly + BackgroundSyncPlugin** — Supabase `POST/PATCH/DELETE` for songs/sections/today, queue name `cc-writes`, 24h retention. Engine still owns LWW; SW queue is a belt-and-suspenders for raw fetches.
- Precache app shell via `globPatterns` (already done) + add manifest.webmanifest.

### Phase 5 — Hooks & status surface
- `useOnline()`, `useConnectivity()` (RTT + saveData), `useSync()` (`idle|syncing|error`, last-synced, pending count), `useUploadQueue()` (jobs + progress), `useBackgroundSync()` (capability + tag state).
- Surface only in `/diagnostics` panel; no other UI changes.

### Phase 6 — Manifest & installability
- Audit `public/manifest.webmanifest`: add `id`, `categories`, `screenshots` (narrow + wide), `shortcuts` (Today's Songs, Song Book, Bookmarks), `display_override: ["standalone","minimal-ui"]`. Verify 192/512 maskable icons exist. Adds Windows/macOS/Linux/Chrome/Edge install support; iOS keeps its existing apple-touch-icon path.

## Cross-cutting

- **Race conditions**: per-op `id` (uuid) idempotency; push results keyed by id; Dexie transactions for outbox drain.
- **Auth refresh**: existing `attachSupabaseAuth` middleware already refreshes; engine retries 401 once after `supabase.auth.refreshSession()`.
- **Logging**: route through existing `src/lib/diagnostics.ts`.
- **Migration safety**: SW update keeps Dexie + Cache Storage; only the kill-switch path (already in `pwa-register.ts`) clears app caches.
- **Browser support**: Chromium/Edge/Firefox full; Safari — Dexie + SW work, Background Sync falls back to `online` event + focus trigger.

## Testing

- Unit: repos (CRUD + dirty marking), conflict resolver, outbox drainer, backoff.
- Integration: simulate offline with Playwright (`context.setOffline(true)`), enqueue admin upload, go online, assert sync runs and rows land in Supabase.
- Manual checklist on `/diagnostics`: storage quota, outbox size, last sync, upload queue.

## What I will NOT change

- Any route, component, layout, styling, copy, or navigation.
- Auth flow, role checks, RLS policies, Supabase client wiring.
- OneSignal, notifications, diagnostics UI (just adds rows).
- `localStorage` bookmark format (migrated in place, same shape).

## Confirm before I build

1. Go with **Supabase-native sync (1A)**? (Yes/No)
2. Scope writes to **admin-only as listed**, or include end-user writes (which ones)?
3. Keep status surface to **Diagnostics page only**, or add a tiny indicator (where)?

Once you confirm, I'll ship in the phase order above, with each phase verified before moving on.
