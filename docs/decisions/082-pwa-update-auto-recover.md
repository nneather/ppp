# 082 — PWA update auto-recover

**Date:** 2026-07-10
**Module:** cross-cutting (PWA)
**Tracker session:** ad-hoc — recurring chunk-load recovery card after frequent deploys

## Built

- **Chunk failure → auto recover** — [src/lib/pwa/client-recovery.ts](../../src/lib/pwa/client-recovery.ts): on detected chunk-load / dynamic-import failure, unregister SW + delete caches + reload (no tap). Manual "Reload / Clear cache" card only if a recovery already ran within 20s (reload-loop guard).
- **Resume → auto-apply waiting SW** — [src/lib/components/PwaReloadToast.svelte](../../src/lib/components/PwaReloadToast.svelte): on `visibilitychange` → visible, set resume flag + `registration.update()`; when `needRefresh` is true under that flag, call `updateServiceWorker(true)` without showing the toast. Mid-session discoveries (hourly check while foregrounded) still show the prompt toast.
- **Tests** — cooldown helper cases in [client-recovery.test.ts](../../src/lib/pwa/client-recovery.test.ts).

## Decided

- **Hybrid, not full `autoUpdate`** — keep `registerType: 'prompt'` so an update found while the owner is actively editing still requires a tap (avoids mid-form reload). Auto-apply only after background → foreground, which is when deploys usually land against the home-screen PWA.
- **Auto clear-cache on chunk failure, not silent `location.reload()` alone** — plain reload often leaves the stale SW/precache that caused the skew; unregister + cache delete matches the card's "Clear cache" path.
- Rejected: switch vite-pwa to `autoUpdate` (simpler, but reloads mid-session).

## Schema changes

- None.

## New components / patterns added

- None (behavior change on existing recovery + toast).

## Open questions surfaced

- ~~Owner phone smoke after next deploy: background PWA → push → reopen should refresh without the recovery card; mid-session toast should still appear if an update is found while foregrounded.~~ — resume path failed smoke 2026-07-22; hardened in [111](111-pwa-resume-auto-apply-harden.md).

## Surprises

- ~15 production deploys in four days made the 072 recovery card the common path rather than a rare net — prompt-only SW updates + NetworkOnly HTML is correct, but needs resume auto-apply under that cadence.

## Carry-forward updates

- [x] components.mdc — PwaReloadToast row notes resume auto-apply
- [x] AGENTS.md inventory — PWA blurb updated for 082
- [x] new env vars — none
- [x] PLAN.md refreshed
