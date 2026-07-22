# 110 — Sermons owner-smoke UX polish

**Date:** 2026-07-22
**Module:** sermons (+ library search-passage)
**Tracker session:** ad-hoc (owner smoke follow-up from [091](091-sermons-session-1.md) / [095](095-sermons-by-book-stats.md))

## Built

- **`/sermons` venue filter** — chip row → single `<select>` (All venues + venues); saves vertical space when many venues exist.
- **Find in library ranges** — `librarySearchHref` passes `verse_end` / `chapter_end` for passage spans (e.g. Matt 6:25–34); `/library/search-passage` form gains End verse field; query label shows full range.
- **`search_scripture_refs` range args** — optional `p_chapter_end` / `p_verse_end` so overlap search covers the full span, not only the start verse.
- **Back link** — sermons deep-links set `returnTo=/sermons` (by-book: `/sermons/by-book`); search-passage back reads allowlisted `returnTo` → “Sermons” instead of always “Library”.
- **By-book counts** — icon metrics: BookOpen + count (commentaries), Star + count (4★+ when >0); Mic + count on the right-hand sermons link (no duplicate sermon count in the row). Summary “N at 4★+”.
- **Removed “No commentaries” filter** — unused once every book has commentary coverage.

## Decided

- **Nav icons over word abbreviations** — Mic / BookOpen / Star match tab-bar meaning; sermon count only on the right action (Mic + N), not also in the middle of the row.
- **Allowlisted `returnTo`** — only `/sermons`, `/sermons/by-book`, `/library` (+ query strings); no open redirects.
- **Drop no-commentaries filter entirely** — legacy `?no_commentaries=1` ignored; not kept as a hidden URL flag.

## Schema changes

- `20260722184251_search_scripture_refs_range.sql` — DROP 3-arg `search_scripture_refs`, recreate with optional end bounds; REVOKE from PUBLIC/anon, GRANT to authenticated. Types regenerated.

## New components / patterns added

- None (route + helper polish only).

## Open questions surfaced

- Owner re-smoke: Find in library on a ranged sermon; by-book labels at phone width; venue select.

## Surprises (read these before the next session)

- Legacy RPC used the same verse for both search bounds when `p_verse` was set — so “Matt 6:25–34” deep-links only ever searched verse 25 until end args existed.

## Carry-forward updates

- [x] PLAN.md refreshed
- [x] `npm run check` / `npm run test`
- [x] migration pushed + `supabase:gen-types`
- [ ] components.mdc — N/A
- [ ] AGENTS.md — N/A (no new helpers beyond existing `librarySearchHref` opts)
