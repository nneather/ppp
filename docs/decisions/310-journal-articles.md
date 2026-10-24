# 310 — Journal articles as sources

**Date:** 2026-10-24
**Module:** studies
**Tracker session:** follow-on

## Built

- A journal article is a catalog row (`journal_articles` + `journal_article_authors`), cited from a paper or sermon through `study_sources.article_id`.
- Turabian footnote, short form, and bibliography: author, quoted title, italic journal, volume, issue, year, pages. A DOI is appended when stored. Page ends follow Chicago inclusive-number elision (157–162 → 157–62).
- Compiled bibliography and the `.docx` download use that form. The download already renders citation HTML, so an italic journal name becomes italic in Word.
- Denton (*Evangelical Quarterly* 54), Buchem (*Bangalore Theological Forum* 50, no. 1), and Fox (*The Biblical Archaeologist* 59, no. 4, with DOI) moved off book stubs. Those books are soft-deleted. The “stored as a book” source notes are cleared.
- Prior-paper import can copy an article. The import-paper skill inserts an article row instead of a book stub.

## Decided

- Not an essay. Essays require a parent book, and their formatters cite “in” that volume. A journal is a different container.
- Not a book with a citation kind. That still lists the article in the library and prints a book bibliography. The three stubs were that compromise.
- Resource sets stay book XOR essay. An article is not a shelf member. Hit rate ignores it.
- The note uses the stored page span unless a page is typed. The bibliography always uses the span. Short form is last name, title, and the first page (or the typed page).

## Schema changes

- `supabase/migrations/20261024201500_studies_journal_articles.sql` — tables, RLS (`studies` read, owner write), grants, `study_sources.article_id` as the third catalog arm, and the stub move.

## New components / patterns added

- `src/lib/library/turabian/journal.ts` — article footnote and bibliography.
- `src/lib/studies/source-citation.ts` — one study source’s footnote, short form, and bibliography.

## Open questions surfaced

- There is no form to create an article from the study page. New articles are a migration (the import skill) or a prior-paper copy. A search-and-add sheet is the next surface if another paper needs one before the next import.

## Surprises (read these before the next session)

- `supabase migration new` stamped `20261024175757`, which sorts before the already-applied OT paper files. The applied file is `20261024201500_studies_journal_articles.sql`.
- Fox’s title keeps the Hebrew lemma from the stub. The DOI is `10.2307/3210564`.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars — none
- [x] tracker follow-on noted
