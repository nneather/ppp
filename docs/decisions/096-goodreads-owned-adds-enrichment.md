# 096 — Goodreads owned-adds bibliographic enrichment

**Date:** 2026-07-20
**Module:** library
**Tracker session:** ad-hoc (follow-on to [093](093-goodreads-triage-execution.md))

## Built
- Enriched the **26 title-only owned books** created in Goodreads triage ([093](093-goodreads-triage-execution.md)) on hosted prod:
  - Authors linked (new people as needed: Swain, Piotrowski, Andrew Peterson, Nayeri, Bradbury, Nietzsche, Daniel H. Pink, Meg Jay, Silvia, Andrew Roberts, Mulot, Tillman; reused existing Lewis/Allen/Eswine/Chester/etc.)
  - Genre / year / publisher / ISBN filled where unique editions were clear
  - Series: **The Wingfeather Saga**, **Short Studies in Biblical Theology** (SSBT)
- Owner confirms: *How to Write a Lot* = **2018 2nd**; Wingfeather = **WaterBrook hardcovers** → cleared `needs_review` on those five
- Remaining edition-ambiguous rows left on **Needs the shelf** with `shelf:` notes (NASB, D-Day Encyclopedia, DK WW2, Geschichte, Drive, Hitler/Churchill, Tollbooth, classics)

## Decided
- Prefer filling confident bibliographic identity (author + genre + standard publisher) even when ISBN is unknown; keep `needs_review` + `shelf:` for edition/ISBN confirmation
- Do not invent ISBNs for multi-edition classics — shelf QA
- D-Day Encyclopedia best-guess Tillman/Regnery 2014 stays shelf-flagged until owner confirms vs Chandler/Collins 1994

## Schema changes
- None (data only)

## New components / patterns added
- None

## Open questions surfaced
- Shelf QA still needed for: NASB thinline; D-Day Encyclopedia which title; DK WW2 edition; Geschichte year; Drive/Hitler-Churchill/Tollbooth ISBN variants; Animal Farm / Fahrenheit / Franklin / Surprised by Joy / Genealogy of Morals editions

## Surprises (read these before the next session)
- MCP `execute_sql` is read-only for writes — enrichment applied via Session Pooler + `postgres` (same path as [093](093-goodreads-triage-execution.md))
- `W. Grabert` already existed in people → Geschichte is the Grabert/Mulot “Nürnberger” textbook

## Carry-forward updates
- [x] PLAN.md refreshed
- [ ] components.mdc — N/A
- [ ] AGENTS.md — N/A
- [ ] new env vars — N/A
