# 312 — Add a source while reading

**Date:** 2026-10-24
**Module:** studies
**Tracker session:** follow-on (research workflow, session 2 of 3)

## Built

- Add source sheet on the paper and sermon page: Article (DOI → Crossref), Book (ISBN → Open Library), or a free title. The prefill stays editable. Save attaches a candidate. A loose note can still stay unattached.
- A DOI creates a `journal_articles` row (or attaches the live article that already has that DOI or the same title and journal). An ISBN or title creates a not-owned book, storing the ISBN when it is 10 or 13 digits, and attaches an existing book when the title already matches.
- Footnote and Short on a source row copy the citation and mark candidate or consulted as cited. Bibliography copy does not. Cited is never demoted. A failed clipboard write does not change usage.
- Copy notes puts the study’s notes on the clipboard as plain text, unattached first, then each source by page: `Towner, The Pastoral Epistles, 215 (1 Timothy 2:12): …`. By verse regroups the stream.
- Each source row can load notes on that book, essay, or article from other studies (`GET /studies/notes.json`). The study page load does not fetch them.
- MCP `search_study_notes` searches note text. `list_studies` adds `last_note_at` and `days_since_note`. Monday protocol’s seminary step reads those fields and does not add an in-app banner.

## Decided

- Prefill, then edit, then save. Nothing is inserted from the lookup alone.
- Crossref is `https://api.crossref.org` with a polite `mailto`, no API key, and an 8 second timeout. CSP `connect-src` allows that origin next to Open Library.
- Other-study notes match the catalog row, not the `study_sources` id.

## Schema changes

- None. Articles and not-owned books use the tables from [310](310-journal-articles.md) and [103](103-library-not-owned-session-1.md).

## New components / patterns added

- `src/lib/components/study-add-source-sheet.svelte`
- `src/lib/components/study-other-notes.svelte`
- `src/lib/studies/crossref.ts`, `notes-copy.ts`
- `createJournalArticleSourceAction` in `paper-actions.ts`
- `GET /studies/notes.json`

## Open questions surfaced

- Transcription provider and whether to keep the audio — Parker, session 3 Phase 0.
- Studies tables are still outside the weekly R2 dump.

## Surprises (read these before the next session)

- Crossref from the page returns 200 under the new CSP. The lookup itself was not clicked through in the browser; the parser is covered by unit tests, and the sheet opens with DOI, journal, title, and author fields.
- By verse on Gender in the Pastorals splits the smoke notes into `1 Timothy 2:12` and `No verse`.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented (none; Crossref mailto is in `crossref.ts`)
- [x] tracker follow-on updated
