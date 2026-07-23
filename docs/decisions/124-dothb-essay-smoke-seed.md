# 124 — DOTHB essay smoke seed + IVP dictionary series polish

**Date:** 2026-07-23
**Module:** library
**Tracker session:** ad-hoc — owner smoke essays/Articles search without ABD on hand

## Built

- Seeded two signed articles on *Dictionary of the Old Testament Historical Books* (`241b0487-…`):
  - David Toshio Tsumura, "Canaan, Canaanites," 122–132
  - L. G. Stone, "Judges, Book of," 592–606
- Parent: `work_type = reference_work`, `publisher_location = Downers Grove, IL`
- Series `2bf4717c-…`: renamed **IVP Bible Dictionary Series**, `abbreviation` cleared to **NULL** (dictionaries stay grouped; no poisoned `in IVP` article footnotes)
- Owner confirmed **PWA resume re-smoke** after [111](111-pwa-resume-auto-apply-harden.md) — passed across the board
- Weekly backup Actions glance: run [29736441199](https://github.com/nneather/ppp/actions/runs/29736441199) (2026-07-20) success; prior weeks green after 2026-07-06 failures
- Owner confirmed three R2 objects present (`ppp-invoicing` / `ppp-library` / `ppp-projects`); **pipeline OK** without local `pg_restore -l` / Docker TOC proof

## Decided

- **Cite (SBL):** SBLHS2 lists **DOTHB** (with DJG, DPL, etc.) for IVP Black Dictionaries. Signed single-volume form: `Author, "Entry," DOTHB, page.` (comma after abbr). Owner preferred not to store that abbr on the shared series row.
- **Record now:** keep all IVP dictionaries on one series for settings/grouping; leave `series.abbreviation` null so article footnotes use long essay-in-book form until a **per-work citation abbreviation** exists (or we split series later). Rejected: `abbreviation = 'DOTHB'` on the shared series (would mis-label DJG/DPL) and `abbreviation = 'IVP'` (emits `in IVP`). Superseded same day by [125](125-books-citation-abbreviation.md) (`books.citation_abbreviation`).
- **`no_attributed_author`:** leave false — Arnold/Williamson editors already satisfy `computeMissingImportant` for non-monographs. Flag is for contributor-less works only ([069](069-review-queue-follow-ups.md), [071](071-review-queue-authorless-undo.md)).
- **Owner smoke close-out 2026-07-23:** essays/Articles + PWA resume + megacomponent core signed off; OCR deferred; backup pipeline OK (Actions + R2 presence).

## Schema changes

- `20260723154500_library_dothb_essay_seed.sql` — DML only (series rename/abbr clear; book polish; people + essays + essay_authors)
- `20260723162000_library_dothb_series_abbr.sql` — DOTHB series row + attach Historical Books for abbreviated footnotes

## New components / patterns added

- None.

## Follow-up (same day)

- Owner wanted abbreviated footnotes after seeing long form. Applied `20260723162000_library_dothb_series_abbr.sql`: dedicated series **DOTHB** on Historical Books only (siblings stay on IVP Bible Dictionary Series). Footnote → `…, "Canaan, Canaanites," in DOTHB, 122–132.` Bibliography stays full-title Covenant form (same as ABD fixture).

## Open questions surfaced

- None remaining from this session. Sibling Black Dictionary essay seeds optional later. IVP `publisher_location` backfill done ([127](127-ivp-publisher-location-backfill.md)). Per-work citation abbr shipped in [125](125-books-citation-abbreviation.md).

## Surprises

- MCP `execute_sql` with multiple statements often returns only the last result set — verify essay inserts with a single SELECT.
- Subagent noted *2 Corinthians* (B&H text) matched IVP-ish filter via mis-linked `publisher_id` → IVP Academic.

## Carry-forward updates

- [x] PLAN.md refreshed (PWA resume ✅; essays smoke → DOTHB; backup glance ✅)
- [ ] components.mdc — N/A
- [ ] AGENTS.md — N/A
- [ ] new env vars documented — N/A
