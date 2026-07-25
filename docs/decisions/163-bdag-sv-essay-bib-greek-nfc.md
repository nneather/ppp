# 163 — BDAG s.v. volume cite + essay bib vol:page + Greek NFC

**Date:** 2026-07-24
**Module:** library
**Tracker session:** Wave 2 August shelf QA Track B (rows 11–13, 16, 18)

## Built

- **Unsigned lexicon volume cites** (`BDAG`, `LSJ`, `HALAT`, …): book-level Footnote → `BDAG, s.v. "[lemma]," [page].`; Bibliography empty. Stops Bauer/Danker long-form on the parent volume ([`lexicon.ts`](../../src/lib/library/turabian/lexicon.ts) + [`format.ts`](../../src/lib/library/turabian/format.ts)). Prefer essay Copy for a real lemma.
- **Essay bibliography** includes locus for reference works and chapters: `4:100` when `volume_number` set, else page/range ([`article.ts`](../../src/lib/library/turabian/article.ts)). Updated Wave 2 fixtures rows 17–18 + docs.
- **Greek NFC** — `normalizeCitationText` on essay titles (formatters, clipboard, list display, essay save). Composes base+breathing+accent so app + Word paste do not stack combining marks.

## Decided

- Switch BDAG volume footnote to s.v. placeholders (not hide the button) — writing session still needs a copy path when no essay row is open.
- Essay bib vol:page for multi-vol dictionaries (TDNT/ABD) — owner Track B request; updates Covenant fixture strings accordingly.
- NFC only — do not invent remaps for non-Greek combiners (e.g. U+0357). Corrupt titles must be retyped.

## Schema changes

- None (formatter / UI only).

## New components / patterns added

- `src/lib/library/turabian/lexicon.ts` — `UNSIGNED_LEXICON_ABBREVS` / `isUnsignedLexiconVolume`
- `src/lib/library/turabian/text-normalize.ts` — `normalizeCitationText`

## Open questions surfaced

- One TDNT essay title stored as `ά͗λας` (U+1F71 + **U+0357** right half ring, not Greek breathing) — NFC cannot fix; owner should retype as `ἅλας` / intended lemma.

## Surprises (read these before the next session)

- TDNT series already `include_in_citation=false` ([160](160-tdnt-halat-lsj-consistency.md)); essay path still uses `series_abbreviation` for `in TDNT, 4:100.` notes — unrelated to the missing bib locus.

## Carry-forward updates

- [x] fixtures.md + WAVE2_FIXTURES
- [x] PLAN.md refreshed
- [x] AGENTS.md turabian one-liner
- [ ] components.mdc — N/A
- [ ] new env vars — none
