# 254 — Passage sections wave 2 (Bonhoeffer, Augustine, Praying with Paul)

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc (follow-on to [250](250-passage-sections-research-pass.md))

## Built

- **22** new `book_passage_sections` rows. Live total **78** sections on **8** books. Audit: 22 INSERT rows.
- Dietrich Bonhoeffer, *The Cost of Discipleship* (Scribner 1995, ISBN 9780684815008). Google Books contents for that ISBN; verse spans from the chapter epigraphs in the same English text:
  - The Call to Discipleship, pp. 57–78 — Mark 2:14 and Luke 9:57–62 (two rows, one page span).
  - Single-Minded Obedience, pp. 79–85 — Matthew 19:16–26.
  - Discipleship and the Cross, pp. 86–93 — Mark 8:31–38.
  - Discipleship and the Individual, pp. 94–102 — Luke 14:26 and Mark 10:28–31.
  - The Messengers, six Matthew rows: harvest 9:35–38 (201–203), apostles 10:1–4 (204–205), the work 10:5–15 (206–212), suffering 10:16–25 (213–216), the decision 10:26–39 (217–219), the fruit 10:40–42 (220–222).
  - Existing Sermon on the Mount row kept as Matthew 5–7. `page_end` corrected **186 → 198** so the Great Divide (p. 189) and the Conclusion (p. 196) stay inside the section. The Messengers part title is p. 199.
- Augustine, *The Lord's Sermon on the Mount* (catalog: CUA Press, 1951, ISBN 9780813200118). Fathers of the Church vol. 11 contents (Project MUSE lists that ISBN on this volume): Book I, Matthew 5:1–48, pp. 19–108; Book II, Matthew 6:1–7:29, pp. 109–200. The seventeen related sermons in the same volume were not added.
- D. A. Carson, *Praying with Paul*, 2nd ed. (Baker Academic, ISBN 9780801097102). Chapter titles are the passages; pages from the 2nd-ed. contents (print xv + 215). Eight prayer chapters. Skipped the topical chapters (school of prayer, praying for others, excuses, sovereign God, afterword).

## Decided

- One row per continuous passage. Two passages inside one chapter share that chapter’s pages (same pattern as synoptic Snodgrass rows).
- Do not subdivide the Sermon on the Mount. The existing Matthew 5–7 row already covers it; the new rows are the other passages.
- Do not add a section when genre is Commentary and the book already has that bible-book coverage. Pennington, *The Sermon on the Mount and Human Flourishing*, and Guelich, *The Sermon on the Mount*, both have Matthew coverage, so a section would never show.
- Do not copy page numbers from a different edition. Kaiser *Nachfolge* (1952 and 1985) and DBW 4 have published contents, and none of them is the Brunnen Zimmerling volume on the shelf.

## Schema changes

- None (data only).

## New components / patterns added

- Skill [`.claude/skills/library-passage-sections/SKILL.md`](../../.claude/skills/library-passage-sections/SKILL.md) — edition-matched research pass for `book_passage_sections`.

## Open questions surfaced

- *Nachfolge* (Brunnen, ISBN 9783765509483, 320 pp., Zimmerling introduction) still has no passage sections. Need that edition’s contents before insert. Same chapter map as the English book, different pages.
- Susan Eastman, *Paul and the Person* (catalog year and ISBN empty). The only edition is Eerdmans 2017. Chapters 4–6 are Romans 7, Philippians 2, and Galatians 2, but no chapter-start page list turned up. Reviews cite interior pages only (Romans 7 at least 113–124, Philippians 2 at 129 and 150, Galatians 2 at 152–160, conclusion by 178). Held.
- Wright *Jesus and the Victory of God* / *The Resurrection of the Son of God* and Poythress *The Shadow of Christ in the Law of Moses* still deferred ([250](250-passage-sections-research-pass.md)): not a single pericope per chapter with an edition-matched contents list.
- Confirm the Augustine shelf copy is Fathers of the Church vol. 11 (CUA 1951), not the 1948 Newman Press Jepson translation. Catalog year and publisher match the former.

## Surprises (read these before the next session)

- The 1995 Scribner contents put the Sermon on the Mount at p. 103, which matches the row added in [249](249-library-passage-sections.md), but that row stopped at p. 186, short of Matthew 7’s last two chapters.
- Brunnen *Nachfolge* is not a reprint of the Kaiser page numbers. Three German contents lists in hand, three paginations.

## Carry-forward updates

- [x] decision filed
- [x] PLAN.md refreshed
- [x] AGENTS.md — skill pointer on the passage-sections bullet
- [ ] components.mdc — n/a
- [ ] new env vars — none
