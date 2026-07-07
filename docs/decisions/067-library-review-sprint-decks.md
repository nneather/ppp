# 067 — Review queue: sprint decks + live burndown (gamification Session A)

**Date:** 2026-07-06
**Module:** library
**Tracker session:** Ad-hoc — review-queue improvement ([064](064-usage-retrospective-review.md) Q3, Session A of two)

## Built

- **Deck picker** replaces the flat slice-pill rail on `/library/review` — six routed decks with live counts: Citation Critical (27), Genre Sprint (585), Research (AI proposals — hidden until Session B populates), Puzzles (no OL match + no ISBN, 119), Backlog (728), Needs the shelf (44, hidden when 0). Deck specs + routing in `src/lib/library/review-decks.ts`; `<ReviewDeckPicker>` renders.
- **Away-from-shelf default:** page load + queue refill endpoint inject `shelf=exclude` when the URL has no `shelf` param, so the 44 "verify at shelf" books never surface mid-flow from Madison. `?shelf=only` is the shelf deck; `?shelf=all` opts out.
- **Genre Sprint fast lane** (`?missing=genre`): books whose ONLY citation-critical gap is genre (title/year/publisher present). Compact card — no Turabian blocks, no quick-edit inputs — one tap on a genre chip (`<ReviewGenreChips>`: top-8 shelf genres + More…) sets the genre and submits. Sticky bar keeps Confirm as-is + Skip; swipe still works.
- **Sprint loop:** pick 5 / 10 / 25 before (or mid-) flow; progress ring in the header (`<ReviewSprintHud>`); end-of-sprint summary card (`<ReviewSprintSummary>`: cleared / skipped / elapsed / N left + "Go again"). State in localStorage `library.review.sprint`; abandoning is silent — no failure state by design.
- **Live burndown:** the header bar now derives cleared-in-slice from the locally decremented `remaining` (`liveSliceCleared`) instead of the server snapshot, so it ticks on every confirm. Server no longer returns `sliceCleared`.
- **Milestones:** one-time interstitials (`<ReviewMilestoneCard>`) at 25/50/75/100% of the active slice + every 100 lifetime clears; shown-set in localStorage `library.review.milestones`. Positive framing only ("Half of Citation Critical verified"), per the 031 ethics fence.
- **Shuffle toggle** (`?shuffle=1`): refills draw from a random UUID pivot window (wrap-around second query) instead of `id ASC` from the top — variety without a COUNT round-trip.
- Unit tests: `review.test.ts` (new URL params, shelf default), `review-decks.test.ts` (routing, active-deck detection, slice crediting), `turabian/__tests__/review-progress.test.ts` (milestone keys/labels, sprint state with a fake localStorage).

## Decided

- **Kolbe fence holds** ([064] Q-answer, re-confirmed this session): no streaks, XP, daily goals, or leaderboards. The game is pick-your-size sprints + a denominator that visibly fills. Rejected: "weeks active" pseudo-streaks.
- **Free flow = no sprint state**, not a `target: null` sprint. The picker offers 5/10/25 and the phrase "or just flow"; anything else is the default behavior. Rejected: a fourth "Free" button that starts a target-less sprint (identical to doing nothing).
- **Shelf marker is the word `shelf` (ILIKE), not `Deferred shelf-check:`.** The importer's structured prefix did not survive later metadata passes — prod notes are free text ("verify at shelf", "Shelf-check pending"). Verified against all 44 rows; structured prefix matched 0.
- **Slice crediting for decks without a slice** (`sliceForReviewFilters`): explicit slice wins; Genre Sprint / Research / Puzzles / shelf all credit backlog. Keeps the existing localStorage counters meaningful without a schema change.
- **Shuffle via random UUID pivot + wrap-around** rather than `ORDER BY random()` (unsupported in PostgREST) or count-then-offset (extra round-trip, offset scan).
- **Deck counts are six parallel head-only counts** in `countReviewDecks` — the page `load` now runs ~9 Supabase calls, above the ≤4 budget, documented here: each is an indexed `head:true` count on `idx_books_live_review`, and the deck rail is the page's core navigation. Replaced the two `countReviewQueueBySlice` calls (dashboard still uses those).

## Schema changes

- None (Session B adds `book_metadata_proposals`).

## New components / patterns added

- `src/lib/library/review-decks.ts` — deck specs, `hasReviewDeckParams`, `sliceForReviewFilters`, `isReviewDeckActive`, `reviewDeckSearchParams`, `REVIEW_TOP_GENRES`.
- `src/lib/components/review-deck-picker.svelte`, `review-sprint-hud.svelte`, `review-genre-chips.svelte`, `review-milestone-card.svelte`, `review-sprint-summary.svelte` (components.mdc updated).
- `review-progress.ts` grew sprint + milestone helpers (`startSprint`/`recordSprintClear`/`recordSprintSkip`/`endSprint`/`isSprintComplete`, `milestoneKeysFor`/`milestoneLabel`/shown-set, `readLifetimeClearedTotal`, `formatSprintElapsed`, keys `library.review.sprint` + `library.review.milestones`).
- Pattern: **structural builder cast for shared PostgREST filter helpers** — threading the concrete `PostgrestFilterBuilder` through a generic helper trips "type instantiation is excessively deep"; cast to a narrow self-chaining structural type at the boundary (`ReviewCardQueryBuilder` in `loaders.ts`).

## Open questions surfaced

- Genre Sprint one-tap has no undo (Skip/Back only help pre-confirm). If mis-taps happen in practice, add a 5s undo toast like the soft-delete pattern — owner call after first real sprint.
- `REVIEW_TOP_GENRES` is a static snapshot of prod frequency (2026-07). Revisit if the chip row stops matching what the backlog actually needs.

## Surprises (read these before the next session)

- **The structured `Deferred shelf-check:` prefix from the importer no longer exists in prod** — later note-merge passes rewrote them to free text. Anything keying on importer auto-line formats should verify against live data first.
- Excluding shelf-bound books moves the critical deck from 48 to 27 — about 40% of the remaining scholarly-core review work physically requires August.
- PostgREST `.or()` accepts double-quoted ILIKE patterns with spaces (`needs_review_note.not.ilike."*shelf*"`); a malformed logic tree fails loudly with PGRST100, so the syntax was smoke-tested via curl before shipping.

## Carry-forward updates

- [x] components.mdc updated (5 new review components)
- [x] AGENTS.md inventory updated (review-decks.ts + review-progress additions — see Session B entry 068 for the combined line)
- [x] new env vars — none
- [x] tracker Open Questions — n/a (ad-hoc session; PLAN.md refreshed)
