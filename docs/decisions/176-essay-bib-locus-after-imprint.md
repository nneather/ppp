# 176 — Essay bibliography locus after imprint

**Date:** 2026-07-24
**Module:** library
**Tracker session:** Wave 2 August QA Track B (ad-hoc)

## Built
- Essay/chapter bibliography: move `vol:page` (or page span) to **after** place/publisher/year, matching Covenant encyclopedia notes such as Christman / Chadwick (`… (San Diego: Academic Press, 1998), 3:689.` → bib `… 1998. 3:689.`).
- Updated WAVE2 fixtures rows 17–19 + unit tests (incl. Christman bib assertion).
- Docs: [library-turabian-fixtures.md](../library-turabian-fixtures.md) bib strings.

## Decided
- **Bib locus terminal** — reject prior mid-entry form `…, edited by X, 4:100. Place: Pub, year.` Owner Track B (TDNT Hauck) + Covenant Christman parallel.
- **Footnotes unchanged** — full essay-in-book notes already put locus after `(Place: Pub, year)`; abbreviated ABD/TDNT notes already end with `vol:page` (`in TDNT, 4:100.`). No first-note abbreviation overturn.
- Same formatter path covers chapters in edited volumes (Piper) — pages move to end of bib too.

## Schema changes
- None

## New components / patterns added
- None (`formatEssayBibliography` in [`article.ts`](../../src/lib/library/turabian/article.ts))

## Open questions surfaced
- None

## Surprises (read these before the next session)
- Easy to confuse “locus at end of entry” with “stop using abbreviated TDNT notes.” Abbreviated notes already terminate with locus; only bib was wrong.

## Carry-forward updates
- [x] components.mdc updated (n/a)
- [x] AGENTS.md inventory updated (n/a)
- [x] new env vars documented (n/a)
- [x] tracker Open Questions updated (n/a)
