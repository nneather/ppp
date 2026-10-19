# 251 — Passage sections on import and footnote pages

**Date:** 2026-10-19
**Module:** studies
**Tracker session:** ad-hoc (Sessions 0–4 already shipped)

## Built

- Import suggestions include books whose curated `book_passage_sections` overlap the study passage. The checklist attaches the **book** (group “On this passage”). Already-attached books stay greyed. `suggest_sources` returns the same rows as `passage_sections`, with `attached`.
- Commentary coverage for that Bible book wins: the book is not offered again as a section candidate. An index hit does not remove a section candidate, and index-only books are not candidates.
- The footnote page box starts from the tightest overlapping section (smallest abs span; equal spans keep the earlier row). The user can type over it. A reload reseeds from the section until they type.
- Compiled bibliography is unchanged: book XOR essay. Section label and pages are a checklist hint, not stored notes and not a third source type.
- Sections stay off `/studies/by-book`, hit rate, and sermon auto-attach.

## Decided

- No migration. Pages and ranges were already on `book_passage_sections`.
- Structured primary passages win over `passage_display`. Papers usually have no `paper_passages` rows, so the display string is parsed (`Psalm` → Psalms, en dash → hyphen, `Matthew 5-7` as a chapter span, a second book after “and”).
- Tightest span answers the open question from [249](249-library-passage-sections.md). Prefill includes commentary books that also have a section; import simply does not list those books a second time.
- The scripture index is not loaded for this path. Band assignment already ignores index hits when placing sections, so a section book that also has an index row stays a candidate.

## Schema changes

- None.

## New components / patterns added

- `src/lib/studies/passage-ranges.ts` — study passage → overlap ranges.
- `src/lib/studies/passage-section-suggest.ts` — candidates, tightest section, footnote page text.
- `src/lib/studies/server/passage-section-suggest.ts` — primary passages, then sections + coverage when a range exists (two extra round trips, same class as search-passage).

## Open questions surfaced

- None new. B1 (`acquired_on` backfill) and sermon-delete cascade of `study_sources` stay open from earlier sessions.

## Surprises (read these before the next session)

- Smoke used the Bonhoeffer Sermon on the Mount section (Matt 5–7, pp. 103–186) on the Oct 11 Matthew 6:25–34 sermon. Import offered that one book; Ecclesiastes 7 did not; Matthew on `/studies/by-book` stayed the commentary volumes.
- [250](250-passage-sections-research-pass.md) filled five more books in parallel (Carson, Keener, Women in the Church, Doriani *Women and Ministry*, Snodgrass). None of those six is genre Commentary, so matching passages will offer them on import. The commentary-wins rule is unit-tested and still unused by the live section catalog.
- The smoke source and its “On this passage” group were removed after the page box showed `103–186` and typing `150` stuck. Both rows are soft-deleted.
- The import form’s client refresh once tripped the 12-second nav watchdog while the sheet was open. A direct load of the sermon showed the attached book. Later loads were fine.

## Verification

- `npm run check` — 0 errors / 0 warnings.
- `npm run test` — 631/631.
- Browser, owner session on `localhost:5176`: Matthew 6:25–34 import shows “On this passage · 1 book” → *The Cost of Discipleship* with hint “Sermon on the Mount · p. 103–186”. After import the row is a Book candidate and the page box is `103–186`; replacing it with `150` stays. Ecclesiastes 7 suggestions start at Commentaries: Ecclesiastes. By-book Matthew does not list Cost of Discipleship. Smoke rows removed.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars — none
- [x] tracker follow-on noted (not a new session)
