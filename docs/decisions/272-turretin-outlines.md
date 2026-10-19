# 272 — Turretin outlines from the contents

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc (Turretin scripture-index capture)

## Built

- `book_outline_sections` for the P&R *Institutes of Elenctic Theology*, data only (no migration).
- Volume 1 (`93324149-56ef-4602-8a14-1a111d07ed20`): topics I–X, 143 questions, pages 1–685. From the shelf contents.
- Volume 2 (`4e87b189-019a-45ad-b469-4455c5aa753d`): topics XI–XVII, 107 questions, pages 1–724. From the shelf contents.
- Volume 3 (`b73c5789-9463-41a1-9e74-3459161da25f`): topics XVIII–XX, 78 questions, pages 1–637. From Parker’s English PDF. Question titles were checked against the body.
- The smoke row “XV.17 Full Assurance” (pages 610–630) is soft-deleted. The live row is XV.17, The Certainty of Faith, pages 616–633.

## Decided

- A question’s `page_end` is the next question’s `page_start`, so the shared boundary page belongs to both. Volume ends: vol. 1 page 685, vol. 3 question 13 page 637 (638 is blank; the biography starts at 639).
- Vol. 2’s contents stop at XVII.5 on page 710. The scripture index cites volume 2 through page 724, so that question runs to 724. Parker confirmed this.
- XIV.8 (Priest of true name) is page 403. XIV.9 (Melchizedek) is page 406. The 403 sits on the first line of question 8. Parker confirmed this.
- Six question labels were shortened to the 300-character column. The page numbers and the closing affirm or deny stayed.
- A shared page still resolves to one question (the shorter span). Showing both names is not built.

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- Either/or labels on a boundary page, before the index is trusted for preaching.

## Surprises (read these before the next session)

- Topic 4 question 16 has no page on the contents line. The question title in the body is on page 392.
- Topic 9 question 1 is page 591. Question 2 is 593, not 591.

## Carry-forward updates

- [x] components.mdc — no new component
- [x] AGENTS.md — no inventory change
- [x] new env vars — none
- [ ] PLAN.md — left unstaged; the working copy already carries uncommitted 269–271 edits
