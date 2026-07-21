# 103 — Library not-owned Session 1: `books.owned` + create-from-queue

**Date:** 2026-07-21
**Module:** library
**Tracker session:** not-owned #1 (Phase 0: [101](101-library-not-owned-session-0.md))

## Built

- Migration `20260721210014_books_owned.sql`: `books.owned boolean NOT NULL DEFAULT true` + partial live index; applied to hosted; types regenerated.
- Default-hide unowned on `/library` list + keyword/essay lanes; `?include_unowned=true` opt-in chip.
- People / series / publisher book counts exclude unowned.
- Review queue + dashboard needs-review count exclude unowned.
- Bibliography / book detail by id remain open to unowned (no filter).
- BookForm + book detail: “In physical library” owned toggle (`updateBookPersonalFields` also patches `owned`).
- Owner settings `/settings/library/not-owned`: curated queue UI + `createNotOwnedStubAction` (title required; author optional; ★/notes carryover; `owned=false`; `needs_review=false`; no ISBN invent).

## Decided

- Corpus “total” count stays owned-only unless Include unowned is on (matches list).
- Stub create matches existing unowned rows by normalized title (idempotent Create → Open stub).
- Matched Goodreads year/publisher proposals remain Session 2+ ([101]).
- Bibliography stub UX polish still later.

## Schema changes

- `20260721210014_books_owned.sql` — `books.owned` + `idx_books_owned_live`.

## New components / patterns added

- `src/lib/library/not-owned-queue.ts` — curated queue const (from brainstorm file).
- `src/lib/library/server/not-owned-actions.ts` — `createNotOwnedStubAction`.
- Routes: `/settings/library/not-owned` (+ nav tab + hub card).

## Open questions surfaced

- None new beyond [101] follow-ups (bib stub UX; viewer RLS smoke; Session 2 matched diffs).

## Surprises (read these before the next session)

- Decision number **103** (102 already used by August Covenant QA).
- Do not invent ISBNs when draining the queue via the UI.

## Carry-forward updates

- [x] components.mdc / AGENTS.md inventory updated
- [x] PLAN.md Session 1 marked done + Next up
- [ ] new env vars — none
- [ ] Owner: drain queue via `/settings/library/not-owned` after deploy
