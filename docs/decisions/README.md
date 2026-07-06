# Decision log

One file per build session, filed at session end. Used as input to the *next* session's Session 0 audit.

## Naming

`NNN-short-slug.md` — zero-padded sequence, kebab-case slug.

- `001-app-shell.md`
- `002-time-entries.md`
- `010-library-books-vertical-slice.md`

Numbers are global across modules (not per-module) so the log reads chronologically.

**Before filing:** `ls docs/decisions/ | sort` and take the next free number. Numbers `051+` are collision-free; when referencing an entry below, include enough slug to disambiguate.

## Known numbering collisions (frozen — do not renumber)

Duplicates from parallel sessions; renumbering would break decision IDs baked into commit messages and cross-links. Disambiguate by slug:

| Number | Files |
|---|---|
| 004 | `004-invoice-number-drift-hotfix.md` · `004-library-scripture-references-wiring.md` |
| 005 | `005-app-wide-hotkeys.md` · `005-scripture-refs-bulk-and-ocr-design.md` |
| 027 | *(unused — gap, not a missing file)* |
| 033 | `033-library-pm-review-may-2026.md` · `033-performance-pass.md` · `033-publishers-settings.md` |
| 047 | `047-projects-session-3-myn-tasks-links-audit.md` · `047-projects-status-appearance.md` (cited as **047b**) |

## Template

See [AGENTS.md](../../AGENTS.md#template) for the canonical template. Copy it into a new file and fill in.

## What goes here vs. the tracker

- **Tracker** = forward-looking plan: what we will build, in what order, with what acceptance criteria.
- **Decision log** = backward-looking record: what we actually shipped, what we decided, and what bit us.

The decision log captures the *delta* between the tracker and reality. That delta is the most valuable input the next module has.

## Reading order at session start

Read the latest 3 entries before starting a new session. They contain the schema gotchas, RLS surprises, and component patterns that the rule files have not yet absorbed.

## Module retros and kickoff

- [041-library-module-retro.md](041-library-module-retro.md) — consolidated library lessons (2026-06)
- [MODULE_KICKOFF_PLAYBOOK.md](../MODULE_KICKOFF_PLAYBOOK.md) — Phase 0 gates, footgun registry, agent protocol for the **next** module
- [042-rls-smoke-staging-harness.md](042-rls-smoke-staging-harness.md) — `npm run test:rls` on ppp-staging
- [044-pwa-responsiveness.md](044-pwa-responsiveness.md) — PWA nav/search perf pass (2026-06)
