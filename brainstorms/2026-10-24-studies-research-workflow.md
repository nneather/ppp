# Studies module for research (Kolbe 7-2-8-4): Brainstorm / Discovery Notes
Date: 2026-10-24 · Goal: Decide what to change in `/studies` so it serves the *middle* of a paper (reading, noting, deciding) for how Parker works — not only the start (import) and the end (bibliography).

## Prior art (read before grilling)

- Studies Sessions 0–4 + follow-ons shipped ([243](../docs/decisions/243-studies-session-0.md)–[248](../docs/decisions/248-studies-session-4.md), [251](../docs/decisions/251-studies-passage-section-import.md), [257](../docs/decisions/257-sets-sections-septuagint.md), [276](../docs/decisions/276-import-sources-detail-dialog.md)/[277](../docs/decisions/277-import-picker-research.md), [302](../docs/decisions/302-systematic-hit-attach.md)–[310](../docs/decisions/310-journal-articles.md)). Earlier brainstorm: [2026-10-19-papers-research-tool.md](2026-10-19-papers-research-tool.md).
- What a paper page can do today: import from a set / prior paper / passage sections; research groups; per-source `usage` candidate → consulted → cited; per-source free-text `notes`; per-row footnote / short form / bibliography copy with a page input; compiled bibliography (clipboard + sectioned `.docx`); systematics on the passage; status researching / drafting / submitted / published / archived.
- Explicitly left out in 243 Q13: rich notes editor, Zotero/BibTeX, freeform citations. Attachments parked ([258](../docs/decisions/258-study-attachments-parked.md)).
- Import-paper skill ([307](../docs/decisions/307-studies-import-paper-skill.md)) backfills finished papers from `.docx`.

## State of the data (2026-10-24, hosted)

9 live papers:

- **1 live research paper:** *Gender in the Pastorals* (1 Tim 2:8–15, topical, researching, due 2026-12-31). 18 sources, all `candidate`, 0 consulted, 0 cited, 0 notes, 3 auto groups (Commentaries: 1 Timothy / NT language tools / On this passage) + 1 ungrouped. Everything imported 2026-10-20; nothing has moved since.
- **7 backfilled papers** (Col 1:12 published; 1 Cor 14 drafting; Prov 31, 1 Kgs 12, Gen 22, Exod 23, Deut 13 archived): every source `cited`, notes on 6 rows total, groups only where the bibliography had headings.
- **1 duplicate:** Proverbs 31:1–9 exists twice (`submitted` + `archived`, 17 sources each).

Reading: the module is strong at **start** (import → candidates in seconds) and **end** (compiled bib / `.docx`), and empty in the **middle** (reading, quoting, deciding, drafting). No paper has ever walked candidate → consulted → cited inside the app; the only cited rows were stamped by import.

## Kolbe 7-2-8-4 — working assumptions for the design

- **Fact Finder 7** — wants the full context *available*, not forced up front → progressive disclosure: collapsed rows, depth one tap away (footnote, abbreviations, hit rate, systematics).
- **Follow Thru 2** — resists maintaining structure → the *system* carries follow-through: auto-promotion, defaults, nudges, dedupe. Never a form he must keep tidy. Usage cycles and group hygiene that depend on him will not happen (the data above confirms it).
- **Quick Start 8** — momentum; start fast, allow mess, sort later → capture must be one tap / one line (a page number + a thought), on the phone, mid-reading.
- **Implementor 4** — concepts and systems over physical → keyboard, text, structure; not scanning/handling artifacts.

## Summary / key decisions
(running synthesis, updated as you go)

- **Scope of ppp in the middle of a paper: page-anchored reading notes per source.** A note is one line + a page (or locator) on one attached source. Usage flips itself from activity (note → consulted; footnote copy → cited). Outline and prose stay in Word.
- **Unit:** `study_notes` — paper XOR sermon; optional `source_id`; optional page/locator; optional verse anchor; body. Loose notes allowed; attach later. Existing `study_sources.notes` migrates in (6 rows).
- **Capture:** one line at the top of the study page. Sticky reading-now source (localStorage) + `Lastname page` prefix override + `@2:12` verse anchor + last-page prefill. Real textarea, Enter-to-save (keyboard dictation works for free).
- **Page:** notes-first. Capture line → notes stream (newest first, source short name + page + inline Cite) → sources panel collapsed to counts, expanding per group; row expands to its notes and to “N notes on other studies”.
- **Usage:** note → `consulted`; footnote / short-form copy (note Cite or row copy) → `cited`; never auto-demote; manual cycle stays.
- **Follow-through the app carries:** dedupe warning on create-paper / import-paper (same passage or near-same title). Everything else (resume, stale, past-due) goes to Monday protocol via MCP, not in-app nudges. Fix Proverbs 31 duplicate by hand.
- **Sources found mid-reading:** Add source sheet — DOI (Crossref) / ISBN (Open Library) / free title → `candidate`. Loose-note escape hatch stays. Closes the 310 article-form item.
- **Out to Word:** per-note Cite = Turabian footnote at that page; paper-level Copy notes grouped by source, plain text. No notes `.docx`.
- **Sermons:** same panel, same rules, nothing sermon-specific.
- **Across studies:** per-source expander + MCP `search_study_notes`; no notes search page.
- **Voice:** Tier 2 (record → Edge Function → transcription → capture line for review) as Session 3.

## Session arc (locked)

| Session | Goal |
|---|---|
| **1 — Notes capture** | `study_notes` migration (RLS `studies`, grants, audit, soft delete; verse-anchor columns) + textarea backfill; `<StudyNotesPanel>` (capture line, sticky source, prefix + `@verse` parse, stream, per-note Cite → `cited`, note → `consulted`); study page reordered notes-first with the sources panel collapsed to counts; dedupe warning on create / import; Proverbs 31 fixed. Unit tests for the parse helpers. |
| **2 — Sources + out** | Add source sheet (DOI → Crossref prefill → `journal_articles`; ISBN → OL prefill → not-owned book; free title) with CSP `connect-src` for Crossref; row copy → `cited`; Copy notes grouped by source; group-by-verse toggle; other-studies expander (`/studies/notes.json`); MCP `search_study_notes` + last note / days-since on `list_studies`; Monday protocol hook. |
| **3 — Voice** | `MediaRecorder` → private `studies-audio` bucket → Edge Function `transcribe_study_note` → text into the capture line for review. Phase 0 locks provider, retention, and limits. Security review. |

## Q&A log

### Q1 — What ppp owns in the middle
- Asked: ppp owns reading notes vs bibliography-only vs notes + outline vs notebook stays analog.
- Captured: **Notes.** ppp owns per-source reading notes/quotes with page numbers, phone-friendly, one tap. Usage is derived from activity, not clicked. Argument outline and prose stay in Word.
- Flags: none

### Q2 — Unit of capture
- Asked: one row per note (loose source/page) vs strict per-source vs keep the textarea vs per-source + scratchpad.
- Captured: **One row per note; source and page both optional.** New `study_notes` (parent paper XOR sermon via the `study-parent.ts` pattern; nullable `source_id` → `study_sources`; nullable page/locator text; body; created_at). A single quick-capture line on the paper page (`Towner 215 — …`) resolves the source by last name; a loose note (idea, thesis fragment) saves with no source and can be attached later. Capture never waits on bookkeeping.
- Design consequence (agent): the existing `study_sources.notes` textarea becomes legacy; migrate each non-empty value to one `study_notes` row with no page so nothing is lost (6 rows today).
- Flags: none

### Q3 — Usage derived from activity
- Asked: which actions flip candidate → consulted → cited.
- Captured: **Note saved on a source → `consulted` (only if candidate). Footnote or short-form copy — from a note's Cite button or the existing row copy — → `cited`. Never auto-demote. Manual cycle stays as an override.** Compiled bib default unchanged (consulted + cited).
- Design consequence (agent): the copy actions are client-side clipboard today; `cited` needs a small server action fired on copy (fire-and-forget, no reload), same shape as the rating save in [305](../docs/decisions/305-sermon-commentary-rating-stay.md). Hit rate already reads consulted/cited, so it starts filling itself.
- Flags: none

### Q4 — Paper page layout
- Asked: notes-first vs sources-first with inline notes vs tabs vs desktop split.
- Captured: **Notes first.** Capture line at the top, then the notes stream (newest first; each note shows source short name + page + inline Cite), then `<StudySourcesPanel>` collapsed to counts (Working · Cited · Not yet) and expanding per group; a source row expands to its own notes. Same shape on the sermon detail page since the panel is shared.
- Design consequence (agent): `study-sources-panel.svelte` is already 857 lines; the notes stream and capture line are a new component (`study-notes-panel.svelte`), not more lines in the panel.
- Flags: none

### Q5 — Follow-through the system carries
- Asked: which nudges the app runs on its own (resume card, past-due banner, dedupe guard, stale-candidate fold, or route nudges to Monday protocol / MCP).
- Captured: **Dedupe guard + MCP/Monday protocol. No in-app nudges.** Create-paper and import-paper warn when a live paper already has the same passage or a near-same title. The live paper, its last note, and days-since go into the Monday protocol via MCP (extend `list_studies` / `get_study_sources` or add `get_study_notes`), not into Overview or dashboard cards. Rejected: resume card, past-due banner, automatic stale-candidate fold.
- Also: Proverbs 31 duplicate is fixed by hand now (keep the `archived` row with notes; soft-delete the `submitted` one — confirm which at build time).
- Flags: which Proverbs 31 row to keep → Parker, at build time (default: keep `archived`, it carries the course note)

### Q6 — Source resolution on the capture line
- Asked: sticky reading-now source vs prefix-only vs chips vs capture from the row only.
- Captured: **Sticky reading-now source.** Tap a source row (or type a last-name prefix once) → every following note goes there; page field prefilled from the last page used on that source; a `Lastname page` prefix on any line overrides; no prefix and no sticky source = loose note.
- Design consequence (agent): sticky source is per-study, localStorage (same pattern as `systematics-using.ts`), not a DB column. Last-name resolve reuses `source-citation.ts` short-form author; ambiguous last names (two Mounce volumes) fall back to a two-option chip under the line.
- Flags: none

### Q7 — Notes out to Word
- Asked: per-note footnote copy, note + footnote together, `.docx` dossier, or stay in app.
- Captured: **Per-note Cite copies the Turabian footnote at that page (flips `cited`). Paper-level Copy notes puts every note grouped by source on the clipboard as plain text (`Towner, Letters, 215: …`).** No `.docx` for notes until asked.
- Design consequence (agent): grouped copy is a pure helper (`study-notes-copy.ts`) with unit tests; footnote text comes from `source-citation.ts` with the note's page. Loose notes go in a leading “Unattached” block.
- Flags: none

### Q8 — Sources discovered while reading
- Asked: DOI/ISBN add sheet vs manual article form vs loose note vs defer.
- Captured: **Add source sheet with DOI (Crossref) / ISBN (Open Library) / free title, attached as `candidate` — and the loose-note path stays available when he does not want to stop** (“`cf. Marshall JSNT 1999`” as a note, sorted later by hand or the import skill).
- Design consequence (agent): closes the 310 open item (article create form). Crossref needs `https://api.crossref.org` in CSP `connect-src` (same one-origin pattern as [084](../docs/decisions/084-isbn-lookup-csp-openlibrary.md)); client fetch with `AbortSignal.timeout`, no key, polite `mailto` param. Prefill → editable form → save; never silent insert. ISBN path reuses `fetchOpenLibraryPrefill` and `createNotOwnedSourceAction` with real metadata instead of a bare title.
- Flags: none

### Q9 — Sermons
- Asked: ship the notes panel on sermons in the same pass.
- Captured: **Yes, same component and rules on `/studies/sermons/[id]`.** Nothing sermon-specific. Handwritten pages stay parked ([258](../docs/decisions/258-study-attachments-parked.md)).
- Flags: none

### Q10 — Notes across studies
- Asked: per-source expander for the same book's notes elsewhere, a notes search page, book-detail only, or wait.
- Captured: **Per-source expander (“N notes on other studies”) + MCP `search_study_notes`. Prior-paper import keeps copying notes. No notes search page.**
- Design consequence (agent): expander is lazy JSON (`GET /studies/notes.json?book_id=|essay_id=|article_id=&exclude_study=`) so the study page load does not grow; notes match on the catalog row (book / essay / article), not on the `study_sources` id.
- Flags: none

### Q11 — Sequencing + backstop
- Asked: two-session arc; anything missed.
- Captured: **Two-session arc accepted; Session 1 starts next** so the Pastorals paper (due 2026-12-31) uses it.
- Captured (new, backstop): **A note can carry a verse anchor separate from the page** (e.g. `1 Tim 2:12`) so notes can later group by verse. Optional, never required.
- Captured (new, backstop): **Voice capture on the phone — wanted if the scope is small.** Agent sizing below; answer in Q12.
- Design consequence (agent), verse anchor: `study_notes.passage_display text` + parsed `bible_book / chapter / verse_start / verse_end` via `parsePassageDisplay`, nullable. Capture grammar: a trailing or leading `@2:12` resolves against the study's primary Bible book; `@1 Tim 2:12` is explicit. Stream gets a “group by verse” toggle (client-side, same data) in Session 2; Session 1 only stores and shows the chip.
- Flags: none

### Q12 — Voice capture
- Asked: Tier 0 (keyboard dictation, zero build) / Tier 1 (Web Speech mic button) / Tier 2 (record → Edge Function → transcription → note).
- Captured: **Tier 2 — talk for ~30 seconds and have it land as a note. Session 3.** Tier 0 still comes free in Session 1 (real textarea, Enter-to-save).
- Design consequence (agent), Session 3 shape: `MediaRecorder` in the PWA (audio/mp4 on iOS, webm elsewhere) → upload to a private `studies-audio` bucket (cap ~2 MB / 60 s; same RLS shape as the scripture bucket) → Edge Function `transcribe_study_note` (user JWT, service-role download, transcription model — OpenAI Whisper/`gpt-4o-transcribe` or Anthropic once it has audio; pick in Session 3 Phase 0) → returns text → lands in the capture line **for review**, not auto-saved, so the `Towner 215` prefix can still be spoken (“Towner two fifteen …”) and fixed. Keep the audio object only until the note is saved, then delete; no attachments table. New secret documented in `supabase/README.md`. Security-review pass (Edge + storage policy).
- Flags: transcription provider + whether to keep audio after save → Parker, Session 3 Phase 0

## Open flags (pending input)
- Proverbs 31 duplicate: keep `archived` (carries the course note) and soft-delete `submitted`? → Parker, Session 1 (default: keep `archived`)
- Transcription provider + audio retention after save → Parker, Session 3 Phase 0
