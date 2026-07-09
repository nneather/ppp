# 076 — Review edition in citations + fixed action bar

**Date:** 2026-07-08
**Module:** library
**Tracker session:** Ad-hoc — post-075 review UX polish

## Built

- **Edition from review notes in live citations** — `editionHintFromNote()` parses ordinal / revised-edition strings from `needs_review_note` when `books.edition` is empty; `effectiveEdition` + `showEditionRow` on `/library/review` feed Turabian preview and a gap-prompted Edition input; Confirm persists via existing `reviewSaveAction` `edition` field.
- **Fixed 2-row mobile action bar** — shared `mobileReviewActions` snippet: row 1 Confirm | Skip, row 2 Needs shelf | Field wrong | Back (invisible spacer when stack empty); `size="sm"`, `gap-1`, `py-1.5`; same layout in Genre Sprint fast lane and citation-critical mode.

## Decided

- **Hint-driven preview without DB write until Confirm** — `effectiveEdition` falls back to parsed note text for live footnote/bibliography; hidden or visible `edition` form field ensures save on confirm. Rejected: mutating `books.edition` on load.
- **Back slot always reserved** — third column uses spacer when `skippedStack` is empty so Field wrong never shifts. Rejected: conditional 2-col grid.

## Schema changes

- None.

## New components / patterns added

- `editionHintFromNote` in [`src/lib/library/review.ts`](src/lib/library/review.ts) + unit tests [`review-edition-hint.test.ts`](src/lib/library/__tests__/review-edition-hint.test.ts).
- `effectiveEdition`, `showEditionRow`, `mobileReviewActions` snippet on [`/library/review`](src/routes/library/review/+page.svelte).

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- `rev. ed.` in notes can match as `rev. ed` without the trailing period — normalization added in `editionHintFromNote`.

## Carry-forward updates

- [ ] components.mdc updated — n/a
- [x] AGENTS.md inventory updated — `editionHintFromNote` on review helpers
- [ ] new env vars documented — n/a
- [ ] tracker Open Questions updated — n/a
