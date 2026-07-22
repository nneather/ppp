# 111 — PWA resume auto-apply harden

**Date:** 2026-07-22
**Module:** cross-cutting (PWA)
**Tracker session:** ad-hoc — owner smoke of [082](082-pwa-update-auto-recover.md) (resume did not update until full close)

## Built

- Harden [`PwaReloadToast.svelte`](../../src/lib/components/PwaReloadToast.svelte) resume path:
  - On foreground after background: if `registration.waiting` **or** `needRefresh` already true → `updateServiceWorker(true)` immediately (covers Later-dismissed toast + waiting worker that never re-flipped the store).
  - Else `registration.update()` and keep auto-apply when `needRefresh` becomes true.
  - Track `wasBackgrounded` so window `focus` only counts as resume after a real hide (not in-page focus).
  - Also listen for `pageshow` (`event.persisted`) — iOS bfcache / standalone restore.
  - Guard double-apply with `applying`.

## Decided

- **Apply waiting worker by reference, not only via `needRefresh`** — vite-pwa’s store can stay false after Later while `registration.waiting` is still set; that was the “full close then it updates” smoke failure.
- **Keep mid-session toast** — still `registerType: 'prompt'`; auto-apply only after background → foreground (082 hybrid).
- Nav watchdog phone throttle test deferred (owner skip).

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- Owner re-smoke: background PWA → wait for a deploy (or leave a waiting SW after Later) → return from app switcher → should reload without full force-quit.

## Surprises

- Owner smoke: boot shell flash = healthy; toast placement pass ([100](100-pwa-update-banner-nonblocking.md)); resume path failed until full close.

## Carry-forward updates

- [x] components.mdc — PwaReloadToast row notes waiting-worker apply
- [x] AGENTS.md — 111 pointer on resume path
- [x] PLAN.md refreshed
- [x] `npm run check` — 0 errors (2026-07-22)
