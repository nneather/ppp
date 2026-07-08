# 075 — Review tab follow-ups

**Date:** 2026-07-08
**Module:** library
**Tracker session:** Ad-hoc — post-074 review UX polish

## Built

- **Edited-volume contributor fix** — removed stale `{:else if auto}` missing banner (DB `Missing: …` auto-line no longer overrides live `previewMissing` after work-type change). Header copy is role-aware via `contributorGap()` (`No editor on file` vs `No author on file`) with **Add on full edit** when junction rows are needed.
- **Slimmer sticky action bar** — `py-2`, `gap-1.5`, `min-h-9` on mobile; `size="sm"` on desktop secondary row.
- **ISBN quick-edit on review cards** — `isbn` in `REVIEW_CARD_SELECT` / `ReviewCard`; show-on-gap input when blank, `?isbn=blank` deck, or note mentions ISBN; `reviewSaveAction` validates checksum + collision via `parseIsbnWithChecksum` / `ensureNoIsbnCollision`; undo snapshot includes `isbn`.

## Decided

- **Live `previewMissing` is the only missing banner** — stale auto-lines in `needs_review_note` are ignored on the card until Confirm strips them server-side. Rejected: merging auto + live (duplicative and misleading after in-card edits).
- **ISBN is gap-prompted, not always visible** — same show-on-gap pattern as title/year; not added to `IMPORTANT_FIELDS` / Turabian missing set.

## Schema changes

- None (ISBN column already on `books`).

## New components / patterns added

- `contributorGap`, `showIsbnRow`, `effectiveIsbn` helpers on `/library/review` (+page.svelte).

## Open questions surfaced

- Edition / subtitle show-on-gap can reuse the same pattern when those gaps show up often in review notes.

## Surprises (read these before the next session)

- `RawReviewCard` needed an explicit `isbn` field — `REVIEW_CARD_SELECT` alone does not typecheck without it.

## Carry-forward updates

- [ ] components.mdc updated — n/a
- [ ] AGENTS.md inventory updated — n/a
- [ ] new env vars documented — n/a
- [ ] tracker Open Questions updated — n/a
