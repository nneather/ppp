# 085 — Library bulk update UX

**Date:** 2026-07-17
**Module:** library
**Tracker session:** ad-hoc

## Built

- `/library` multi-select bulk dialog no longer uses per-field enable checkboxes.
- Each field defaults to **Don’t change** (empty value); picking a value opts that field into the update.
- Live **Will apply:** summary under the fields; Update stays disabled until at least one field is set.
- Errors render inside the dialog (not a page-top banner).
- Selection bar: sticky highlight, clearer count (“N books selected”), shorter actions (Clear / Bibliography / Update…).
- `bulkUpdateBooksAction` applies a field when its select is non-empty (no `bulk_apply_*` checkboxes).

## Decided

- Prefer the standard bulk-edit sentinel (“Don’t change”) over checkbox-to-enable. One pick per field, no accidental overwrite of untouched defaults (old UI defaulted Language→English etc. even when the user only meant to set genre, if they forgot the checkbox).
- Rejected keeping checkboxes with disabled selects — still two taps and the nested `<label>` wrapping the select made clicks ambiguous.

## Schema changes

- None.

## New components / patterns added

- None (page-local dialog rewrite).

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Nested checkbox+select inside one `<label>` was easy to mis-tap; the page-level fail message (“Enable at least one…”) was the only feedback that nothing was checked.

## Carry-forward updates

- [x] components.mdc updated — N/A (no new reusable component)
- [x] AGENTS.md inventory updated — N/A
- [x] new env vars documented — N/A
- [x] tracker Open Questions updated — N/A
