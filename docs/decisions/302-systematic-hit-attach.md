# 302 — Systematic hit attach

**Date:** 2026-10-23
**Module:** studies
**Tracker session:** ad-hoc

## Built

- Attach on a systematic index hit marks that one scripture reference as in use on this sermon or paper. Other verses in the same volume stay unmarked.
- The mark updates in place. The sermon does not reload, and the volume is not added to Sources.
- Click Attached again to clear it. A refresh keeps the set (`ppp.studies.systematicsUsing.<parentId>`).

## Decided

- This is a checklist, same class as Dismiss. It is not `study_sources`. Attaching Calvin on one verse does not attach the Battles volume.
- The set is per study and keyed by scripture-reference id, so the same locator can be in use on one sermon and unmarked on another. Passage search has no study id, so it still has no Attach button.
- Papers use the same control.

## Schema changes

- None.

## New components / patterns added

- [`src/lib/studies/systematics-using.ts`](../../src/lib/studies/systematics-using.ts) — parse / load / save for the in-use set.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- The old button posted `book_id` to `?/addPaperSource`, so every hit in that volume flipped to Attached and the page reloaded. Volumes already sitting in Sources stay there; they no longer light up every systematic row.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented (none)
- [x] tracker Open Questions updated (none; follow-on line added)
