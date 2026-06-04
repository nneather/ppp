# Personal Operations System — Projects Module: Session 0 (Prep)

_Last updated: 2026-06-03 | Module: Projects (3rd) | Status: **complete** — Session 1 shipped_

Entry point for the projects module kickoff. **Active tracker:** [POS_Projects_Build_Tracker.md](POS_Projects_Build_Tracker.md). **Session 1 decision:** [045-projects-session-1-tree-checkin.md](decisions/045-projects-session-1-tree-checkin.md).

**Schema (applied):** [POS_Schema_v1.md — Projects](POS_Schema_v1.md#projects) · migration `supabase/migrations/20260603170000_ppp_projects_v1.sql` · types `src/lib/types/database.ts`

---

## How to read this doc

Required prereads for **new** sessions (Session 2+):

1. [`AGENTS.md`](../AGENTS.md) — session template, carry-forward inventory (projects helpers).
2. [`docs/POS_Projects_Build_Tracker.md`](POS_Projects_Build_Tracker.md) — current session arc.
3. [`docs/decisions/045-projects-session-1-tree-checkin.md`](decisions/045-projects-session-1-tree-checkin.md) — latest shipped behavior + surprises.
4. [`docs/MODULE_KICKOFF_PLAYBOOK.md`](MODULE_KICKOFF_PLAYBOOK.md) — footgun registry (NEW-A through NEW-D).

For historical Session 0 context, see Phase 0 checklist below (all signed off on the build tracker).

---

## Session 0 acceptance

Session 0 is **complete**:

- [x] **Phase 0 gates signed off** — tracker Phase 0 table.
- [x] **Domain brief** — weekly check-in tree; manual parent health; no roll-up.
- [x] **Schema audit** — `projects`, `project_updates`, `project_links` in v1 migration; `project_tasks` Session 3.
- [x] **Open Questions** — resolved on tracker (P1–P2, U1–U2, X1); D1 deferred to Session 2.
- [x] **Viewer plan** — owner-only v1; SELECT pre-wired via `app_has_module_read('projects')`.
- [x] **`docs/POS_Projects_Build_Tracker.md`** — session arc through Session 3.
- [ ] **`docs/decisions/NNN-projects-session-0-audit.md`** — optional; structure captured in tracker + [045](decisions/045-projects-session-1-tree-checkin.md).

---

## Phase 0 checklist (owner) — signed off

- [x] Taxonomy: one entity + `parent_id`; four seeded root domains
- [x] Nullable/required matrix on tracker
- [x] Metadata = Sheet; weekly health = inline tree
- [x] Viewer waiver + permission-gated SELECT
- [x] No import path

---

## Resolved open questions (see tracker for detail)

| # | Resolution |
|---|------------|
| Primary entity | `projects` + self-referential hierarchy |
| Invoicing link | Standalone v1 (no FK) |
| Library link | No cross-module FK v1; `project_links` for URLs |
| Mobile | Phone-first for weekly check-in |
| Parent health | Manual per node (not computed) |

---

## Carry-forward from invoicing + library

| Need | Use |
|------|-----|
| RLS | `app_is_owner()`, `app_has_module_read('projects')` |
| Soft delete + audit | `deleted_at`, `write_audit_log()` on `projects` / `project_updates`; `project_links` has no soft delete |
| Form actions | `{ kind, success?, message?, <entityId>? }` |
| Metadata form | Sheet (`project-form-sheet.svelte`) |
| Ship gate | Define `npm run ship-projects` when schema stabilizes (pattern: `ship-library`) |
| Staging RLS | Extend `test:rls` matrix when projects policies need automated coverage |

---

## Library module state (do not block projects)

- Trip owner QA signed off — [043](decisions/043-library-trip-qa-signoff-projects-handoff.md).
- Active library work: **Wave 2 (August)** + ad-hoc fixes; PWA performance in a separate thread.
- Tracker: [`POS_Library_Build_Tracker.md`](POS_Library_Build_Tracker.md).
