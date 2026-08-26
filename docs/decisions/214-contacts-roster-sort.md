# 214 — Contacts roster sort (frequency, list, giving)

**Date:** 2026-08-26
**Module:** contacts / CRM
**Tracker session:** Ad-hoc after [213](213-contacts-frequency-labels.md)

## Built

- Composable sort on `/contacts` Contacts + Households tabs: primary + optional secondary key, URL `?sort=frequency,list`.
- Keys: Name (default), Frequency, List, Giving, Relationship, Last meet. Households drop Frequency / Last meet (person-owned).
- Group headers when the primary key is frequency, list, giving, or relationship.
- Rows show standing/ad-hoc list names plus giving/relationship grades so the sort is readable.
- Pure helper `src/lib/contacts/sort.ts` + unit tests. Due strip sort unchanged (oldest last-meet first). Form household pickers stay name-ordered.

## Decided

- Two keys, not a free-form N-column builder — covers “frequency then list or vice versa or giving” without a sort-builder UI.
- List sort uses standing lists first (by `contact_lists.sort_order`), then ad hoc; unlisted last. Person XOR household membership both count.
- Frequency order = most often → least: Common, Quarterly, Semester, Annual, None. Giving/relationship A first; ungraded last. Last meet: never-logged first, then oldest.
- No asc/desc toggle in v1 — natural direction per key. Default name sort omits `sort` from the URL.
- Client-side `$derived` sort (roster is ~200 rows); URL is source of truth like other `/contacts` filters. MCP due/search payloads unchanged.

## Schema changes

- None.

## New components / patterns added

- `src/lib/contacts/sort.ts` — parse/serialize, compare, group headers. Page-local Sort/then `<select>` snippet (not extracted).

## Open questions surfaced

- None. Asc/desc or a third key only if the two-key bar feels tight in daily use.

## Surprises (read these before the next session)

- A contact can sit on multiple lists (person membership + household membership). Grouping uses the first standing list by `sort_order`; the row still lists every name.

## Carry-forward updates

- [x] components.mdc — no new component (page snippet)
- [x] AGENTS.md inventory — `sort.ts`
- [ ] new env vars — none
- [x] tracker session row
