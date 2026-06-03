# 041 — Library module retro (carry-forward to next module)

**Date:** 2026-06-03
**Module:** library
**Tracker session:** retroactive — Sessions 0–9, 8.5, PM review (033), Wave 2 planning

Consolidated lessons from the library build. For the actionable playbook agents and owners use at kickoff, see [MODULE_KICKOFF_PLAYBOOK.md](../MODULE_KICKOFF_PLAYBOOK.md). Invoicing lessons remain in [000-invoicing-retro.md](000-invoicing-retro.md).

## Built (summary)

- Full library module: books CRUD + junctions, scripture references + passage search, faceted filters, Pass 1 import (~1,331 books), review queue, mobile/barcode add, settings (people/series/ancient texts/permissions/publishers), Turabian citations + bibliography, OCR Edge (`ocr_scripture_refs`), PM polish + `ship-library` gate.
- ~45 decision records; tracker at `docs/POS_Library_Build_Tracker.md`.

## What went well (preserve)

- **Decision log + tracker discipline** — Surprises sections made post-hoc analysis possible; delta between plan and reality is captured.
- **Reconcilable import** — spreadsheet-owned vs user-owned fields, dry-run diff, match strategy ([007](007-reconcilable-library-import.md), [008](008-library-pass-1-import.md)).
- **Polymorphic primitives once** — `polymorphic.ts` + `<SourcePicker>` reused across four tables; grep-verified acceptance.
- **Trip-aware sequencing** — research surface before citations; shelf-bound work deferred to August; Session 5.5 prioritized for review-queue drain.

## What could have gone better

### Session 0 did not lock enough structure

- Genre + category dual taxonomy shipped in Session 1, filtered in Sessions 3–5, removed in [022](022-library-category-removal.md).
- Nullable policy (`title`, `genre`, `primary_category_id`) discovered via 1.5b–1.5c hotfixes instead of declared up front for an import-heavy module.
- 30-field form shipped as Sheet, rewritten as dedicated pages in 1.5e — knowable heuristic (> ~15 fields → pages).

### Session 1.5 cascade (patch instances, not classes)

- Eleven polish passes (1.5 → 1.5k); same Svelte 5 `$effect`/dependency footgun three times before generalized as Surprise #17.
- Fix chains (auto-create gate → seed effect re-run) indicate insufficient verify-between-fixes.

### Silent failures

- [037](037-publishers-embed-disambiguation.md): PGRST201 on ambiguous `publishers` embed → loaders returned `[]`, list looked empty.
- [039](039-supabase-postgrest-api-grants.md): missing grants → empty data without surfacing `error`.
- Pattern: destructuring `data` without checking `error`.

### Verification batched at deadline

- Many acceptance rows closed on single "owner smoke 2026-05-16" pass; viewer/RLS rows deferred module-wide.
- Service-role import discovered B1/B2 trigger only at prod apply ([008](008-library-pass-1-import.md) Surprise #9) — would have been caught with `--limit 1` + trigger audit under service-role.

### Workflow gotchas (now documented)

- Immutable migration filenames ([1.5d in 003](003-library-books-vertical-slice.md)) — amended file skipped, `deleted_at` missing on people/series.
- OCR spec evolved across [015](015-library-session-9-ocr-kickoff.md), [021](021-library-session-9-ocr-anthropic-wired.md), [026](026-ocr-density-truncation.md)–[030](030-ocr-pdf-input.md) — some iteration inevitable; sharper upfront input matrix would have helped.

## Recommendations (owner + agents)

| Priority | Recommendation |
|----------|----------------|
| 1 | Run Phase 0 gates in [MODULE_KICKOFF_PLAYBOOK.md](../MODULE_KICKOFF_PLAYBOOK.md) before Session 1 code. |
| 2 | Front-load footgun registry to every session (Svelte `$effect`, Supabase `error`, PostgREST embeds, migrations, service-role). |
| 3 | Agent instruction: root-cause the **class** on every bug fix; update playbook registry when new. |
| 4 | Per-session verification: mobile + error-path + audit_log; not one pre-deadline batch. |
| 5 | High-variance apply: dry-run / `--limit 1` + same role as prod script before full run. |
| 6 | If viewer deferred: one throwaway viewer user once per module for RLS smoke. |

## Decided

- **Next module uses MODULE_KICKOFF_PLAYBOOK.md** as the cross-agent planning artifact; this retro is the library-specific evidence file.
- **Do not renumber or merge** the existing 002–040 library decision records — this file is additive summary only.

## Schema changes

- None (retro document only).

## New components / patterns added

- [docs/MODULE_KICKOFF_PLAYBOOK.md](../MODULE_KICKOFF_PLAYBOOK.md) — Phase 0 gates, footgun registry, agent protocol, per-session DoD.
- [.cursor/rules/module-kickoff.mdc](../../.cursor/rules/module-kickoff.mdc) — Cursor pointer to playbook.

## Open questions surfaced

- None new — carry Wave 2 items on library tracker (megacomponent split, Turabian 20-row QA, essays Q5).

## Surprises (read these before the next module)

- See footgun registry in MODULE_KICKOFF_PLAYBOOK.md — consolidated from 003, 008, 033, 037, 039.

## Carry-forward updates

- [x] MODULE_KICKOFF_PLAYBOOK.md created
- [x] module-kickoff.mdc created
- [x] AGENTS.md pointer added
- [x] PLAN.md — pointer under operating guide
- [x] Next module tracker links this retro + playbook in pre-session reads — [`POS_Projects_Build_Tracker.md`](../POS_Projects_Build_Tracker.md), [`POS_Projects_Session_0.md`](../POS_Projects_Session_0.md)
