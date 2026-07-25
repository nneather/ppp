# 181 — Contacts smoke product locks (Lists tab, cadence units, touch kinds)

**Date:** 2026-07-25
**Module:** contacts / CRM
**Tracker session:** Owner smoke (partial) + product discovery → Session 3 prompt

## Built

- Owner smoke (Sessions 1–2): **UI path cleared** except MCP client reload / manual MCP smoke (parked). Checklist ticks in [POS_Contacts_Build_Tracker.md](../POS_Contacts_Build_Tracker.md).
- No code this session — product locks only; Session 3 builds them.

## Decided

- **Cadence stays on the person** — not list-driven. Lists remain rosters (Christmas cards / future email); meet frequency is a relationship override on `contacts`. Rejected: list membership as source of truth for due intervals (dual membership ambiguous; conflates roster vs reminder policy).
- **Cadence UI units = months or years** (not free-form days). Profile default + per-contact override still apply; storage may remain day-equivalent under the hood or `{amount, unit}` — Session 3 pick. Rejected: keeping a days spinner as the primary control.
- **Lists as third tab on `/contacts`** — Contacts | Households | **Lists** (browse membership + actions). Replace the single “Manage Christmas card lists →” settings deep-link as the primary surface. Settings list CRUD may remain or fold into the tab — Session 3 pick. Aligns with schema already supporting multiple lists.
- **Person touches unchanged in spirit:** one-tap Log Contact + detailed (note; backdate stays detailed-only per T1). Already shipped Session 1.
- **Christmas card bulk log at send time** — on the Lists / Christmas cards surface: one-tap + detailed that fan out to every live member of every household **currently** on the list (list-wide analogue of household Log all). **Not** the mailing-list email send pipeline (still deferred).
- **Touch kind B:** card send ≠ meet. Due-to-meet / `list_contacts_due` must ignore card touches. Requires a `kind` (or equivalent) on `contact_touches` — e.g. `meet` (default for existing Log Contact / Log all) vs `card`. Rejected: card logs resetting meet cadence via undifferentiated `contact_touches`.

## Schema changes

- None applied this session. Session 3 expected: migration for touch `kind` (+ cadence unit presentation / possible column reshape); regenerate `database.ts`.

## New components / patterns added

- None (docs only).

## Open questions surfaced

- Session 3: store cadence as days-under-the-hood vs explicit unit columns; whether `/settings/contacts/lists` survives after the Lists tab.
- Owner still owes MCP smoke (reload `ppp` + `list_contacts_due` / `search_contacts`).

## Surprises (read these before the next session)

- Smoke feedback landed before Lists UX existed — building Lists tab + card bulk log together avoids teaching the settings-only path.
- Phase 0 “cadence_days” / undifferentiated touches are **amended** by this record; tracker Session 3 + PLAN prompt are authoritative for the next build.

## Carry-forward updates

- [x] Tracker smoke ticks + Session 3 row + Phase 0 note pointers
- [x] PLAN.md — smoke prompt trimmed; Session 3 prompt live; Recent decisions
- [x] components.mdc / AGENTS.md — updated in [182](182-contacts-session-3-lists-cadence-touch-kinds.md)
- [ ] new env vars — none
