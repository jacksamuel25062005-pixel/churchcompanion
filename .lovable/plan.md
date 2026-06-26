## Church Companion — v1 Build Plan (Installable PWA)

A mobile-first installable web app (PWA) for a Hindi-speaking church community. Reads all five books without login, syncs Today's Songs in real time, and supports a full admin workflow with content uploads.

> Note: This is a Lovable web app, not a React Native APK. It installs to Android home screens via "Add to Home Screen" and works offline-friendly. Push notifications via OneSignal are deferred (web push needs a separate setup; we'll wire it in a follow-up if you want it).

---

### 1. Stack & infra

- TanStack Start + React 19 + Tailwind v4 + shadcn/ui (already scaffolded).
- Lovable Cloud (Supabase under the hood) for auth, DB, storage, realtime, RLS.
- Mobile-first design, smooth iOS-style transitions, 390px viewport as primary target.
- PWA manifest + icons so it installs on Android. No service worker in v1 (keeps previews stable); we add offline caching in a follow-up if needed.
- i18n with a lightweight EN/HI dictionary (no extra library), stored preference in `localStorage`.

### 2. Design system

- 5 per-book accent themes (Song Book, Lord's Supper, Ashaya Rabbani, Prata Kaal & Sayan Kalin, Almanac) — each book route swaps a CSS custom property.
- Global user-selectable accent override + light/dark mode + font-size scale (S/M/L/XL), all in `localStorage`.
- Devanagari-capable font for Hindi (Noto Sans Devanagari) + clean sans for English (Inter), via `@fontsource`.

### 3. Routes

```
/                       Splash → home (logo 1.5s, then Today's Songs + 5 book cards)
/books/song-book        List + search (number, title, lyrics)
/books/song-book/$id    Reader (favorite, share, copy, continue reading)
/books/lords-supper     Sectioned reader
/books/ashaya-rabbani   Sectioned reader
/books/prata-sayan      Sectioned reader
/books/almanac          English content, date-indexed
/search                 Global full-text search
/bookmarks              Local bookmarks list
/settings               Font size, theme, accent, language
/admin                  Tabbed: Super Admin login | Admin login/request
/_authenticated/admin/dashboard   Approved-admin & super-admin only
/_authenticated/admin/upload      PDF / DOCX / TXT → parse → review → publish
/_authenticated/admin/today       Pick today's songs (realtime publish)
/_authenticated/admin/requests    Super admin + admins approve requests
/auth                   Lovable-managed auth page (used by admin login)
```

Auth uses the integration-managed `_authenticated` layout. Regular users never hit auth.

### 4. Database (Lovable Cloud migration)

Tables, all with explicit GRANTs and RLS:

- `profiles` (id → auth.users, display_name, created_at)
- `user_roles` (user_id, role enum: `super_admin` | `admin`) + `has_role()` security-definer fn
- `books` (slug, title_en, title_hi, accent_color, order)
- `book_sections` (book_id, number, title_hi, title_en, body_hi, body_en, search tsvector)
- `songs` (number, title_hi, lyrics_hi, lyrics_en?, tags, search tsvector)
- `today_song_sets` (date, published_by, published_at)
- `today_song_items` (set_id, song_id, position)
- `admin_requests` (user_id, reason, status, decided_by, decided_at)
- `audit_logs` (actor_id, action, target, payload, created_at)
- `app_settings` (key, value jsonb)  — admin-tunable

Public `TO anon` SELECT on books, book_sections, songs, today_song_sets/items (current date only).  
Writes restricted via `has_role()`. Admin requests insertable by any authenticated user; status changes restricted to admins/super_admin. Today's set auto-filtered to current date in queries; no cron needed.

### 5. Reading experience

- Server-side Postgres full-text search across `songs` and `book_sections` via a public `search_content()` SQL function (anon-callable).
- Bookmarks + "continue reading" + favorites stored in `localStorage` (per spec — no cross-device sync).
- Share uses Web Share API with clipboard fallback; copy uses Clipboard API.
- Font-size, theme, accent, language stored in `localStorage` and applied via CSS variables on `<html>`.

### 6. Today's Songs (realtime)

- Home screen subscribes to `today_song_sets` + `today_song_items` for today's date via Supabase Realtime channel.
- Shows "No songs selected today" (HI/EN) when empty.
- Admin "Today" screen: pick songs → publish → instantly visible to all clients.
- OneSignal push: deferred — flagged as a follow-up turn (needs Firebase Messaging worker + OneSignal app id from you).

### 7. Admin system

- `/admin` page: tabs for "Super Admin" (email+password sign-in) and "Admin" (sign-in if already approved, otherwise "Request admin access" form).
- After sign-in, role checked server-side via `has_role()`.
- Super Admin account: you create the user in Lovable Cloud → Users, then a one-time migration grants `super_admin` to that email's `user_id` if found. Password never touches code.
- Approved admins can: upload content, edit/delete songs & book sections, publish Today's Songs, approve/reject admin requests.
- All admin mutations write to `audit_logs`.

### 8. Content upload (PDF / DOCX / TXT)

- Upload UI accepts the three formats and stores the raw file in Supabase Storage (`uploads` bucket, admin-only).
- Server function parses:
  - TXT: read as UTF-8.
  - DOCX: `mammoth` → plain text.
  - PDF: `pdfjs-dist` text extraction (Worker-compatible build).
- Parsed text shown in a Review screen where admin assigns: target book, section/song number, title (HI/EN), and body. Then "Publish" inserts rows; realtime sync propagates to users instantly.

### 9. Settings screen

- Font size slider (S/M/L/XL).
- Light / Dark / System toggle.
- Accent color palette (6 preset swatches + per-book auto override option).
- Language: English / हिन्दी toggle.

### 10. Splash & home

- First visit each session: 1.5s splash with church logo (placeholder until you upload one) and fade-out.
- Home: Today's Songs card at top → 5 book cards with their accent colors → quick links to Search, Bookmarks, Settings, Admin.

### 11. PWA install

- `public/manifest.webmanifest` with name "Church Companion", short_name "Church", standalone display, theme/background colors, 192/512 maskable icons (placeholder; replaceable).
- Head tags for manifest + theme-color + apple-touch-icon.
- No service worker in v1 — keeps Lovable previews safe and meets the manifest-only home-screen support path. Offline caching can be added later via `vite-plugin-pwa` with the guarded wrapper.

### 12. Out of scope for v1 (call out follow-ups)

- OneSignal push notifications (needs web-push setup + your OneSignal app id).
- Offline reading via service worker (additive, do after PWA installs cleanly).
- Cross-device bookmark sync (spec says local-only; leaving as local).
- Church logo + final brand colors — placeholder until you upload assets.

### 13. Implementation order (single build pass)

1. Enable Lovable Cloud.
2. Migration: enums, tables, GRANTs, RLS, `has_role`, `search_content`, seed 5 books.
3. Design tokens: theme CSS vars, fonts, accent palettes, i18n dictionary + hook.
4. App shell: `__root` head/manifest, splash, bottom tab navigation (Home / Books / Search / Bookmarks / Settings).
5. Home screen with realtime Today's Songs.
6. Book list + reader components (shared, themed per book).
7. Song Book with search, favorites, share/copy, continue reading.
8. Settings screen.
9. `/admin` tabs + auth flows, request submission, `_authenticated/admin/*` pages.
10. Upload → parse → review → publish flow.
11. Bookmarks screen, global search.
12. SEO `head()` per route, PWA manifest assets, smoke test on 390px viewport.

### 14. After plan approval — what I need from you

- Enable Lovable Cloud (I'll trigger the prompt).
- Create the Super Admin user in Cloud → Users with `emanualmridha2@gmail.com` and a NEW password (please rotate the one you pasted).
- Optional: upload church logo + any seed song/book content; otherwise I'll ship with placeholders and an empty library ready for admin upload.
