# 247 — Studies Session 3 (sermon sources + hit rate)

**Date:** 2026-10-19
**Module:** studies
**Tracker session:** Studies Session 3

## Built

- `/studies/sermons/[id]` shares `<StudySourcesPanel>` with paper detail: import, add, groups, usage, compiled bibliography, undo. Sermon metadata stays a Sheet. Creating a sermon navigates to that detail.
- Sets with `default_for` containing `sermon` auto-attach on create as `candidate` rows in a group named after the set. Systematic Theology is the seeded case (18 volumes). An empty include list attaches nothing and does not create a group. Excludes never become rows (`sourcesForDefaultAttach` reads `included` only).
- Sermon form has a Topical checkbox (default off). On keeps the sermon out of hit rate.
- By book shows a papers count that always links to `/studies/papers?bible_book=`. Sermon counts stay all-role.
- Hit rate on commentary rows and on book-detail “Used in.” Numerator is consulted or cited. Denominator is expository studies with a primary passage on that Bible book dated on or after `books.acquired_on`. Essay use counts as the parent book. Archived papers still count. A null or invalid `acquired_on` yields no opportunities.
- Book-detail “Used in” lists live studies that cite this book or one of its essays. One row per study; cited beats consulted beats candidate. Streamed so it does not block the book.

## Decided

- No migration. Session 1 already has sermon XOR, usage, `topical`, passage `role`, `acquired_on`, and `default_for`.
- Paper date is `due_date` when it is `YYYY-MM-DD`, otherwise `created_at`’s civil date. Sermon date is `preached_on`. “Since” is inclusive.
- Set provenance stays the research group name.
- Paper detail loads the paper first, then the shared workspace. That is one extra query before the existing per-source `loadBookDetail` calls.
- By-book and book-detail hit rate are extra round trips in the same class as commentary coverage. Book-detail “Used in” is a streamed promise.
- A collapsed commentary series shows the representative volume’s rate.
- Auto-attach runs for topical sermons too. Hit rate is what drops them.
- Sermon soft-delete does not cascade `study_sources` or the research group. Used-in and hit rate ignore the deleted sermon because the parent query filters `deleted_at`.

## Schema changes

- None.

## New components / patterns added

- `src/lib/components/study-sources-panel.svelte` — shared sources UI. Undo keys `ppp.studies.paper-undo` and `ppp.studies.sermon-undo`.
- `src/lib/studies/study-parent.ts` — paper XOR sermon parent.
- `src/lib/studies/hit-rate.ts` — `computeHitRates`, `formatHitRate`.
- `src/lib/studies/default-attach.ts` — include-only members for auto-attach.
- `src/lib/studies/server/study-workspace.ts` — shared sources/import load.
- `src/lib/studies/server/hit-rate-loaders.ts` — canon facts, coverage rates, book-detail backlinks.

## Open questions surfaced

- B1 still open: `acquired_on` backfill is `created_at::date`. Romans commentaries acquired in 2026 show no rate against 2024–2025 sermons. Parker hand-corrects notable dates.
- Sermon delete leaves source rows. A later pass can cascade them.

## Surprises (read these before the next session)

- Attaching 18 volumes is sequential inserts. Create stays on “Saving…” until they finish, then the list navigates to the detail.
- The live Systematic Theology set has zero excludes, so the smoke attached all 18. Exclude behavior is the unit test (`resolveSetMembers` drops Turretin; only Calvin remains).
- Smoke sermon “Session 3 smoke” (`f2966d97-bbd5-4680-9d32-9be61f5e6649`, Philemon 1, 2026-10-19) was soft-deleted, then its sources, group, and passage were soft-deleted so they would not linger. The set was left unchanged.
- Philemon commentaries showed `0/1` after that sermon and before the delete. Moo’s Colossians and Philemon volume showed “Hit rate Philemon 0/1” and no Colossians line, because those Colossians sermons predate `acquired_on`.

## Verification

- `npm run check` — 0 errors / 0 warnings.
- `npm run test` — 602/602 (7 hit-rate tests, 1 default-attach test).
- Browser, owner session on `localhost:5174`: new sermon landed on the detail with group “Systematic Theology (18),” all Candidate, Copy bibliography disabled. Cycling Turretin vol. I to Consulted enabled Copy bibliography. By book Philemon showed the papers link (0) and commentary rates `0/1`. Book detail Used in listed “Philemon 1 · Sermon · Consulted.” `/studies/papers?bible_book=Philemon` showed the filter chip and the empty state. The smoke sermon was then deleted.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars — none
- [x] tracker Session 3 ticked
