# 311 — Studies notes capture

**Date:** 2026-10-24
**Module:** studies
**Tracker session:** follow-on (research workflow, session 1 of 3)

## Built

- `study_notes`: a paper or a sermon, an optional source, an optional page, an optional verse anchor, and a body. Six existing `study_sources.notes` values were copied in. The textarea column stays.
- The paper and sermon pages lead with a capture line. Enter saves. Shift+Enter adds a line. A last name and a page at the front pick the source. `@2:12` anchors the study’s primary Bible book; `@1 Tim 2:12` names the book. A shared last name shows chips instead of guessing.
- Saving a note moves that source from candidate to consulted. Cite copies the footnote at the note’s page and moves candidate or consulted to cited. Cited is never demoted.
- Reading now is a per-study localStorage chip. The sources list collapses to Working / Cited / Not yet once the study has a note. Each source row can be marked Reading and can expand its notes.
- A new paper with the same primary passage, or a near-same title, warns and waits for Create anyway. The import-paper skill stops the same way.
- The submitted Proverbs 31 paper (“Open Your Mouth for Justice, Not for Intoxication”) is soft-deleted, with its sources, groups, and passages. The archived annotated translation stays.

## Decided

- The note is the unit. Outline and prose stay in Word. Usage follows the note and the footnote copy. The manual usage cycle stays.
- Every author and editor last name matches, so “Towner” finds Marshall and Towner. The Reading chip still shows the first author.
- A line that does not name a source uses the sticky source. A line that does not name a page uses the last page saved for that source.
- Sources stay open on the same visit after the first note. Opening another paper or sermon reseeds from that study. Reading now reloads with the study, so one study’s sticky source is not written onto the next.
- Copy notes, the add-source sheet, row Footnote/Short → cited, other studies, and MCP search are session 2. Voice is session 3. Keyboard dictation into the textarea is already available.

## Schema changes

- `supabase/migrations/20261024220000_studies_notes.sql` — `study_notes`, RLS (`studies` read, owner write), grants, audit trigger, the six-note backfill, and the Proverbs 31 soft-delete.

## New components / patterns added

- `src/lib/components/study-notes-panel.svelte` — capture line, sticky chip, ambiguity chips, notes stream.
- `src/lib/components/study-note-row.svelte` — cite, edit, delete, attach a loose note.
- `src/lib/studies/note-capture.ts`, `reading-now.ts`, `paper-dedupe.ts`, `study-note.ts`.
- `src/lib/studies/server/note-actions.ts`, `note-loaders.ts`, `note-route.ts`, `paper-duplicate.ts`.

## Open questions surfaced

- Transcription provider, and whether to keep the audio after the line is saved — Parker, session 3 Phase 0.
- Studies tables are not in the weekly R2 dump. Do not widen the dump until that backup session.
- There is still no form to create a journal article. That belongs on the session 2 add-source sheet.

## Surprises (read these before the next session)

- Hit rate counts `study_sources` without joining the parent’s `deleted_at`. Soft-deleting only the duplicate paper would have double-counted its sources. The migration and `softDeletePaperAction` delete the child rows too. Sermon delete does the same for notes.
- `loadStudyNotes` rides the workspace `Promise.all`. The paper page was already over the four-trip budget.
- Cite does not mark the source cited when the clipboard write throws. An unfocused tab fails the copy and leaves the usage alone.
- Gender in the Pastorals has one live note on Marshall and Towner, page 215, 1 Timothy 2:12, and the source is cited. One loose note is unattached. A duplicate from the smoke pass was deleted.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented (none)
- [x] tracker Open Questions updated
