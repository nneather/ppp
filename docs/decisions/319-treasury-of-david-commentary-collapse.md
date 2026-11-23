# 319 — Treasury of David collapses on commentary shelves

**Date:** 2026-11-23
**Module:** sermons
**Tracker session:** ad-hoc

## Built

- Commentary shelves (By book, sermon commentary cards, Bible-book resource sets) show one *Treasury of David* row. The three owned volumes stay separate books.
- `commentaryCollapseKey` groups a series-less hit with the same title and author. Series collapse is unchanged. Different titles, different authors, and authorless copies stay separate.

## Decided

- Do not add a Treasury series. [121](121-commentary-consistency-batch5.md) left these volumes series-less after detaching them from Spurgeon’s Sermons. The shelf collapse is the same result Wenham’s WBC volumes get from a shared series, without a citation series.
- Live check: the only owned series-less commentary group that shares a title and author is these three Psalms volumes (two MacDonald, one Hendrickson). Psalms commentaries go from three Treasury rows to one, with all three book ids on the row. Rating and “Dismiss by default” write every volume. Attach still adds the lead volume, as with other collapsed sets.

## Schema changes

- None.

## New components / patterns added

- None. Behavior is in `commentaryCollapseKey` ([`src/lib/sermons/by-book.ts`](../../src/lib/sermons/by-book.ts)).

## Open questions surfaced

- Volume numbers 1–3 and MacDonald vs Hendrickson are still unset. The review note on each row says so. Shelf order among unrated volumes is load order, not volume order.

## Surprises (read these before the next session)

- The collapsed title is deduped, so three identical titles render once. The resource-set candidate lookup still finds the group because that title’s case fold matches the key.

## Carry-forward updates

- [x] AGENTS.md inventory updated
- [x] PLAN.md refreshed
- [ ] components.mdc — no new component
- [ ] new env vars — none
