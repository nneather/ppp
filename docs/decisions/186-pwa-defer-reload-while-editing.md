# 186 — Defer client reload while editing

**Date:** 2026-07-27
**Module:** cross-cutting (PWA / client)
**Tracker session:** ad-hoc — mid-form reload during time logging / invoice entry after deploys

## Built

- [`src/lib/pwa/user-busy.ts`](../../src/lib/pwa/user-busy.ts) — `isUserBusy()` detects open sheet/dialog (`data-slot` sheet/dialog content or `role="dialog"`, not `data-closed` / `aria-hidden`) or focus in an editable control.
- [`PwaReloadToast.svelte`](../../src/lib/components/PwaReloadToast.svelte) — resume / `needRefresh` auto-apply skipped when busy; shows top update toast instead (desktop tab return + mobile app resume).
- [`client-recovery.ts`](../../src/lib/pwa/client-recovery.ts) — chunk-load auto clear+reload skipped when busy; shows existing top recovery card immediately.
- Unit tests: [`user-busy.test.ts`](../../src/lib/pwa/user-busy.test.ts).

## Decided

- **One busy-gate for desktop browser and installed PWA** — same SW toast + recovery listeners; no separate desktop path. Tab hide/show is a primary resume trigger on desktop.
- **Defer, don't disable resume auto-apply** — idle resume still auto-applies waiting SW ([082](082-pwa-update-auto-recover.md)/[111](111-pwa-resume-auto-apply-harden.md)); mid-edit only surfaces the prompt.
- Rejected: draft persistence for time entries as the first fix (orthogonal; can follow later).

## Schema changes

- None.

## New components / patterns added

- `src/lib/pwa/user-busy.ts` — shared mid-edit detector for silent-reload gates.

## Open questions surfaced

- Owner smoke after next deploy: open time-entry sheet → switch browser tab (or background PWA) → return → form should remain; update/recovery banner may appear at top.

## Surprises

- Symptom often showed as “reset then clear-cache card” because first auto-reload wiped the form, then a second chunk failure within 20s surfaced the card ([100](100-pwa-update-banner-nonblocking.md)).

## Carry-forward updates

- [x] components.mdc — PwaReloadToast busy deferral note
- [x] AGENTS.md inventory — 186 + `user-busy.ts`
- [x] new env vars — none
- [x] PLAN.md refreshed
