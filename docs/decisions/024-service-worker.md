# 024 — PWA service worker (Workbox + gated refresh)

**Date:** 2026-05-18  
**Module:** cross-cutting (PWA / perf)  
**Tracker session:** ad-hoc (no tracker row)

## Built

- **`@vite-pwa/sveltekit`** with **`injectManifest`**, `registerType: 'prompt'`, `manifest: false` (keep [static/manifest.webmanifest](../../static/manifest.webmanifest) + icons in `static/` only).
- **[src/service-worker.ts](../../src/service-worker.ts)** — `precacheAndRoute(self.__WB_MANIFEST)` for hashed client assets (`client/**/*.{js,css,ico,svg,webp,woff,woff2}` minus manifest + PWA icons); **NetworkFirst** (3s timeout, `ppp-routes-v1`, max 30 entries / 7d) for same-origin **navigation GET** HTML; **bypass** (no SW caching): `/auth/*`, `/login` (+ prefix), and any URL whose query starts with `?/` (SvelteKit form actions); **`SKIP_WAITING`** on `postMessage`; **`clients.claim()`** on `activate`.
- **[src/lib/components/PwaReloadToast.svelte](../../src/lib/components/PwaReloadToast.svelte)** — `virtual:pwa-register/svelte` `useRegisterSW`; toast **"New version available — refresh"** with **Update now** (`hotkey="u"`) + **Dismiss** (`hotkey="Escape"`); `bottom-tabbar` clearance.
- **[src/routes/+layout.svelte](../../src/routes/+layout.svelte)** — client-only dynamic import of `<PwaReloadToast />` after main shell.
- **[vite.config.ts](../../vite.config.ts)** — `SvelteKitPWA` + `define` for `process.env.NODE_ENV` (Workbox in SW); `devOptions.enabled: false` so dev is not SW-cached.
- **[svelte.config.js](../../svelte.config.js)** — `kit.serviceWorker.register: false` (vite-pwa owns registration).
- **[src/app.d.ts](../../src/app.d.ts)** — `/// <reference types="vite-plugin-pwa/svelte" />` for virtual module types.

## Decided

- **`$app/stores` `updated` vs vite-pwa `needRefresh`:** the original prompt asked for SvelteKit’s `updated` store to gate the toast. **`useRegisterSW`’s `needRefresh`** already tracks a new waiting worker + coordinates `SKIP_WAITING` / reload with vite-pwa — we use that instead. Same user-visible outcome (deploy → toast → user-controlled refresh).
- **`/_app/immutable/*` strategy:** explicit **CacheFirst** runtime route was **not** added on top of precache — it would duplicate storage vs `precacheAndRoute`. **Workbox precache** already serves content-hashed assets cache-first with its precache update flow; **documented here** as satisfying “cache-first + revalidate” for immutable URLs.
- **Cross-origin Supabase:** not intercepted (same-origin routing only); auth/session traffic stays off the HTML route cache.

## Schema changes

- None.

## New components / patterns added

- `<PwaReloadToast />` — see [.cursor/rules/components.mdc](../../.cursor/rules/components.mdc) + [AGENTS.md](../../AGENTS.md) Patterns.

## Cache-bust / invalidation contract

1. **`/_app/immutable/*` and other precached client files** — filenames are content-hashed; new deploy → new URLs → fetches miss old precache entries naturally. Workbox precache cleanup removes outdated revisions over time.
2. **Route HTML (`ppp-routes-v1`)** — NetworkFirst with 3s network timeout: online navigations prefer the network; cache is fallback for offline / slow network. **Max age 7 days** + **30 entries** caps staleness if the device stays offline a long time.
3. **Always-fresh (not in precache manifest)** — `manifest.webmanifest`, `icon-*.png`, `apple-touch-icon.png` excluded via `injectManifest.globIgnores`.
4. **Force a new SW + toast without a full app deploy** — edit any byte in [src/service-worker.ts](../../src/service-worker.ts) (e.g. the “Bump this comment” line) so the SW script URL changes.

## Verification

- [x] `npm run check` — clean (2026-05-18).
- [x] `npm run build` — generates `.svelte-kit/output/client/service-worker.js`; precache **101 entries (~1465 KiB)**; precache list does **not** include `manifest.webmanifest` or `icon-*.png` (spot-checked generated SW).
- [ ] **Lighthouse mobile** — owner: run **before** (baseline) + **after** deploy on Vercel; record e.g. FCP / LCP in this section when available:

| Run | FCP | LCP | Notes |
|-----|-----|-----|-------|
| Baseline (pre-SW) | _TBD_ | _TBD_ | |
| After SW deploy | _TBD_ | _TBD_ | |

- [ ] **iPhone home screen** — owner: cold-launch online (perceived paint vs baseline); cold-launch airplane mode (shell + last cached HTML); deploy then confirm **New version available — refresh** toast → **Update now** reloads.

## Open questions surfaced

- None.

## Surprises

- **`npm run build`** may log Workbox warnings for empty globs (`prerendered/**/*.{html,json}`, `client/*.webmanifest`) when the app has no prerendered output and PWA manifest generation is off — **benign**; precache still populated from `client/**`.

## Carry-forward updates

- [x] [components.mdc](../../.cursor/rules/components.mdc) — `<PwaReloadToast />` row
- [x] [AGENTS.md](../../AGENTS.md) — Patterns + SW pointer
- [x] [PLAN.md](../../PLAN.md) — Recent decisions + last updated
