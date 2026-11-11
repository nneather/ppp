# 317 — Library Nov 11 Berlin Lamentations

**Date:** 2026-11-11
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built

- Migration `20261111204914_library_nov11_berlin_lamentations.sql` (hosted push). One new book. Adele Berlin and series OTL already existed.
  - *Lamentations* — Adele Berlin. OTL. Westminster John Knox, Louisville, KY, 2002, `9780664218492`. Commentary. Coverage: Lamentations. Publisher row linked. `needs_review` false.

## Decided

- Owner answer: hardcover 2002, ISBN `9780664218492` (not the paperback `9780664229740`).
- Title is *Lamentations* with no subtitle, matching the other OTL rows (*Genesis*, *The Book of Exodus*, *I & II Chronicles*).
- Already on **Commentaries: Lamentations** by the bible-book coverage rule. No member row.

## Schema changes

- `20261111204914_library_nov11_berlin_lamentations.sql` — DML only

## New components / patterns added

- None

## Open questions surfaced

- None

## Surprises (read these before the next session)

- `npx supabase migration new` installed CLI 3.1.0 and wrote a second, empty file `20261111204940_library_nov11_berlin_lamentations.sql`. The push applied both. The empty version was repaired to reverted and the local file deleted. Use the Homebrew CLI (`supabase` 2.109.1), not `npx supabase`.
- Childs *The Book of Exodus* (OTL) still has a null `publisher_id`. Berlin, von Rad, and Japhet are linked to Westminster John Knox. Left alone.

## Carry-forward updates

- [x] Decision + PLAN.md
- [x] No new helpers (AGENTS.md / components.mdc unchanged)
- [x] DML-only — skipped `gen-types`
- [x] Commentary coverage verified (`{Lamentations}`)
- [x] No `resource_set_members` rows
