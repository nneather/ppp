# 072 — PWA cold-start resilience

**Date:** 2026-07-08
**Module:** cross-cutting (PWA)
**Tracker session:** ad-hoc — morning white-screen incident + 066 nav-watchdog follow-through

## Built

- **Inline bootstrap shell** — [src/app.html](../../src/app.html): zero-dependency `#ppp-boot-shell` shows "Loading ppp…" on cold launch (not blank white); 15s watchdog → "Tap to retry" → `location.reload()`. Removed on successful layout mount.
- **Client error surface** — [src/hooks.client.ts](../../src/hooks.client.ts) + [src/lib/pwa/client-recovery.ts](../../src/lib/pwa/client-recovery.ts): `handleError` logging; `window` `error` / `unhandledrejection` listeners detect chunk-load failures → fixed recovery card (Reload + Clear cache → unregister SW + delete caches + reload).
- **Nav watchdog** (066 Q14) — [src/routes/+layout.svelte](../../src/routes/+layout.svelte): when `navigating.to` is set for **12s**, overlay "Still loading — tap to retry" → `window.location.assign()` (document navigation; SW 10s timeout + `offline.html` apply).
- **Tests** — [client-recovery.test.ts](../../src/lib/pwa/client-recovery.test.ts) (3 cases).

## Incident (2026-07-08 ~10:18 AM)

- **Symptom:** cold launch from home-screen icon → pure white screen (no skeleton, no tab bar, no offline page); close/reopen did not help; recovered later without intervention.
- **Read-only checks:** last Vercel Production deploy **2026-07-07T22:06:26Z** (~5:06 PM CDT Jul 7); HEAD at session time `24b15e2` (069). Pattern matches **bootstrap/hydration failure** (JS never painted), not the endless nav-skeleton hypothesis (that shows gray placeholders on in-app tab navigation).
- **Leading cause (unconfirmed):** stale SW / chunk skew after Jul 7 evening deploy (`registerType: 'prompt'`) or transient network blip on cellular — HTML may return 200 while `/_app/immutable/*.js` fails afterward; `offline.html` only covers failed **document** navigations, not post-HTML chunk failures.

## Decided

- **Three layers, not one** — boot shell (works when all JS fails), chunk recovery card (partial load), nav watchdog (in-app `__data.json` hang). SW v6 chunk-retry deferred unless phone smoke proves insufficient.
- **Keep `registerType: 'prompt'`** — autoUpdate would fix skew faster but removes user control; recovery UI is the safer net.
- **Nav watchdog ships here** — closes 066 Q14 item; ops hardening session still owns backup/restore/REVOKE.

## Schema changes

- None.

## New components / patterns added

- `src/lib/pwa/client-recovery.ts` — DOM recovery card for chunk-load failures (no Svelte dependency).
- `src/hooks.client.ts` — SvelteKit client `handleError` + installs recovery listeners at bootstrap.
- Boot shell pattern: `[data-ppp-boot]` in `app.html`, removed in root layout `onMount`.

## Owner recovery (if white screen recurs)

1. Force-quit PWA → relaunch.
2. If still white: delete website data for the origin (Settings → Safari → Advanced → Website Data) or remove and re-add the home-screen icon.
3. Tap **Update now** if the version toast appears.
4. Compare Safari (browser) vs standalone icon — if Safari works, suspect SW/precache state.

## Open questions surfaced

- **Phone smoke** — owner: cold launch shows "Loading ppp…"; throttle offline → boot retry; throttle `__data.json` on tab tap → nav watchdog overlay; block one immutable chunk → recovery card. Safari remote inspector if skeleton/watchdog fires unexpectedly.

## Surprises

- Pure white on cold launch is a **different failure class** from the endless nav skeleton — offline fallback and SW v5 fixes do not cover post-HTML chunk load failures.

## Carry-forward updates

- [x] components.mdc — no new Svelte components
- [x] AGENTS.md inventory — `client-recovery.ts` + `hooks.client.ts` under PWA pattern
- [x] new env vars — none
- [x] ops hardening session prompt — nav watchdog item satisfied by this session

## Verification

- [x] `npm run check` — 0 errors (2026-07-08)
- [x] `npm run test` — 205/205 (2026-07-08)
- [ ] Owner phone smoke — cold launch boot shell + nav watchdog + chunk recovery card
