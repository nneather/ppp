# 100 — PWA update banner non-blocking

**Date:** 2026-07-21
**Module:** cross-cutting (PWA)
**Tracker session:** ad-hoc — recovery / update banners covering invoicing Save

## Built

- **Recovery fallback banner** — [src/lib/pwa/client-recovery.ts](../../src/lib/pwa/client-recovery.ts): move to **top** (safe-area); softer copy (“clear cache when you're done”); **Clear cache** primary, Reload secondary, **Later** dismiss (no re-show until next full load); `role="status"` (non-modal).
- **Mid-session update toast** — [src/lib/components/PwaReloadToast.svelte](../../src/lib/components/PwaReloadToast.svelte): same top anchor + compact sizing; Dismiss → Later. Resume auto-apply from [082](082-pwa-update-auto-recover.md) unchanged.

## Decided

- **Top, not bottom** — bottom `bottom-tabbar` placement covered time-entry / sheet save bars on mobile. Sticky saves and bottom sheets stay usable.
- **Clear cache highlighted** — plain Reload often leaves the stale SW that caused the skew; primary CTA matches the better path.
- **Later is allowed** — owner often wants to finish the current form first; dismissed for the document lifetime (not a nag loop).

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- None.

## Surprises

- Auto-recover from 082 still leaves a fallback card when the first clear+reload fails within 20s — that path was the one blocking Save during invoicing.

## Carry-forward updates

- [x] components.mdc — PwaReloadToast top + Later
- [x] AGENTS.md inventory — 100 noted on PWA blurb
- [x] new env vars — none
- [x] PLAN.md refreshed
