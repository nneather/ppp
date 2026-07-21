# 101 — Library not-owned / research stubs Session 0

**Date:** 2026-07-21
**Module:** library
**Tracker session:** Session 0 (Phase 0 structure lock; no code)

Capture: [brainstorms/2026-07-21-library-not-owned-session-0.md](../../brainstorms/2026-07-21-library-not-owned-session-0.md). Queue (do not create rows until Session 1): [brainstorms/2026-07-17-goodreads-not-owned-queue.md](../../brainstorms/2026-07-17-goodreads-not-owned-queue.md). Prior: [089](089-book-rating-ui-goodreads-import.md), [093](093-goodreads-triage-execution.md).

## Built

- Phase 0 structure lock for `books.owned` + hide-from-search defaults + selective create-from-queue. **No schema or UI shipped this session.**

## Decided

### Taxonomy / schema
- **`books.owned boolean NOT NULL DEFAULT true`** — singular axis. Existing rows backfill to owned; research/not-owned stubs = `false`. Rejected: `research_stub` (inverted synonym), dual flags, acquisition enum (premature).

### List / search / counts
- **Default hide unowned** on `/library` (incl. keyword `q` and essay search lanes).
- **Also exclude unowned** from people / series / publisher book counts unless an explicit include-unowned filter is on.
- Direct `/library/books/[id]` always works.

### Bibliography + review
- **Bibliography includes unowned** by default (cite books you don’t own).
- **Review queue excludes unowned** by default (shelf/metadata cleanup only).
- **Follow-up (not Session 1):** bibliography UX so stubs behave correctly (selection, labeling, incomplete-citation hints).

### Create-from-queue
- **Minimal stub:** `title` required; author optional (find-or-create); genre/year/publisher/ISBN nullable.
- Carry Goodreads ★ → `rating` and My Review / Private Notes → `personal_notes` when present.
- **`needs_review = false`** on create; never invent ISBN.
- **`owned = false`** at create; BookForm/detail toggle to `true` when a physical copy arrives.
- **Surface:** dedicated **`/settings/library/not-owned`** seeded from the curated queue file — not Goodreads CSV re-upload, not full BookForm Sheet.

### Matched-row field diffs (Session 2+)
- Year / publisher diffs from Goodreads → pending **`book_metadata_proposals`** (reuse [068](068-library-review-ai-research-pass.md) confirm path).
- **ISBN diffs informational only** — never proposed, never overwrite live ISBN.
- Out of Session 1 scope.

### RLS / viewer
- Owner-only writes (create stub, toggle owned, future proposal generation).
- Viewers with library read: **same owned-only default** as owner (opt-in include if filter UI exists).
- Viewer RLS smoke for the filter: **waived** as known gap until a collaborator (consistent with other library viewer deferrals).

### Scope splits
- **Session 1:** migration + loader/filter defaults + owned toggle + `/settings/library/not-owned` create-from-queue.
- **Session 2+:** Goodreads matched year/publisher → proposals; bibliography stub polish.
- **Harvard Classics full essay breakout:** **deferred** to PLAN backlog only ([093](093-goodreads-triage-execution.md)) — orthogonal; not in Session 1.

### Non-negotiable
- **Do not create library rows from the not-owned queue until Session 1 (`owned`) ships.**

## Schema changes

- None this session. Session 1 will add `books.owned boolean NOT NULL DEFAULT true` (+ comment; no RLS policy change beyond existing `books` policies).

## New components / patterns added

- None yet. Session 1 expected: compact not-owned settings list + create action; `owned` on BookForm/detail; `includeUnowned` (or equiv) on `BookListFilters` / count loaders.

## Open questions surfaced

- Bibliography stub UX correctness — later session after owned ships.
- Viewer RLS matrix coverage for owned filter — deferred known gap.
- Session 2 matched-diff UX details (Goodreads settings vs Research deck only) — lock at Session 2 start.

## Surprises (read these before the next session)

- None — structure-only session. Queue remains file-only until Session 1.
- Branch note: Session 0 ran while workspace branch was `library-add-books-skill`; decision/PLAN updates are docs-only and independent of that worktree feature.

## Carry-forward updates

- [x] Phase 0 gates signed off (capture + this decision)
- [x] PLAN.md Session 1 prompt + Next up refreshed
- [ ] components.mdc / AGENTS.md — Session 1 when helpers land
- [ ] new env vars — none expected
