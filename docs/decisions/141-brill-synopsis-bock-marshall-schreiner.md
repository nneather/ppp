# 141 — Brill Synopsis + Bock BECNT / Marshall TNTC / Schreiner ZECNT shelf add

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc (library-add-books)

## Built

- Migration `20260724143000_library_becnt_bock_synopsis_batch.sql` (idempotent DML, hosted push):
  - Series **SPT** — *Synopsis of a Purer Theology*
  - 3 Brill Leiden Synopsis volumes (Systematic Theology / `edited_volume`; `original_year` 1625)
  - Darrell L. Bock BECNT *Luke 1:1–9:50*, *Luke 9:51–24:53*, *Acts*
  - I. Howard Marshall TNTC *Acts* (vol 5; year 2008 / original 1980)
  - Thomas R. Schreiner ZECNT *Galatians*
- Bible coverage: Luke ×2, Acts ×2, Galatians
- Reused existing people: Bock, Marshall (`I.` / `Howard` / `Marshall`), Schreiner

## Decided

- Genre for Synopsis: **Systematic Theology** (not Historical Theology)
- Attribution: four Leiden professors as **authors** + volume **editor** (te Velde / van den Belt / Goris) + Riemer A. Faber as **translator**
- New series abbr **SPT** (not SMRT registry volumes)
- BECNT Luke titles use verse ranges (unique `title + series_id`)
- Marshall: `year=2008`, `original_year=1980` (IVP retypeset)

## Schema changes

- DML only — skip `gen-types`

## New components / patterns added

- None

## Open questions surfaced

- None

## Surprises (read these before the next session)

- `author_display` for Marshall denorms to **I. H. Marshall** (existing middle-name initial rule) — not “I. Howard Marshall”
- Synopsis `author_display` lists only the four Leiden authors; editors/translators are on `book_authors` but not in the denorm label
- BECNT series name in DB is still “Baker Exegetical Commentary **of** the New Testament” (pre-existing typo; left alone)

## Carry-forward updates

- [x] PLAN.md refreshed
- [ ] components.mdc — N/A
- [ ] AGENTS.md — N/A
