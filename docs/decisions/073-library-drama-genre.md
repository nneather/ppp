# 073 — Library Drama genre

**Date:** 2026-07-08
**Module:** library
**Tracker session:** Ad-hoc — follow-on from [070](070-library-genre-taxonomy-audit.md) + stale review-picker deploy

## Built

- **Added `Drama` to the closed genre taxonomy** (47 values, was 46): stage plays, play collections, and drama anthologies — mirrors the existing `Poetry` split from `Literature`.
- **Migration `20260708120000_library_drama_genre.sql`**: extends `books_genre_check`; backfills **11** live `Literature` rows (Shakespeare annotated editions, Elizabethan/Continental/Greek drama anthologies, Marlowe, etc.); updates **3** pending Research proposals (`A Raisin in the Sun`, `Lysistrata and Other Plays`, `Three Theban Plays`) from proposed `Literature` → `Drama`.
- **OL prefill heuristic** (`open-library-prefill.ts`): conservative subject match for drama/plays/Shakespeare/Marlowe (tested after theology rules).
- **AI research prompt** (`proposeMetadata.ts`): one rule line — plays → `Drama`; excludes playbook-style leadership titles by instruction.
- **Shipped uncommitted 070 taxonomy code** so deployed `GENRES` matches the hosted DB (46-value constraint already live; app was on pre-070 commit `24b15e2`).

## Decided

- **`Drama` is warranted at ~14-book scale** — comparable to `Poetry` (14 live). Owner examples (*Annotated Shakespeare*, *A Raisin in the Sun*) were tagged or proposed as `Literature` because the AI classifier had no Drama bucket ([070](070-library-genre-taxonomy-audit.md) prompt: fiction/poetry only).
- **`*The Hollow Crown: Shakespeare on How Leaders Rise*`** stays `Literature` (proposal unchanged) — leadership book *about* Shakespeare, not a play text.
- **No `REVIEW_TOP_GENRES` change** — Drama appears in Genre Sprint "More…", not the top-8 chip row.

## Schema changes

- `20260708120000_library_drama_genre.sql` — `books_genre_check` + 11 book backfill + 3 proposal JSONB updates.

## New components / patterns added

- None.

## Open questions surfaced

- Optional: targeted `library:review-research` re-run on remaining null-genre backlog to catch play titles the id-list backfill missed.

## Surprises (read these before the next session)

- **Deploy drift was the stale-picker root cause** — hosted Postgres had all 070 migrations applied while Vercel still served pre-070 `GENRES` (included removed `Pastoral`, missing NT/OT sub-genres). Always push app code after `db push` when taxonomy changes.

## Carry-forward updates

- [ ] components.mdc updated — n/a
- [ ] AGENTS.md inventory updated — n/a
- [ ] new env vars documented — n/a
- [ ] tracker Open Questions updated — n/a
