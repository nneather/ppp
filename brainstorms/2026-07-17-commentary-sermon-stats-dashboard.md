# Commentary / Sermon Stats Dashboard: Brainstorm / Discovery Notes
Date: 2026-07-17 (continued 2026-07-18) · Goal: Lock where a flexible commentary+sermon stats surface lives, what v1 shows, and how it joins library coverage to preaching history
Status: **Grill complete** — ready for Session prompt / build

## Summary / key decisions
- **Primary unit = Bible book** (e.g. Genesis), not sermon rows and not library book rows. Module home is just the door.
- **Nav door (v1):** dedicated `/sermons/by-book` + List | By book control with `/sermons`. Not a second Library dashboard.
- **Row set:** all Protestant canon books always (OT→NT); empty rows stay (gaps are useful).
- **Primary metrics:** sermon count + Commentary list with ratings; collapsed quality cue = count of commentaries rated **≥4★** (hide when 0).
- **Commentary membership:** genre `Commentary` + live `book_bible_coverage`; multi-book vols on every covered book; `Biblical Reference` out of primary; unrated still listed.
- **Sermon count:** distinct live sermons with ≥1 live `sermon_passages` for that `bible_book`; multi-book sermons count on each; `passage_display`-only do not attribute.
- **Row UI:** collapsed = name · sermons · commentaries · optional `N · 4★+`. Expanded = commentaries (title, author short, stars, link) sorted rated high→low then title, unrated last. **Also on shelf** (further collapsed): essays + non-Commentary coverage. Find in library → search-passage.
- **Flexibility:** default canon order; sort Canon | Sermons | Commentaries | 4★+ each **most↔least**; filters OT | NT | Has sermons | No commentaries | Has 4★+. No charts.
- **Drill-downs:** `/sermons?bible_book=…` (add filter with this feature); commentary → book detail; Find in library → search-passage.
- **Data:** no schema change; aggregate in `src/lib/sermons/server/`; prefetch ~200 commentaries; Also on shelf in same v1.
- **Extras in v1:** header summary totals; mobile-first UX polish. **Deferred:** OT/NT section headers, expand-state persistence, charts, chapter/verse-range shelf surfacing (Bonhoeffer Matt 5–7).

## Suggested next step
- [x] Session prompt appended to PLAN.md › Session prompts (2026-07-19).
- [x] Built — [095](../docs/decisions/095-sermons-by-book-stats.md) (2026-07-19).

## Repo context (read before Q1; not user answers)
- Sermons module v1 just shipped (`/sermons`, [090]/[091]): passages via `sermon_passages.bible_book` + human `passage_display`; library hook is deep-link to `/library/search-passage` only (no FK).
- Commentaries: genre `Commentary`; bible books via `book_bible_coverage` ([088] cleaned: 203/211 tagged).
- Ratings: `books.rating` 1–5 stars ([089]).
- Passage search already merges scripture refs + coverage hits — same coverage join is the natural spine for “commentaries I have on X.”

## Q&A log
### Q1 — Primary unit / what makes this different
- Asked: Where should this live as the main entry point? (Sermons vs Library vs both)
- Captured: The hard part is that **the Book of the Bible is the primary unit**, so neither Sermons nor Library is an obvious “keeper.” Desired view for e.g. Genesis: how many sermons preached on that book + which commentaries (and of what quality/rating) are on the shelf. Optionally and collapsibly: essays or other books that also cover those passages.
- Flags: none

### Q2 — Nav home (door, not spine)
- Asked: Given Bible book as row, where should the door live in v1?
- Captured: **Confirmed** — under Sermons as a second view (`/sermons/by-book` or “By book” toggle). Library stays catalog + passage search; deep-links from rows OK. No second full Library dashboard in v1.
- Flags: none

### Q3 — Which Bible books appear as rows
- Asked: All canon books always, or only books with sermons/commentaries?
- Captured: **All canon books** (Protestant canon; empty rows stay visible as gaps).
- Flags: none

### Q4 — What counts as a “commentary” on a Bible book
- Asked: Genre + coverage rules for primary commentary list?
- Captured: **Confirmed** — `Commentary` genre + live `book_bible_coverage` for that book; multi-book vols on every covered book; `Biblical Reference` excluded from primary; unrated still shown.
- Flags: none

### Q5 — How sermon count is attributed to a Bible book
- Asked: Distinct sermons via sermon_passages vs passage_display parsing?
- Captured: **Confirmed** — distinct live sermons with ≥1 live `sermon_passages` for that bible_book; multi-passage sermons increment each book; passage_display-only (no structured rows) do not count until passages exist.
- Flags: none

### Q6 — Primary row shape (collapsed vs expanded)
- Asked: What’s always visible vs only after expand?
- Captured: Liked collapsed summary (name · sermon count · commentary count · quality cue). **Quality cue = commentaries rated 4★ or higher** (not average of all rated). Expanded primary = commentary list as recommended. Secondary “Also on shelf” still TBD at time of answer (locked in Q7/Q14).
- Flags: none

### Q7 — Collapsible “Also on shelf” (secondary)
- Asked: Essays / non-commentary coverage vs scripture_refs in the secondary section?
- Captured: **Confirmed** — secondary = other `book_bible_coverage` (essays + non-Commentary books); skip verse-level refs here; deep-link to search-passage. **Related desire (may live elsewhere):** bring up books that cover a *passage range* (e.g. Cost of Discipleship → Matt 5–7), not only whole-book coverage — “more than just a reference,” surfaced when studying that passage.
- Flags: Chapter/verse-scoped shelf surfacing (Bonhoeffer Matt 5–7 pattern) → likely separate surface or extension of passage search; not blocking this by-book dashboard’s membership rules → Parker (scope later)

### Q8 — v1 boundary for passage-range shelf hits
- Asked: Stay Bible-book–level only for this dashboard?
- Captured: **Confirmed** — v1 book-level only; no chapter/verse ranges on coverage in this build; Bonhoeffer-style surfacing deferred to passage search / writing workflow.
- Flags: (same open flag as Q7 — deferred, not blocking)

### Q9 — Flexibility in v1 (sort / filter)
- Asked: Which sort/filter controls; charts or list?
- Captured: **Yes** to recommended sorts/filters and no charts in v1. Sorts must support **most or least** (bidirectional) for sermons / commentaries / 4★+ — not most-only.
- Flags: none

### Q10 — Route shape
- Asked: Dedicated `/sermons/by-book` vs mode on list?
- Captured: **Dedicated route** `/sermons/by-book` with shared List | By book control linking to `/sermons`.
- Flags: none

### Q11 — Drill-downs from a Bible-book row
- Asked: Where do sermon count / commentary / find-in-library go?
- Captured: **Confirmed** — sermon count → `/sermons?bible_book=…` (ship list filter with this feature); commentary → `/library/books/[id]`; Find in library → `/library/search-passage?bible_book=…`. No nested sermon list in accordion v1.
- Flags: none

### Q12 — Collapsed “4★+” quality cue format
- Asked: How to render the 4★+ signal on the closed row?
- Captured: **Confirmed** — compact count only when >0 (e.g. `3 · 4★+`); hide when zero; full stars only in expanded commentary list.
- Flags: none

### Q13 — Data / schema for v1
- Asked: New tables/views vs loader aggregation?
- Captured: **Confirmed** — no schema change; assemble in sermons server loaders from existing tables; prefetch all details; sort/filter on payload; no materialized view until needed.
- Flags: none

### Q14 — Also on shelf: same build or follow-up?
- Asked: Ship secondary section with primary in one v1?
- Captured: **Confirmed** — same v1 build; shell + data; can stay behind disclosure if UI feels heavy.
- Flags: none

### Q15 — Completeness / v1 extras
- Asked: Header totals, OT/NT headers, expand-state, mobile UX — what’s in v1?
- Captured: **Header summary** in v1. **Mobile UX polish** in v1 (not phone-exclusive — see Q16). OT/NT section headers and open-state persistence can wait.
- Flags: none (clarified in Q16)

### Q16 — Mobile UX meaning
- Asked: Mobile-first (A) vs phone-only (B)?
- Captured: Clarification — wanted the **mobile UX polish** called out in Q15, not a mobile-only product. Treat as **mobile-first, desktop still usable** (A): sticky sort/filter, large row taps, one-row expand, compact filters on small screens. No separate desktop dashboard.
- Flags: none

## Open flags (pending input)
- Chapter/verse-scoped “bring to front when studying a passage” (e.g. Cost of Discipleship on Matt 5–7) — may need richer coverage than book-level `book_bible_coverage`, or live in `/library/search-passage` / writing workflow — Parker to scope in a later session
