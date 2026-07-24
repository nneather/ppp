# 143 — OL edition prefill fix + in-book person edit

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc (Track B Conscience findings — Naselli/Crowley)

## Built

- **OL edition prefill** — `editionLineFromEdition` now uses `edition_name` only when it looks like a Turabian edition statement (`2nd ed.`, `Revised edition`, etc.). Drops `physical_format` and `revision` (which produced `Paperback — 9`). Exports `isLikelyOlBindingEditionJunk` for cleanup. Unit tests in `open-library-prefill-edition.test.ts`.
- **Optional cleanup script** — `scripts/library-edition-cleanup/clearBindingEditions.ts` (dry-run default; `--apply` needs `LIBRARY_EDITION_CLEANUP_CONFIRM=yes`). Dry-run found **28** live junk editions (binding—N, binding-only, bare revision digits). **Applied 2026-07-24** — cleared `edition` to null on those 28 rows.
- **In-book person edit** — `<BookFormAuthors>` pencil on a selected author opens Edit person (first/middle/last/suffix). Posts to `?/updatePerson` via shared `updatePersonSettingsAction` (same `person_id`; aliases preserved). Wired on `/library/books/new` + `/library/books/[id]/edit`.

## Decided

- Edition prefill is conservative: unknown free-text `edition_name` without edition signals is dropped rather than guessing.
- In-form edit updates the person row in place — not create-another / not merge UI. B14 collision warning still fires (excluding self) with “Save anyway” confirm.
- Cleanup of historical junk editions is opt-in after dry-run review; Parker confirmed apply → 28 rows cleared.

## Schema changes

- None.

## New components / patterns added

- `editionLineFromEdition` / `isLikelyOlBindingEditionJunk` exported from `open-library-prefill.ts`.
- `scripts/library-edition-cleanup/` — one-shot hosted cleanup.
- `<BookFormAuthors>` — create + edit person dialog modes; `personUpdateActionPath` prop.

## Open questions surfaced

- None remaining for this session (edition cleanup applied).

## Surprises (read these before the next session)

- Bare numeric `edition` values (e.g. `"2"`, `"11"`) match the old “revision-only” join path and dominate the dry-run list alongside `Hardcover — N`.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [ ] new env vars — none (reuse `LIBRARY_*_DATABASE_URL` / research pooler helper)
- [ ] tracker Open Questions — n/a
