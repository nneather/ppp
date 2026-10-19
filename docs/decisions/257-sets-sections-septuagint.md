# 257 — Sets sections, commentary preload, Septuagint

**Date:** 2026-10-19
**Module:** studies

## Built

- `/studies/sets` sections collapse. Bible books starts closed, then Old Testament and New Testament. A filter narrows the list. Open state is remembered in `studies.sets.collapsed`.
- Bible-book commentary counts load again. The sets loader was filtering `deleted_at` on `book_bible_coverage`, which has no such column, so every commentary set resolved empty.
- Sections are rows in `resource_set_sections`. Bible books is locked. Language tools, Septuagint, and Custom can take a new set (name + optional genre rule) or a new section.
- Septuagint studies is its own section (5 includes). The four Greek Language Tools volumes are sticky-excluded from NT language tools (26 included, 4 excluded). Invitation to the Septuagint is in the new set; it was Biblical Reference, so it was never in NT tools. Rahlfs *Septuaginta* and NETS stay genre Bibles.
- Set detail can search titles and add a book (include, or add-back if it was excluded). Import picker groups follow the same sections.
- A member can stay in the set and be marked reference-only (`bibliographical = false`). Import and sermon auto-attach skip those rows. Concordances already in NT tools, OT tools, and Septuagint studies start that way. The set page shows a Reference badge and a Reference only / For bibliography toggle.
- Set rows show the short author line under the title (essay authors, otherwise the parent book). Volumes that share a series and a title roll up to one row (HALAT, TDNT). Different titles in the same series stay separate. Remove, add back, and reference-only apply to every volume in the row.
- Add a book sits at the top of the set. Search matches title, citation abbreviation, or series name/abbreviation, and adding a multi-volume work adds every volume.

## Decided

- Sections are a table, not a new `kind`. Empty sections stay visible. New sections create `custom` sets. Language tools still creates `language` sets.
- Bible books cannot take a new set. The 66 commentary rules stay the canon.
- LXX texts are not studies. Only the four language-tool volumes leave NT tools, plus Invitation as the introduction.
- Reference-only is a column on `resource_set_members`, not a new set kind. A rule match stores the flag as an include row so the book stays in the set. Remove still excludes it. Add-back of a reference-only rule match keeps that row instead of deleting it.

## Schema changes

- `supabase/migrations/20261019223000_resource_set_sections.sql` — applied. Types regenerated.
- `supabase/migrations/20261019234500_resource_set_member_bibliographical.sql` — `bibliographical boolean not null default true`. Concordance includes in the language and Septuagint sets start false.

## New components / patterns added

- `src/lib/components/resource-set-browser.svelte` — collapsible section list, filter, new set / new section.

## Open questions surfaced

- Whether Rahlfs and NETS should also sit in Septuagint. They are Bibles today.

## Surprises (read these before the next session)

- Commentary member counts are series-collapsed, same as By book. Genesis shows 14, not the 16 coverage rows.
- `book_bible_coverage` is a hard-delete junction. Do not `.is('deleted_at', null)` it.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars — none
- [x] tracker follow-on noted
