# 223 — Contacts roster search and density

**Date:** 2026-09-10
**Module:** contacts / CRM
**Tracker session:** Ad-hoc after [214](214-contacts-roster-sort.md)

## Built

- `/contacts` Contacts + Households: live search as you type (AND tokens; name, household, email, phone digits, list names; households also match address + member names). Debounced URL `?q=` for share/back; filter is client-side so the ~200-row roster stays in memory.
- Search is full-width and sticky; due strip + import collapse while searching so results are immediately visible.
- Compact divided rows (name + one muted line) instead of tall cards; A–Z letter headers + jump rail when sorted by name.
- Due strip is a collapsed `<details>` summary (`N remaining of M`); due rows mount only when expanded so they do not sit above the roster. Dashboard remains the daily due work surface.
- MCP `search_contacts` uses the same matcher.

## Decided

- **Client-side filter, not server `q` on `loadContacts`.** Server-filtering emptied the in-memory list and made the next query flash empty until debounce. Roster scale is still ~200 ([214](214-contacts-roster-sort.md)).
- **Due list stays on `/contacts` but collapsed.** [211](211-contacts-module-review.md) kept one full due list; putting 100 cards above the roster made find-a-person impossible. Dashboard due tile is unchanged.
- No pagination. Letter jump + live search + density is enough at current scale.

## Schema changes

- None.

## New components / patterns added

- `src/lib/contacts/search.ts` — `contactMatchesQuery` / `householdMatchesQuery` / `nameLetterHeader`; unit tests `__tests__/search.test.ts`.
- `CONTACT_FREQUENCY_SHORT_LABELS` on types for compact roster captions.

## Open questions surfaced

- None. If the roster crosses ~500, add server prefix search rather than paginating first.

## Surprises (read these before the next session)

- List `q` previously required Enter and ignored household name (MCP search already matched household). Phone punctuation (`(214) 555-…`) also missed digit-only queries.
- Syncing `searchQ` from `data.filters.q` in `$effect` wiped in-progress typing on Log Contact invalidate; URL `q` is now the only external sync.

## Carry-forward updates

- [x] components.mdc — no new component (page-local snippets)
- [x] AGENTS.md inventory — `search.ts`
- [x] new env vars — none
- [x] tracker session row
