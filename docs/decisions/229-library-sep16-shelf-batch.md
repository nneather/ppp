# 229 — Library Sep 16 shelf batch

**Date:** 2026-09-16
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built
- Migration `20260916205000_library_sep16_shelf_batch.sql` (hosted push):
  - **NIDNTTE** *New International Dictionary of New Testament Theology and Exegesis* — five volume rows (1–5), Silva editor, Zondervan Academic 2014 / orig. 1975 NIDNTT, per-vol ISBNs, `total_volumes=5`, edition Second. New series **NIDNTTE**, `include_in_citation=false` (TDNT pattern).
  - **Hansen/Flowers** *The AI Apocalypse* — TGC Indianapolis 2026 paperback `9781956593211`; genre **Applied Theology**; `edited_volume`.
  - **Lewis** *Poems* (`9780062643520`, orig. 1964) and *Narrative Poems* (`9780062643681`, orig. 1969) — HarperOne / San Francisco 2017; genre **Poetry**; Walter Hooper editor.
  - **Dostoevsky** *Notes from a Dead House* — Vintage / New York 2016, P&V translation `9780307949875`; orig. 1862. Reused existing **Fyodor Dostoevsky** (not the Dostoyevsky twin).
  - **DPL 1st** *Dictionary of Paul and His Letters* — IVP 1993 `9780830817788`, Hawthorne/Martin/Reid; `citation_abbreviation=DPL`. Existing 2023 2nd moved **DPL → DPL2**.
  - New people: Skyler R. Flowers, Walter Hooper, Richard Pevear, Larissa Volokhonsky, Daniel G. Reid.
  - `needs_review = false` on all inserts. No Commentaries in this batch (no bible coverage).

## Decided
- NIDNTTE = five ABD/TDNT-style volume rows, not one set row; per-volume ISBNs (not the boxed-set ISBN).
- DPL citation split is SBL-historical: 1993 = `DPL`, 2023 = `DPL2`.
- AI Apocalypse genre **Applied Theology** (not Ethics / Culture / Christian Living).
- TGC imprint **The Gospel Coalition** / **Indianapolis, IN** (owner; HQ/mailing disagree).
- Hooper attached as editor on both Lewis poetry volumes.
- Reuse `Fyodor Dostoevsky`; do not create another spelling.

## Schema changes
- `20260916205000_library_sep16_shelf_batch.sql` — DML only

## New components / patterns added
- None

## Open questions surfaced
- Twin person **Fyodor Dostoyevsky** still exists alongside **Fyodor Dostoevsky**. Merge later if wanted; this batch did not touch it.

## Surprises (read these before the next session)
- DPL 1st and 2nd share the title *Dictionary of Paul and His Letters* on the same IVP Bible Dictionary Series — natural key must be ISBN/year, not title+series.
- `author_display` lists authors (or editors when there is no author). Hooper and P&V are on `book_authors` but do not appear in the denorm string; Turabian still sees the roles.
- User typo *COllin* / *Lews* / *Dostoevesky* — Collin Hansen, C. S. Lewis, and Fyodor Dostoevsky were already in `people`.

## Carry-forward updates
- [x] Decision + PLAN.md
- [ ] components.mdc / AGENTS — n/a
- [ ] tracker Open Questions — n/a
