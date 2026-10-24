# 307 — Studies import-paper skill

**Date:** 2026-10-24
**Module:** studies
**Tracker session:** ad-hoc

## Built

- Skill [`.claude/skills/studies-import-paper/SKILL.md`](../../.claude/skills/studies-import-paper/SKILL.md). A docx (or pasted) seminary paper becomes a Studies paper with its bibliography cited.

## Decided

- “Add this paper” authorizes the paper row and clear shelf matches. It does not authorize marking a missing book not-owned. The skill lists those titles and asks which he owns.
- Shelf match folds `and` / `&` and requires the author on generic titles. Keyword search missed owned *Baptism & Fullness* when the citation said *Baptism and Fullness*.
- Same work, different year: ask (1975 shelf vs 2006 citation). Same year, different imprint: attach the shelf copy and report it.
- A set cited once attaches every owned volume. A dictionary or TDNT citation attaches the article, not the set.
- Journal articles are not-owned book stubs with the real citation on the source note. The compiled bibliography stays book-shaped.
- Unstated status is `drafting`. No course row unless that course already exists.

## Schema changes

- None.

## New components / patterns added

- `.claude/skills/studies-import-paper/SKILL.md`

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- The 1 Corinthians 14 paper (this chat) was inserted ad hoc, not through a migration. Later imports go through the skill’s migration.

## Carry-forward updates

- [x] components.mdc updated — no new component
- [x] AGENTS.md inventory updated
- [x] new env vars — none
- [x] tracker follow-on noted
