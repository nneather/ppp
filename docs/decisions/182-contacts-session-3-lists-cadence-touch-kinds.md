# 182 — Contacts Session 3 (Lists tab, cadence months/years, touch kinds)

**Date:** 2026-07-25
**Module:** contacts / CRM
**Tracker session:** Session 3

## Built

- Migration `20260725180115_contacts_touch_kind_and_cadence_ui.sql`: `contact_touches.kind` (`meet` \| `card`, existing → `meet`); partial index for meet lookups.
- Due loaders + MCP `list_contacts_due` / `search_contacts` last-touch = **meet only**; card logs do not clear due-to-meet.
- Cadence UI: months/years picker (profile default on Lists tab + per-contact override). Storage remains day-equivalent (`30` / `365` × amount).
- `/contacts` tabs: **Contacts \| Households \| Lists** — membership CRUD, default cadence, **Log cards sent** (one-tap + detailed note/date).
- Bulk card log fans out `kind=card` to live members of every C2-eligible household on the list.
- Person Log Contact / household Log all remain `kind=meet`.
- Folded list CRUD into Lists tab; `/settings/contacts/lists` **308 →** `/contacts?tab=lists`.

## Decided

- **Cadence storage** — keep `cadence_days` / `profiles.contact_cadence_days_default`; UI-only months/years (`1 month = 30d`, `1 year = 365d`). Rejected: new unit columns (no due-math benefit).
- **Settings lists** — fold CRUD into Lists tab; settings hub link points at `/contacts?tab=lists`; old route redirects. Rejected: dual surfaces.
- **Card fan-out** — households only (list XOR contact members ignored for bulk card log); C2 eligibility same as roster.

## Schema changes

- `20260725180115_contacts_touch_kind_and_cadence_ui.sql` — `contact_touches.kind` + meet partial index.
- `npm run supabase:gen-types` — `database.ts` includes `kind`.

## New components / patterns added

- [`src/lib/contacts/cadence.ts`](../../src/lib/contacts/cadence.ts) — months/years ↔ days helpers.
- [`src/lib/components/contact-cadence-fields.svelte`](../../src/lib/components/contact-cadence-fields.svelte) — amount + unit picker.
- [`src/lib/components/contacts-lists-panel.svelte`](../../src/lib/components/contacts-lists-panel.svelte) — Lists tab (CRUD + card log + default cadence).
- [`src/lib/components/log-cards-dialog.svelte`](../../src/lib/components/log-cards-dialog.svelte) — detailed list card log.

## Open questions surfaced

- Owner still owes MCP smoke (reload `ppp`; `list_contacts_due` + `search_contacts`) from Session 2 checklist.
- Weekly R2 dump still omits contacts tables (ops from [178](178-contacts-session-1.md)).

## Surprises (read these before the next session)

- Profile cadence default had no UI before this session — lives on Lists tab next to list management.
- Hotkey `s` reserved for Add member / dialog saves on Lists; header New contact keeps `b`.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] tracker Session 3 done
- [x] PLAN.md refreshed
- [ ] new env vars — none
