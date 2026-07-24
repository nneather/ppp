# 162 — Essay author inline create

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc

## Built
- Essay author `<PersonAutocomplete>` now passes `onCreate` so "+ Create …" / tab-away unmatched names open a create dialog instead of silently dropping the typed text.
- Extended `<PersonEditDialog>` with **create mode** (`person == null` + optional `prefill` → `?/createPerson`).
- Book detail `?/createPerson` action + `depends('app:library:people')` so the people vocab refreshes after inline create.

## Decided
- Reuse `<PersonEditDialog>` for create rather than duplicating the book-form-authors dialog into `<BookEssaysEditor>` (already oversized).
- Empty author rows remain allowed (unsigned dictionary `s.v.`); only unmatched *typed* names were the silent-fail path.

## Schema changes
- None

## New components / patterns added
- `<PersonEditDialog>` create mode via null `person` + `prefill` / `createActionPath`

## Open questions surfaced
- Optionally point book-form-authors at the same dialog (still deferred from [158](158-book-detail-polish-author-edit.md)).

## Surprises (read these before the next session)
- Without `onCreate`, autocomplete blur with zero matches is a no-op and save filters empty `person_id` rows — essay “succeeds” with no author. Felt like a silent reject.

## Carry-forward updates
- [x] components.mdc updated
- [ ] AGENTS.md — N/A beyond components inventory
- [x] new env vars documented — N/A
- [ ] tracker Open Questions updated — N/A
