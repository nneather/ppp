---
name: library-owner-smoke
description: Owner phone smoke for the library module after UI or OCR changes. Use when validating mobile regressions, scripture batch save, or pre-trip QA.
---

# Library owner smoke

**Trip QA:** Owner signed off 2026-06-03 ([043](../../docs/decisions/043-library-trip-qa-signoff-projects-handoff.md)). Re-run this skill after major library mobile/OCR changes or before August Wave 2.

## Prerequisites

- Logged in as **owner** on production or preview
- Phone or narrow viewport (~390px)

## Runbook §A (core)

1. **`/library`** — **tap a book card** → book detail loads (iOS PWA regression fixed in [035](../../docs/decisions/035-library-list-pwa-navigation.md)); reading-status on card does not navigate; search debounce; Filters sheet; **New book** + **⋯** sheet (Search passage, Add by ISBN, Review queue)
2. **`/library/add`** — barcode or manual ISBN → new book prefill
3. **`/library/books/[id]`** — Edit + ⋯ sheet; reading status; scripture tab
4. **`/library/search-passage`** — e.g. Phil 2:5 returns hits
5. **`/library/review`** — swipe/card flow; burndown bar; back link

## OCR matrix (030)

On a book detail scripture form:

1. Queue **2+ photos** → **Run OCR** → sticky **Save K of N** visible without scrolling past tab bar
2. Queue a **multi-page PDF** → per-page progress → partial save if a page fails
3. Confirm batch rows group by **Page N/M**

## Capture

- Screenshot any regression → note in session decision **Surprises**
- Full script: [docs/library-trip-qa-runbook.md](../../docs/library-trip-qa-runbook.md)

## Viewer smoke (§B)

Deferred unless a collaborator account exists — see runbook §B + decision 013.
