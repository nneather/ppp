# 020 — Library ISBN prefill (authors + series)

**Date:** 2026-05-16  
**Module:** library  
**Tracker session:** ad-hoc

## Built

- Extended `fetchOpenLibraryPrefill` / `OpenLibraryBookPrefill`: `authors[]`, `seriesName` / `seriesVolume`, `languageCode`; joined publishers when multiple; `pagination` fallback for page count; `LIBRARY_OL_PREFILL_KEY` bumped to `library_ol_prefill_v2`.
- New `src/lib/library/match.ts` — person exact/fuzzy matching + series matching + `splitAuthorString`.
- `<BookForm>` create-mode prefill: one author row per OL author, auto-link on exact name, fuzzy strip with “Use …” / “Create new”; series match + unmatched hint with link to `/settings/library/series`; scan-session “Missing from Open Library” checklist.
- `<PersonAutocomplete>`: `initialQuery` + `seedKey` to seed OL hints without extra typing.

## Decided

- No new DB tables; no combobox conversion for genre/series selects — prefill + series match reduces scrolling.
- Fuzzy author match = same normalized last name + same first initial, max 2 candidates (B14-aligned).

## Schema changes

- None.

## New components / patterns added

- `src/lib/library/match.ts` — see AGENTS.md library helpers list.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Open Library `series` shape varies (string vs `{ name }`); parser handles both.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [ ] new env vars documented (n/a)
- [ ] tracker Open Questions updated
