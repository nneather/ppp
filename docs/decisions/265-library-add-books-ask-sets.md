# 265 — Ask about study sets when adding books

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc (`library-add-books`)

## Built

- `library-add-books` now proposes a study set in the confirmation message and waits for an answer before writing `resource_set_members`.

## Decided

- Girdlestone, *Synonyms of the Old Testament*, is already on **OT language tools**. That set is the Hebrew Language Tools genre rule. The book has no exclude or dismiss, so no member row was inserted.
- A genre or commentary rule match is not an `include`. An `include` is for a set the rules do not already list (Septuagint studies, Systematic Theology). `dismiss` / `exclude` are how a book comes off a rule set.

## Schema changes

- None

## New components / patterns added

- None. Skill only: `.claude/skills/library-add-books/SKILL.md` and `reference.md`.

## Open questions surfaced

- None

## Surprises (read these before the next session)

- None

## Carry-forward updates

- [x] components.mdc — no new component
- [x] AGENTS.md — no new helper
- [x] new env vars — none
- [x] tracker — ad-hoc; no session to tick
