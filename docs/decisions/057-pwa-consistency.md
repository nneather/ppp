# 057 — PWA consistency pass

**Date:** 2026-07-06
**Module:** cross-cutting (PWA)
**Tracker session:** ad-hoc (PLAN.md › PWA performance thread)

## Built

- **Light-theme chrome** — [static/manifest.webmanifest](../../static/manifest.webmanifest): `theme_color` / `background_color` → `#ffffff`; `start_url` → `/dashboard`; added `id`, `description`, `launch_handler.client_mode: navigate-existing`. [src/app.html](../../src/app.html): `theme-color` → `#ffffff`; `apple-mobile-web-app-status-bar-style` → `default`; `apple-mobile-web-app-title`.
- **Offline navigate fallback** — [static/offline.html](../../static/offline.html) precached; [src/service-worker.ts](../../src/service-worker.ts) `setCatchHandler` serves it only for failed `navigate` requests (not authenticated HTML caching).
- **Update freshness** — [src/lib/components/PwaReloadToast.svelte](../../src/lib/components/PwaReloadToast.svelte): `onRegisteredSW` → hourly `registration.update()` + on `visibilitychange` when visible (guarded by `navigator.onLine`).
- **Build stamp** — `__APP_BUILD__` (short git sha, date fallback) in [vite.config.ts](../../vite.config.ts); muted line on `/settings`.
- **Vocab path single source of truth** — [src/lib/library/vocab-cache-paths.ts](../../src/lib/library/vocab-cache-paths.ts) imported by SW + library fetch sites.

## Decided

- **Light-only for now** — align PWA chrome to the shipped light UI; `.dark` palette stays dormant until a future opt-in dark mode session.
- **Offline fallback ≠ HTML cache** — `offline.html` is a static shell shown only when the network fails on navigation; authenticated SSR documents are still never SWR-cached (024/038 contract unchanged).
- **Icons deferred** — black-square placeholders stay; branded monogram + maskable safe zone is a follow-up session (see open questions).
- **`start_url: /dashboard`** — skips the `/` → `/dashboard` 303 on cold launch; signed-out users still hit the auth gate → `/login`.

## Schema changes

- None.

## New components / patterns added

- `src/lib/library/vocab-cache-paths.ts` — `LIBRARY_VOCAB_CACHE_PATHS` + named path exports; SW SWR allowlist only.
- `static/offline.html` — branded offline shell (inline styles; no Tailwind dependency in SW precache).

## Open questions surfaced

- **Branded icon set** — owner/design: monogram `ppp` on zinc, `icon-192` / `icon-512` / maskable variant with safe zone, `apple-touch-icon` 180px, optional iOS splash screens. Session prompt added to PLAN.md.

## Surprises (read these before the next session)

- **iOS caches manifest at install** — after deploy, re-add the home-screen icon once to pick up `start_url` / `theme_color` changes.
- **SW bump comment** — v4 line in `service-worker.ts` forces a new SW script URL when only offline/catch-handler logic changes.

## Carry-forward updates

- [x] performance.mdc updated
- [x] AGENTS.md inventory updated
- [ ] components.mdc — no new reusable components
- [ ] Owner phone smoke: airplane-mode cold launch → offline page; deploy → toast within ~1h or on app resume; Settings shows build sha

## Verification

- [x] `npm run check` — clean (2026-07-06)
- [x] `npm run test` — 132/132 green
- [x] `npm run build` — precache includes `offline.html`; vocab routes registered via `LIBRARY_VOCAB_CACHE_PATHS`
- [ ] Owner: re-add home-screen icon after deploy; confirm light status bar + offline page
