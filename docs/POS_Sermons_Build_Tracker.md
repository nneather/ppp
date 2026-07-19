# Personal Operations System — Sermons Module Build Tracker

_Last updated: 2026-07-19 | Module: Sermons (4th) | Session 1 complete; Session 2 grilled_

**Read before any session:** `docs/MODULE_KICKOFF_PLAYBOOK.md`, [090](decisions/090-sermons-session-0.md), [091](decisions/091-sermons-session-1.md), grill [brainstorms/2026-07-17-commentary-sermon-stats-dashboard.md](../brainstorms/2026-07-17-commentary-sermon-stats-dashboard.md).

---

## Critical path

Core value — **log sermons preached (including date-only drafts) and jump to library coverage for the passage**.

- **End of Session 1** = list + Sheet CRUD + venues settings + seed history + Find-in-library links.
- **Session 2** = `/sermons/by-book` — Bible-book spine: sermons × commentaries (4★+) × Also on shelf (grill locked).

---

## Phase 0 — Structure Lock (signed off 2026-07-17)

| Gate | Resolution |
|---|---|
| **Taxonomy singular** | Occasion = `sermons.context_type`. Venue = `sermon_venues`. Passage human = `passage_display`. Passage structured = `sermon_passages`. Topic + notes free text. |
| **Nullable / required** | Only `preached_on` required. All other sermon fields nullable. Passage rows require `bible_book`. |
| **Form delivery** | Sheet for create/edit. List at `/sermons`. Venues at `/settings/sermons/venues`. |
| **RLS + viewer** | Owner write; SELECT via `app_has_module_read('sermons')`. Viewer write **waived** v1. |
| **Import** | One-shot seed in migration. |
| **Edge Function ↔ `deleted_at`** | N/A. |

**Checklist:**
- [x] Taxonomy singular
- [x] Nullable matrix signed
- [x] Sheet vs page decided
- [x] Viewer waiver written
- [x] Open Questions ≤2 per entity

---

## Open questions

| # | Entity | Q | Resolution |
|---|---|---|---|
| V1 | venue | Soft-delete when sermons reference? | Block delete while live sermons reference (series pattern). |
| P1 | passage | Multi-ref Proverbs? | Multiple `sermon_passages` + full string in `passage_display`. |

---

## Session arc

| Session | Status | Goal |
|---|---|---|
| 0 | ✅ | Phase 0 + tracker + [090](decisions/090-sermons-session-0.md) |
| 1 | ✅ | Schema + seed + `/sermons` + Sheet + venues settings + library deep-link + nav/audit — [091](decisions/091-sermons-session-1.md) |
| 2 | ⬜ | `/sermons/by-book` commentary × sermon stats — grill [brainstorms/2026-07-17-commentary-sermon-stats-dashboard.md](../brainstorms/2026-07-17-commentary-sermon-stats-dashboard.md); PLAN Session prompt |

---

## Seed venues (deduped)

F&M InterVarsity · Timothy Foundation · Res Pres Madison · Covenant Seminary · Lancaster, PA · Mt. Zion Presbyterian · Marissa Presbyterian · Sutter Presbyterian · Grandcoate Presbyterian

Draft rows: 2026-09-10 and 2026-09-24 Academic (date + context only).
