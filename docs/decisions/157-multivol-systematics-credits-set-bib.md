# 157 — Multi-volume systematics credits + set bibliography

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc (August QA Track B / citation hygiene)

## Built
- Migration `20260724230000_library_multivol_systematics_credits.sql` (applied hosted):
  - **Calvin WJK** — McNeill (editor) + Battles (translator); clean title; `total_volumes=2`
  - **Calvin Hendrickson** — new person **Henry Beveridge** as translator (Albert J. left alone for Marshall series); cleared redundant edition string
  - **Brill Synopsis** — `work_type` → monograph (author-led); disputations → `subtitle`; `total_volumes=3`
  - **Van Mastricht** — Rester (tr.) + Beeke (ed.); part subtitles; `total_volumes=5`
  - **Bavinck RD** — Bolt (ed.) + Vriend (tr.); part subtitles; `total_volumes=4`
  - **Turretin IET** — Giger (tr.) + Dennison Jr. (ed.); Roman `volume_number` I/II/III; soft-delete older vol III; ISBN moved to kept row; `total_volumes=3`
  - Self-named series (`INST`/`SPT`/`TPT`/`RD`/`IET`): `include_in_citation=false`
- House style for these sets: clean work **title** + `volume_number` (+ part **subtitle**); list UI already appends `, vol. N`
- Turabian **§17.1.4** set bibliography: `formatBibliography(book, { citeSet: true })` → `N vols.` (omits volume subtitle); book-detail checkbox when `total_volumes > 1`

## Decided
- Clean titles (not “Title, Volume N”) so individual bib (`Vol. N.`) and set bib (`N vols.`) both match Covenant without double volume
- Synopsis leads with Leiden professors (not modern volume editor)
- Spangler omitted on Mastricht (Rester + Beeke only)
- `original_year` left null (owner chose 8B)
- citeSet is a **copy-time UI option**, not a stored preference; requires `books.total_volumes > 1` (column already existed)

## Schema changes
- DML-only migration `20260724230000_library_multivol_systematics_credits.sql` — no type regen

## New components / patterns added
- Book detail copy strip: “Cite set (N vols.) in bibliography” checkbox (page-local; not a new component)

## Open questions surfaced
- `/library/bibliography` compile does not yet offer citeSet / dedupe multiple vols of one set into one `N vols.` entry — defer until owner asks

## Surprises (read these before the next session)
- Turretin had **two** live vol-III rows; kept newer (1997) and moved ISBN from the soft-deleted duplicate
- `formatVolumeBibliography` already preferred `Vol. N.` over `N vols.` whenever `volume_number` was set — citeSet flag was the missing piece for §17.1.4
- Decision number collision with concurrent [156](156-book-detail-densify.md) — this entry is **157**

## Carry-forward updates
- [x] components.mdc — N/A (page affordance only)
- [x] AGENTS.md inventory — citeSet opts noted via decision; no new `$lib` module
- [x] new env vars documented — none
- [x] tracker Open Questions — N/A (ad-hoc)
