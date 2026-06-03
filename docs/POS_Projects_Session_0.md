# Personal Operations System — Projects Module: Session 0 (Prep)

_Last updated: June 3, 2026 | Module: Projects (3rd) | Status: **in progress**_

Entry point for the **first** projects build session. This is **not** the per-session tracker — draft `docs/POS_Projects_Build_Tracker.md` only after Session 0 acceptance (see [MODULE_KICKOFF_PLAYBOOK.md](MODULE_KICKOFF_PLAYBOOK.md)).

**UI today:** `/projects` is a placeholder ([`src/routes/projects/+page.svelte`](../src/routes/projects/+page.svelte)). `projects` exists in `module_registry` and `/settings/permissions` but **no projects tables** are in the baseline schema yet.

---

## How to read this doc

Required prereads, in order:

1. [`AGENTS.md`](../AGENTS.md) — session template, carry-forward inventory, decision log.
2. [`docs/MODULE_KICKOFF_PLAYBOOK.md`](MODULE_KICKOFF_PLAYBOOK.md) — **Phase 0 gates + footgun registry** (read before any schema or CRUD).
3. [`docs/decisions/041-library-module-retro.md`](decisions/041-library-module-retro.md) — latest module lessons.
4. [`docs/decisions/000-invoicing-retro.md`](decisions/000-invoicing-retro.md) — RLS helpers, form-action shape, settings scope.
5. [`docs/POS_Schema_v1.md`](POS_Schema_v1.md) — conventions; **add a Projects section here when Session 0 locks entities**.
6. [`.cursor/rules/module-kickoff.mdc`](../.cursor/rules/module-kickoff.mdc)

Then read this doc.

---

## Session 0 acceptance

Session 0 is **complete** when all of the following are true:

- [ ] **Phase 0 gates signed off** (playbook table): singular taxonomy, nullable matrix, form delivery (sheet vs page), RLS/viewer plan, import/bulk path if any.
- [ ] **Domain brief written** — what “projects” means in ppp (entities, primary workflows, what is explicitly out of scope for v1).
- [ ] **Schema audit** — every new table specified (DDL sketch or migration plan); ≤2 open questions per major entity.
- [ ] **Open Questions** on the projects tracker driven down; remainder deferred with target session.
- [ ] **Viewer plan** — seed + curl/UI smoke, or explicit waiver on tracker (solo-use pattern from library is acceptable if documented).
- [ ] **`docs/POS_Projects_Build_Tracker.md` drafted** — session arc reviewed by owner before Session 1 code.
- [ ] **`docs/decisions/NNN-projects-session-0-audit.md` filed** per AGENTS.md template.

Do **not** start Session 1 (first vertical slice) until the tracker exists and the owner has reviewed it.

---

## Phase 0 checklist (owner)

Copy from [MODULE_KICKOFF_PLAYBOOK.md](MODULE_KICKOFF_PLAYBOOK.md); sign off here or on the tracker pre-session block:

- [ ] Taxonomy table: one row per axis, no duplicate encodings
- [ ] Nullable / required matrix for every column on the primary entity
- [ ] Form surfaces listed with route vs sheet decision
- [ ] Viewer user + `user_permissions` seed plan (or written waiver)
- [ ] Import/bulk path: `auth.uid()` under service-role documented (if applicable)
- [ ] Open Questions ≤2 unresolved per entity

---

## Open Questions (seed list — resolve in Session 0)

| # | Question | Owner | Target |
|---|----------|-------|--------|
| 1 | What is the **primary entity** — project, task, milestone, or something else? | Owner | Session 0 |
| 2 | Relationship to **invoicing** — link time entries / clients to projects, or standalone? | Owner | Session 0 |
| 3 | Relationship to **library** — cite books per project, or no cross-module FK in v1? | Owner | Session 0 |
| 4 | **Mobile vs desktop** — is phone-first required for v1 (like library trip), or desktop-OK? | Owner | Session 0 |
| 5 | **Hard deadline** — fall semester, HeLOS ship date, or open-ended? | Owner | Session 0 |

_Add rows as Session 0 discovers gaps. Do not start migrations until Q1–Q2 are resolved._

---

## Carry-forward from invoicing + library

| Need | Use |
|------|-----|
| RLS | `app_is_owner()`, `app_is_viewer_writer('projects')` |
| Soft delete + audit | `deleted_at`, `write_audit_log()` trigger on every table |
| Form actions | `{ kind, success?, message?, <entityId>? }` |
| Large forms | Dedicated `/projects/.../new` + `/[id]/edit` pages, not Sheet |
| Ship gate | Define `npm run ship-projects` when schema + Edge exist (pattern: `ship-library`) |
| Staging RLS | `npm run test:rls` after tables exist ([042](decisions/042-rls-smoke-staging-harness.md)) |

---

## Library module state (do not block Session 0)

- Trip owner QA signed off — [043](decisions/043-library-trip-qa-signoff-projects-handoff.md).
- Active library work: **Wave 2 (August)** + ad-hoc fixes; PWA performance in a separate thread.
- Tracker: [`POS_Library_Build_Tracker.md`](POS_Library_Build_Tracker.md).
