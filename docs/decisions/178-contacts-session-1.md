# 178 — Contacts Session 1 (schema + `/contacts` CRUD)

**Date:** 2026-07-24
**Module:** contacts / CRM
**Tracker session:** Session 1

## Built

- Migration `20260725020000_ppp_contacts_v1.sql` applied (hosted): `households`, `contacts`, `contact_touches`, `contact_lists`, `contact_list_members`; `profiles.contact_cadence_days_default`; RLS via `app_is_owner` / `app_has_module_read('contacts')`; GRANTs; `set_updated_at` + audit triggers; partial indexes; XOR CHECK on list members; `module_registry` slug `contacts`; seeded **Christmas cards** list (L1).
- Types regenerated (`src/lib/types/database.ts`).
- `/contacts` list: default Active filter + search; Contacts | Households tabs; Sheets for create/edit; one-tap **Log Contact** + detailed touch dialog (note + backdate); household **Log all** fan-out.
- `/settings/contacts/lists` — list CRUD + membership (contact XOR household; revive soft-deleted memberships by PK — footgun NEW-D).
- Nav: **desktop sidebar** adds Contacts; mobile tab bar stays at 5 (Contacts like Sermons/Projects).
- Permissions slug `contacts`; audit `_CONTACTS_TABLES` + soft-delete revert + module filter; settings hub card.

## Decided

- **C1** — struck `birthday` before migrate (not needed for meet cadence / Christmas cards; can add later).
- **H1** — singles household-of-one: optional mailing-address section on contact Sheet when no household selected → auto-create household named from contact; also explicit Household Sheet + picker.
- **H2** — block household soft-delete while live members remain (venues/courses pattern).
- **T1** — backdate only on detailed log (one-tap = Chicago today, null note).
- **L1** — seed Christmas cards in migration.
- **Viewer solo waiver** — SELECT wired for `app_has_module_read('contacts')`; writes owner-only; viewer write untested/unsupported v1 (Phase 0).

## Schema changes

- `20260725020000_ppp_contacts_v1.sql` — contacts module tables + profile cadence column + registry + Christmas cards seed.

## New components / patterns added

- `src/lib/components/contact-form-sheet.svelte` — contact create/edit Sheet.
- `src/lib/components/household-form-sheet.svelte` — household create/edit Sheet.
- `src/lib/components/log-contact-dialog.svelte` — detailed touch (note + backdate).
- `src/lib/contacts/` — types, names/cadence helpers, list-member XOR, server loaders/actions; unit tests `__tests__/contacts.test.ts`.

## Open questions surfaced

- C2 — retired members vs Christmas card list filtering (Session 2 / first card-list pass).
- Owner: confirm audit_log row + mobile-width after first UI write.
- Weekly R2 backup dump does not yet include contacts tables — ops follow-up.

## Surprises (read these before the next session)

- Variable name `state` in Sheets shadows Svelte `$state` — use `stateAbbr` for US postal fields.
- Decision number collision with a parallel library essay-bib session — this record is **178**; essay restore filed as [179](179-essay-bib-locus-before-imprint.md).
- `list_contacts_due` MCP stub remains until Session 2 (keep same tool name).

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] tracker Session 1 done
- [x] PLAN.md refreshed (+ Session 2 prompt)
- [ ] new env vars — none
