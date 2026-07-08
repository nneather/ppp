# 071 — Review queue authorless works + undo

**Date:** 2026-07-08
**Module:** library
**Tracker session:** Ad-hoc — review-queue UX after [069](069-review-queue-follow-ups.md)

## Built

- **Work-type chip row on review cards** — collapsed chip row (Monograph / Edited volume / Reference work) with `work_type` persisted through `reviewSaveAction`; live citation preview re-dispatches on change.
- **Editors-only monograph hint** — when contributors are editors but `work_type` is still `monograph`, one-tap chips under the byline set `edited_volume` or `reference_work` (fixes dictionaries like *Dictionary of Jesus and the Gospels* without leaving the queue).
- **Role-aware missing preview** — `previewMissing` mirrors `computeMissingImportant` (author vs editor by `work_type`, respects `no_attributed_author`); live amber banner shows current gaps, not only the stale DB auto-line.
- **Confirm undo** — 10s toast after Confirm restores the pre-save book snapshot (`needs_review = true`, fields + note), rolls back local burndown/sprint counters, and resets a resolved proposal to `pending` when applicable.
- **Back button for skips** — wired the existing `goBackToSkipped()` helper (was dead code; hint text already promised it).

## Decided

- **Editors on file ≠ authorless** — keep `no_attributed_author` for contributor-less works; monographs with only editors get a work-type fix, not the authorless flag. Rejected: treating any editor list as satisfying monograph author requirements.
- **Undo restores pre-edit card state** — snapshot is the loaded `ReviewCard` at submit time (not effective overlay values), so mistaken confirms that only cleared the flag revert cleanly; edits applied on confirm are also reverted. Rejected: server-only `needs_review` flip without field restore.
- **Milestones not rolled back on undo** — one-time celebrations stay shown. Rejected: shrinking the shown-milestone set (complex, low value).

## Schema changes

- None.

## New components / patterns added

- `undoReviewSaveAction` + `?/undoReviewSave` — review-queue undo path in [`book-actions.ts`](../src/lib/library/server/book-actions.ts).
- `markProposalPending` — proposal reset helper in [`proposal-actions.ts`](../src/lib/library/server/proposal-actions.ts).
- `decrementReviewProgress` / `recordSprintUnclear` — localStorage rollback helpers in [`review-progress.ts`](../src/lib/library/turabian/review-progress.ts).

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- `goBackToSkipped()` existed since Session 5.5 but was never rendered — only the desktop hint text referenced it.

## Carry-forward updates

- [ ] components.mdc updated (no new components)
- [x] AGENTS.md inventory updated
- [ ] new env vars documented (none)
- [ ] tracker Open Questions updated
