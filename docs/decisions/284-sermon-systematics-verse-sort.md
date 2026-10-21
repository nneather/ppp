# 284 — Sermon systematics verse sort

**Date:** 2026-10-20
**Module:** studies
**Tracker session:** ad-hoc

## Built

- Each systematic index hit shows the biblical verse it covers (`7:17`, `7:1–6`, `7`, `7:29–8:1`). The book name stays off the label because the sermon already names the passage.
- Sets start collapsed. The summary shows the series, the verse span (`7:17–29`), and the hit count. Opening a set lists verse, then locator, then Attach.
- A **By systematic** / **By verse** toggle. By verse groups the same hits under `7:17`, `7:23`, `7:29`, and so on, with the systematic name on each row.
- The same block is on paper detail and `/library/search-passage`.
- `list_systematics_for_passage` includes `verse_label` on each pointer.

## Decided

- No migration. `search_scripture_refs` already returns `chapter_start` / `verse_start` / `chapter_end` / `verse_end`. The loader was dropping them.
- Collapsed by default, so a chapter-length sermon does not bury Sources.
- Inside a set, pointers sort by verse, then volume and page.
- Sort state stays in the component. It is not a URL param.

## Schema changes

- None.

## New components / patterns added

- [`src/lib/components/systematic-passage-card.svelte`](../../src/lib/components/systematic-passage-card.svelte) — one collapsed card, used by [`systematics-on-passage.svelte`](../../src/lib/components/systematics-on-passage.svelte).
- `formatSystematicVerseLabel`, `formatSystematicVerseSpan`, and `groupSystematicPointersByVerse` in [`src/lib/library/outline.ts`](../../src/lib/library/outline.ts).

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Ecclesiastes 7 (sermon `b2e892d9-782a-4657-8b5c-2d3289830997`) currently has only Turretin hits: six rows, `7:17` through `7:29`. The span on the collapsed card is `7:17–29`. Other sets will show up as their indexes are captured.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented (none)
- [x] tracker Open Questions updated (none)
