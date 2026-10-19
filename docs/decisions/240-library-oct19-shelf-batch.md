# 240 — Library Oct 19 shelf batch

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built

- Migration `20261019160000_library_oct19_shelf_batch.sql` (hosted push). Seven books, eight new people.
  - *Greek-English Lexicon of the New Testament: Based on Semantic Domains*, Volume 1 (Introduction and Domains) and Volume 2 (Indices) — eds. Johannes P. Louw and Eugene A. Nida. United Bible Societies, New York, NY, 1989. ISBN empty (2nd-ed. set; per-volume barcodes are the 1988 printing). Greek Language Tools, `reference_work`.
  - *Acts* — Eckhard J. Schnabel. ZECNT, no `volume_number` (catalog vol. 5; siblings omit it). Zondervan, Grand Rapids, MI, 2012 `9780310243670`. Commentary. Coverage: Acts.
  - *Discourses, Volume I: Books 1–2* — Epictetus; W. A. Oldfather, translator. LCL 131. Harvard University Press, Cambridge, MA, 1925 `9780674991453`. Philosophy.
  - *Discourses, Volume II: Books 3–4. Fragments. The Encheiridion* — same. LCL 218. 1928 `9780674992405`.
  - *Christology of the Later Fathers* — eds. Edward R. Hardy and Cyril C. Richardson. Standalone (no LCC series). Westminster John Knox, Louisville, KY, 2006, original year 1954, `9780664241520`. Church Fathers, `edited_volume`.
  - *Job* — Francis I. Andersen. TOTC 14. IVP Academic, Downers Grove, IL, 2008, original year 1976, `9780830842148`. Commentary. Coverage: Job.

## Decided

- Louw–Nida is two rows, year 1989, ISBN null (owner 1A).
- Job is the 2008 IVP Academic retypeset paperback, not the 1976 InterVarsity printing (owner 2A).
- Hardy stays standalone. Library of Christian Classics was not created (owner 3B). Year 2006, original year 1954.
- United Bible Societies and Harvard University Press stay free-text. Zondervan, IVP Academic, and Westminster John Knox link to existing publisher rows.
- `needs_review` false. Reading status `reference` for the lexicon and both commentaries; `unread` for Epictetus and Hardy.

## Schema changes

- `20261019160000_library_oct19_shelf_batch.sql` — DML only

## New components / patterns added

- None

## Open questions surfaced

- None

## Surprises (read these before the next session)

- The shelf title is *Christology of the Later Fathers*, and the TOTC author is Francis I. Andersen.
- Local `20261019104500` was renamed to `20261019160000` before push. `20261019152923_sermon_venue_logistics.sql` was already on the remote, so the earlier stamp would have been inserted before the remote head.
- Epictetus `author_display` is the ancient author only. Oldfather is stored as translator, same pattern as Murray on the Odyssey.
- ISBN checksums passed for Schnabel, both Loebs, Hardy, and Andersen. Louw–Nida ISBNs were left null on purpose.

## Carry-forward updates

- [x] Decision + PLAN.md
- [x] No new helpers (AGENTS.md / components.mdc unchanged)
- [x] DML-only — skipped `gen-types`
- [x] Commentary coverage verified (`Acts`, `Job`)
