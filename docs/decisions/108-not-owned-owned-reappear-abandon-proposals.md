# 108 — Not-owned: owned reappear fix + abandon Goodreads matched proposals

**Date:** 2026-07-21
**Module:** library
**Tracker session:** not-owned polish (after [107](107-not-owned-pending-inbox-dismiss.md))

## Built

- Queue match now uses **any live book by title** (not only `owned=false`). Marking a stub owned no longer returns it to Pending; it stays under **In library**.
- Create-stub idempotency uses the same any-live-book check (avoids duplicate rows).
- Settings archive label: **In library** (owned vs unowned stub caption).
- Data fix: *Letters to Children* → C.S. Lewis (author) + Lyle Dorsett (editor); `work_type=edited_volume`. Queue const + brainstorm note updated.

## Decided

- **Abandon** not-owned Session 2+ Goodreads matched year/publisher → `book_metadata_proposals` workstream. No further major Goodreads import expected; remaining metadata is one-offs. Bibliography stub UX polish stays optional/backlog only if needed — not a planned session.
- Rejected: keep Session 2 on PLAN as deferred forever (remove instead so Next up stays honest).

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Matching only unowned books made “Create → mark owned” look like a regression (row reappeared as Create stub).

## Carry-forward updates

- [x] PLAN.md Next up / Session prompts refreshed (Session 2+ removed)
- [ ] components.mdc — n/a
