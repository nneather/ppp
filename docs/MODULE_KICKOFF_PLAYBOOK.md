# Module Kickoff Playbook — ppp

**Purpose:** Pre-flight checklist and agent-collaboration protocol for starting a new module. Distilled from the invoicing retro ([000-invoicing-retro.md](decisions/000-invoicing-retro.md)) and the library build ([041-library-module-retro.md](decisions/041-library-module-retro.md)).

**How to use:**

- **Cursor:** loaded via [.cursor/rules/module-kickoff.mdc](../.cursor/rules/module-kickoff.mdc) — read this file at Session 0 and before planning a new tracker.
- **Claude.ai / other agents:** paste or attach this file at module kickoff alongside `AGENTS.md` and the module tracker.
- **Owner:** work through Phase 0 checkboxes before Session 1 code; add new footguns to the registry at every module retro.

---

## Phase 0 — Lock STRUCTURE before any code

Session 0 is not just a schema audit. It must produce signed-off answers to these — each one churned mid-build in a prior module:

| Gate | Why it matters |
|------|----------------|
| **Taxonomy is singular** | No two columns/tables encoding the same axis. Library shipped genre *and* category, then tore category out ([022](decisions/022-library-category-removal.md)). |
| **Nullable policy per column** | Import-heavy modules: default to nullable + `needs_review`, not required. Library made `title` / `genre` / `primary_category_id` nullable in three hotfix migrations (1.5b–1.5c) after the form shipped. |
| **Form delivery by field count** | > ~15 fields → dedicated `/new` + `/[id]/edit` pages, never a Sheet. Library built a 30-field `<BookFormSheet>`, then rewrote as pages in 1.5e. |
| **RLS + viewer path planned** | Even solo: decide whether viewer/service-role paths are tested or explicitly accepted as a known gap. Untested B1/B2 trigger blocked service-role import ([008](decisions/008-library-pass-1-import.md) Surprise #9). |
| **Schema audit: ≤2 open questions per major entity** | Invoicing retro: incomplete schema doc surfaced fields mid-build. Session 0 must close gaps before Session 1. |
| **Edge Function ↔ app `deleted_at`** | App filters parents by `deleted_at IS NULL`; Edge Functions must not, or historical artifacts break. |

**Phase 0 checklist (owner signs off):**

- [ ] Taxonomy table: one row per axis, no duplicate encodings
- [ ] Nullable / required matrix for every column on the primary entity
- [ ] Form surfaces listed with route vs sheet decision
- [ ] Viewer user + `user_permissions` seed plan (or written waiver)
- [ ] Import/bulk path: `auth.uid()` under service-role documented
- [ ] Open Questions on tracker ≤2 unresolved per entity

---

## Footgun registry (give agents these UP FRONT)

Paid-for lessons. Append new entries at every module retro.

| # | Rule | Source |
|---|------|--------|
| 1 | **Svelte 5 `$effect` deps.** Any state read inside an init/seed `$effect` — even `.length` — joins the dep set and re-fires, wiping input. Wrap probes in `untrack(() => ...)`. | Library 1.5c, 1.5g, 1.5h |
| 2 | **Always check `error` on Supabase calls.** `{ data }` without `error` turns `42501` / `PGRST201` into silent empty lists. | [037](decisions/037-publishers-embed-disambiguation.md), [039](decisions/039-supabase-postgrest-api-grants.md) |
| 3 | **PostgREST multi-FK embeds.** Two FKs to one parent breaks unqualified `parent (...)`. Use `parent!constraint_name (...)`. | [037](decisions/037-publishers-embed-disambiguation.md) |
| 4 | **Migrations are immutable by filename.** Editing an applied migration is skipped (`schema_migrations`). Always add a NEW migration. | Library 1.5d |
| 5 | **`auth.uid()` is NULL under service-role.** Bulk imports: plan `changed_by` patch; drop owner-only columns from service-role UPDATE payloads. | [008](decisions/008-library-pass-1-import.md) Q10 |
| 6 | **Hosted-only Supabase.** No `supabase start` / local Docker / `db reset` unless owner opts in. Schema via `db push`; module ship via `npm run ship-<module>:apply` when defined. | [supabase/README.md](../supabase/README.md) |
| 7 | **`$bindable` on custom elements.** Lowercase tags break `bind:open`; use PascalCase component tags. | [033](decisions/033-library-pm-review-may-2026.md) |
| 8 | **API grants on every new table.** Explicit `GRANT`s in migration; don't rely on Dashboard auto-expose. | [039](decisions/039-supabase-postgrest-api-grants.md), `db-changes.mdc` |

---

## Agent collaboration protocol

### Session start (paste into chat)

```
Module kickoff: read docs/MODULE_KICKOFF_PLAYBOOK.md (footgun registry + Phase 0).
Session: <module> #N — <name>
Tracker: <path>, Session N
Goal: <one sentence>
Root-cause rule: when fixing a bug, name the CLASS and where else it occurs; update the footgun registry if new.
```

### During the session

- **Root-cause the class, not the instance.** When a bug is fixed, answer: "What category is this, and where else does it occur?" Write the rule, not only the patch. (The library 1.5 cascade was one Svelte `$effect` footgun hit three times.)
- **One fix at a time, verify, then proceed.** Fix chains (1.5f → g → h) mean moving without confirming. Pause after each fix.
- **Front-load the footgun registry** at session start — not after the agent trips.
- **Big diffs → read-only review.** Commits >400 LOC under `src/lib/<module>/` or `src/lib/components/`: mobile + RLS + regression pass before push ([AGENTS.md](../AGENTS.md)).

### What to push back on

- Agent proposes a second taxonomy axis "for later" — resolve in Session 0 or defer the feature, don't ship two axes.
- Agent ships a Sheet for a large entity form — reject; use dedicated pages per Phase 0.
- Agent returns empty data without explaining `error` — require explicit error handling in loaders/actions.
- Agent amends an existing migration filename — reject; new migration only.

---

## Testing cadence — per session, not per deadline

Do not bank verification for one pre-deadline sitting (library batched into "owner smoke 2026-05-16").

**Each session, before marking done:**

- [ ] `npm run check` (+ `npm run test` when logic changed)
- [ ] One mobile-width pass on any new surface
- [ ] One **error-path** check (force 403 or bad embed; confirm UI shows failure, not blank)
- [ ] `audit_log` row for an example write
- [ ] New table: viewer/RLS verified **or** logged as known gap on tracker

**High-variance sessions (import, migration, Edge):**

- [ ] `--limit 1` or dry-run apply before full prod run
- [ ] RLS/trigger interaction verified under the same role the script uses (service-role vs authenticated)

**RLS on ppp-staging:** `npm run test:rls:ensure-users` then `npm run test:rls` — see [scripts/rls-smoke/README.md](../scripts/rls-smoke/README.md). Does not replace phone/UI runbook checks.

---

## Definition of done (per session)

- [ ] Tracker session row marked done with notes
- [ ] `docs/decisions/NNN-<slug>.md` filed ([template in AGENTS.md](../AGENTS.md#template))
- [ ] Surprises section written (even "none")
- [ ] New reusable component → `components.mdc`; new DB gotcha → `db-changes.mdc` or footgun registry above
- [ ] New env vars documented in the decision record
- [ ] `PLAN.md` updated before stopping

---

## Keep doing (worked well — do not regress)

- Decision-log per session with a **Surprises** section.
- Grep-verified reuse acceptance ("zero new polymorphic code" — library Session 2/5).
- Reconcilable-by-design imports: field-ownership table + dry-run diff ([007](decisions/007-reconcilable-library-import.md)).
- Component-investment-then-reuse (build primitive once, reuse N times).
- Deadline reframing around the real constraint (library: shelf access vs keyboard time).
- Trip-aware sequencing: front-load the workflow you'll actually use first.

---

## Next module starter checklist

When opening a new `docs/POS_<Module>_Build_Tracker.md`:

1. Copy pre-session checklist from this playbook into the tracker.
2. Link invoicing retro + latest module retro in "Read before any session."
3. Define Session 0 explicitly (schema audit + Phase 0 gates above).
4. Add per-session viewer/RLS line — not a single deferred row at the bottom.
5. Add `npm run ship-<module>` when the module has schema + Edge (pattern: `ship-library`).
6. File `docs/decisions/NNN-<module>-session-0-audit.md` before Session 1 code.

**Active module (2026-06-03):** [POS_Projects_Session_0.md](POS_Projects_Session_0.md) + [POS_Projects_Build_Tracker.md](POS_Projects_Build_Tracker.md) (draft tracker; arc filled at Session 0 end).
