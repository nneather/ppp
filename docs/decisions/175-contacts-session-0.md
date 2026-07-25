# 175 — Contacts Session 0 (Phase 0 structure lock)

**Date:** 2026-07-24
**Module:** contacts / CRM
**Tracker session:** Session 0

## Built

- Phase 0 structure lock for the contacts / lightweight CRM module — all gates answered by owner via structured questions; nothing invented by the agent.
- Tracker: [POS_Contacts_Build_Tracker.md](../POS_Contacts_Build_Tracker.md) (schema sketch, nullable matrix, MCP contracts, session arc).
- No code, no migration — `npm run check` N/A this session (docs only).

## Decided

- **New module** (`contacts`) — hard constraints from [139](139-lightweight-crm-fall-priority.md) hold: never overload library `people` (authors) or invoicing `clients` (billing). Optional link FK later only if owner asks.
- **Two core tables:** `contacts` + `households`. Owner rationale: friends marrying now need merge into households; occasional splits; 1:1 outreach vs invites/Christmas cards serve different purposes (rejected: single relationship-unit row; plain-text household label only).
- **Cadence:** interval on the **person** — nullable `contacts.cadence_days` → `profiles.contact_cadence_days_default` → app constant. Never on households; a household touch fans out touch rows to all members (rejected: explicit `next_touch_on` only; hybrid override).
- **Touch history day one:** `contact_touches` (`touched_on` + nullable `note`). UI must ship one-tap "Log Contact" **and** a detailed path — detail-only kills usage (rejected: denormalized `last_contact_on` only).
- **Two lifecycle axes:** `no_reminders` (exclude from due list; still active / card-eligible — close family) + `status` `active`/`retired` (moved away). Default filter = Active.
- **Lists day one:** `contact_lists` + `contact_list_members`; Christmas cards = first list. Membership = contact **XOR** household (`validateXor` / library polymorphic pattern) — card list holds households; future email lists hold people (rejected: boolean flag migrate later; tags text[]).
- **Names:** `first_name` NOT NULL + nullable `last_name` on contacts; envelope name on `households.name` (rejected: single display-name field).
- **Address:** structured (line1/2, city, state, postal, country) on **households only**; contacts carry single `email` + `phone`. Singles who get mail = household of one — create flow must be clean (H1) (rejected: address on both; text-block mailing address; emails text[]).
- **Surfaces:** `/contacts` list + Sheets + dashboard "due to meet" (desktop card + mobile glance). Desktop sidebar only — mobile tab bar stays at 5. Lists at `/settings/contacts/lists`.
- **RLS:** projects/classwork precedent — SELECT via `app_has_module_read('contacts')`, writes owner-only. **Solo waiver:** viewer write untested/unsupported v1.
- **MCP day one:** `list_contacts_due` (real implementation replaces the [144](144-ppp-mcp-readonly-v1.md) stub, **same tool name**) + `search_contacts`. `christmas_card_list` rejected. Implementation deferred to Session 2.
- **Naming:** slug / route / table prefix `contacts` everywhere (rejected: `crm`, `ministry`).

## Schema changes

- None in Session 0 (Session 1 ships `ppp_contacts_v1` per the tracker sketch).

## New components / patterns added

- [docs/POS_Contacts_Build_Tracker.md](../POS_Contacts_Build_Tracker.md) — tracker with signed Phase 0 lock.

## Open questions surfaced

- ≤2-ish per entity on tracker: H1 singles household-of-one UX, H2 household soft-delete with members, C1 birthday keep/strike, C2 retired members vs card list, T1 backdating (detailed only), L1 seed Christmas cards list.

## Surprises (read these before the next session)

- Decision number **174** was claimed mid-session by a parallel library write ([174-everlasting-man-original-1925](174-everlasting-man-original-1925.md)) — this record is **175** (same pattern as classwork Session 0 → [150](150-classwork-session-0.md)).
- `list_contacts_due` already registered as an MCP stub — Session 2 must keep the **same tool name** (classwork `list_due_soon` precedent).
- Mobile tab bar is already at 5 items (Dashboard / Tasks / Invoicing / Library / Classwork) — Contacts is desktop-sidebar + dashboard glance only, like Sermons/Projects.
- `user_permissions.module` is free TEXT — add `contacts` to the permissions UI slug list only (same as [090](090-sermons-session-0.md) / [150](150-classwork-session-0.md)).
- Partial unique on `contact_list_members` hits footgun NEW-D — revive soft-deleted memberships by PK, not PostgREST `onConflict`.
- `npm run check` N/A — docs-only session, no code touched.

## Carry-forward updates

- [x] Tracker filed with signed Phase 0 checkboxes
- [x] PLAN.md refreshed (module row, Next up, Session 1 prompt)
- [x] MODULE_KICKOFF_PLAYBOOK.md active-module pointer updated
- [ ] components.mdc — n/a (no components yet)
- [ ] AGENTS.md inventory — n/a until Session 1 code
- [x] new env vars — none
