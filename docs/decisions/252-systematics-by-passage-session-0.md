# 252 — Systematics by passage (Session 0)

**Date:** 2026-10-19
**Module:** library / studies / mcp
**Tracker session:** ad-hoc (plan: Systematics by passage)

## Built

- Locked Phase-0 structure for "where does each systematic theology touch this passage, and in which section?"
- Session prompts / Next-up for S1–S5+ (outline + band → sermon/MCP → OCR index mode → gold eval → per-set capture).

## Decided

- **Two layers + one join:** `scripture_references` (verse → page, OCR/index) join `book_outline_sections` (TOC page range → locator + label). Display: `Turretin 2:620 (XV.17 Full Assurance)`.
- **New table `book_outline_sections`** — per-volume TOC nodes (`book_id`, optional `parent_id`, `sort_order`, `locator`, `label`, integer `page_start`/`page_end`). Not essays; not a second scripture-ref tier ([249](249-library-passage-sections.md)).
- **Do not** change `scripture_references` schema. Volume routing for set indexes happens before save (one batch per resolved volume).
- **`search_scripture_refs` v3** — add `book_genre`, `book_volume_number`, `series_id`, `series_name` so the systematic band groups without an extra round trip.
- **UI surfaces:** grouped "Systematic theologies" band on `/library/search-passage` (after section, before coverage); sermon workspace via shared loader; MCP `list_systematics_for_passage`.
- **Accuracy gate:** OCR index mode (column split, 3000px, two-pass consensus, structural validators, side-by-side verify) must hit **≥99.5%** exact-match on a hand-transcribed gold set before bulk capture.
- Van Mastricht chapter-opening exegetical texts → existing `book_passage_sections` (bonus "On this passage"), not outline rows.
- Out of scope for now: ebook/Logos parse; publisher data except as import source; hit-rate / auto-attach / `/studies/by-book`.
- **2026-10-19 (Parker):** A section locator is the same kind of pointer as a page number. Calvin’s Battles index cites Institutes sections, including ranges (`III.2.12–14`). Keep those tokens on `scripture_references.page_start` / `page_end` (no schema change). When the token is a section, join it to `book_outline_sections.locator`; page indexes still join on page range. Show the section or the section range where a page number would have been. First practice capture is Calvin. Bulk page-index sets (Turretin, van Mastricht, Bavinck) still wait on the ≥99.5% gold gate.

## Schema changes

- Deferred to Session 1: `book_outline_sections` + `search_scripture_refs` v3.

## New components / patterns added

- None yet (Session 0).

## Open questions surfaced (shelf checks before S3)

- Turretin: index in vol. 3 only? Does it cite `vol:page`?
- Bavinck RD: per-volume indexes or cumulative in vol. 4?
- Calvin (Battles): index cites section locators and ranges, not pages (locked above). Continuous pagination no longer decides the join.
- Van Mastricht: index per volume; named exegetical text at chapter openings?

## Surprises (read these before the next session)

- Decision numbers 250–251 already used (passage-sections research + studies import); this Session 0 is **252**.

## Carry-forward updates

- [x] PLAN.md refreshed (Next up + session prompt)
- [ ] components.mdc / AGENTS.md — update as S1+ land
- [ ] new env vars — none
