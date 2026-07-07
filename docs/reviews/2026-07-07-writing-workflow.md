# Product review — fall-semester writing workflow (shelf → catalog → footnote → bibliography → submitted paper)

**Date:** 2026-07-07 (overnight deep dive)
**Scope:** Library module citation path against the **2026-09 hard date** — fall-semester-ready citations including article-level (ABD, TDNT, IVP dictionaries, essay collections).
**Method:** Read-only review of repo code + docs (PLAN.md, POS_Library_Build_Tracker.md, decisions 031/032/056/058/060, `src/lib/library/turabian/`, book-detail + bibliography routes, fixtures + tests). Bounded web research on `.docx` generation only. No DB access; prod-state claims come from decision-log records (e.g. 060's "essays count = 0").

---

## TLDR

- **The formatters are in good shape; the writing-session UX is the gap.** All 20 QA fixtures pass, article-level formatters shipped (058), essays CRUD shipped (060). But a real 20-page exegesis paper is 60–100 footnotes across 15–25 sources, and **40–70 of those are subsequent references — for which the app has no UI at all.** `shortForm` exists in `formatFootnote` but is only ever called from tests.
- **Every copied footnote says `[page]`.** There is no page input anywhere on the copy path — Parker hand-edits every single footnote after paste. Two small affordances (page input + "Copy short form" button) remove more September pain than anything else on the list, at roughly half a session of work.
- **The deferred "short-form registry" (056, row 20) is not needed for September** — and auto-"Ibid." should never be built: ibid-correctness depends on note adjacency in the Word document, which the app cannot see. Position-independent short form is always correct in Turabian 9th ed.; offer it and let Parker choose.
- **Open Question 4 vs. Session 4 reconciles cleanly: the tracker's Q4 resolution ("HTML + plain-text clipboard, no file export") can stand.** The only formatting the clipboard path can't currently deliver is the bibliography's hanging indent — and that's fixable in the existing HTML clipboard payload with inline `<p style="margin-left:0.5in;text-indent:-0.5in">` styles, which Word converts to a native hanging indent on paste. `.docx` export should be a *fallback*, built only if a hands-on Word paste check fails. If it proceeds: `docx` npm (9.7.x, MIT, active — May 2026 release), client-side dynamic import, **not** an Edge Function.
- **Footnote `.docx` export should be skipped permanently** regardless: footnotes live inside Word's footnote layer of an existing paper; a generated file can't inject them. Clipboard is structurally the right transport for notes. Only the compiled bibliography is a plausible file artifact.
- **The article-level pipeline is code-complete but data-empty.** The essay seed is not applied to prod (060: `essays` count = 0; ABD `work_type` still `monograph`, so the essays section is invisible). Beyond the 3 seeded titles (BDAG/ABD/TDNT), no other reference work has `work_type` set — IVP dictionaries, named in the hard date, will dispatch as monographs today.
- **"20 fixtures pass" carries self-reference risk.** Phase 0 drafted expected strings from current output for at least rows 8 and 17 (056 says so for row 8; row 17's footnote visibly duplicates the article title: `…"Canon," in …, s.v. "Canon," 835.`). Passing tests prove stability, not Covenant-correctness. The August shelf QA must validate the *expected strings themselves* against the Covenant guide, not just re-run the suite.
- Working-tree note: Session 3 (megacomponent split) appears in-flight as uncommitted files (`book-form-authors.svelte`, `scripture-ocr-queue.svelte`, etc.). This review does not evaluate those.

---

## Gap list — ranked by September risk

### 1. No subsequent-footnote (short form / ibid.) UI — HIGH

- **Gap:** First-reference footnotes copy fine; second-and-later references have no affordance. `FormatOptions.shortForm` (`'ibid' | 'short'`) is fully implemented in `src/lib/library/turabian/format.ts` (`formatShortFootnote`, lines 192–214) but the only callers are `__tests__/format.test.ts` and the fixtures. The book-detail page calls `formatFootnote(citationInput)` bare (`src/routes/library/books/[id]/+page.svelte` line 157); essays copy has no short form path at all (`formatEssayFootnote` in `article.ts` has no shortForm option).
- **Evidence:** `grep shortForm src/` → hits only in `turabian/format.ts`, `__tests__/`. Decision 056 explicitly deferred the "short-form registry in papers" question.
- **Impact on a real paper:** In a 60–100-footnote paper over 15–25 sources, roughly half to two-thirds of notes are subsequent references. Today each one is hand-typed (`Long, Art of Biblical History, 42.`) or copied-full-then-trimmed — including Greek lemmas and German titles, on a second screen or phone. This is the largest single time sink in the whole workflow.
- **Cheapest viable fix (recommended):** A "Copy short form" button next to the existing Footnote/Bibliography buttons on book detail + essay rows, plus a short-form branch for essays in `article.ts` (`Sanders, "Canon," 836.` / `Kittel, "λέγω," TDNT 4:101.` — TDNT's abbreviated form is already short). No schema, no cross-footnote state, ~half a session. Manual sequencing (Parker decides first vs. subsequent) is acceptable for September — he knows the rule; the app just needs to produce the string.
- **What NOT to build:** auto-"Ibid." The app cannot know note adjacency in the Word doc; an auto-ibid that's wrong produces a *citation error*, the exact failure the module exists to prevent. Short form is position-independent and always valid.

### 2. Article-level pipeline is data-empty on prod — HIGH (owner action, ~30 min)

- **Gap:** `supabase/seed/library_essays_seed.sql` unapplied (060 Surprise: `SELECT count(*) FROM essays` → 0 on 2026-07-06). ABD vol 1 `work_type` still `monograph` in prod, so `<BookEssaysEditor>` is hidden (`showEssaysSection` gates on `reference_work`/`edited_volume`, book-detail page lines 160–162). Beyond the seed's three title matches (BDAG, ABD, TDNT), **no reference work has `work_type` set** — the Pass 1 import predates the column (added `20260519120000`, default `monograph`).
- **Impact:** Every ABD/TDNT/IVP citation is blocked or wrong-dispatched until this lands. IVP dictionaries (DJG/DPL/DNTB…) are named in the September hard date and will currently cite as monographs with no essays section.
- **Cheapest viable fix:** (a) Owner pastes the seed (already PLAN.md Next-up #1). (b) One idempotent SQL sweep setting `work_type = 'reference_work'` / `'edited_volume'` across the shelf's reference works — the Citation Critical genres (`Biblical Reference` + language-tools) are a good candidate list to review; August shelf QA verifies. Alternatively drill via `/library/review`, but a targeted SQL pass is an hour, not a week.
- **Ongoing burden check (evaluate #3):** essay data entry itself is fine — entry-on-demand at citation time (title + pages + author autocomplete ≈ 30–60 s per new article, `<BookEssaysEditor>` single-row form). Nobody should pre-catalog all of ABD; 3–8 articles per paper is the realistic load.

### 3. `[page]` placeholder on every copied footnote — MEDIUM-HIGH

- **Gap:** No page-number input on any copy surface. `formatFootnote` defaults `page` to `'[page]'` (`format.ts` line 218); the detail-page copy buttons pass no options. Essays use stored `page_start`/`page_end` — which is the *article's* page range, not the page being cited.
- **Impact:** 60–100 post-paste edits per paper, each a chance to leave a literal `[page]` in a submitted document. (Bible copy is quirkier still: it emits `[page] (English Standard Version).` where `[page]` is really the passage ref.)
- **Cheapest viable fix:** one small text input beside the copy buttons feeding `opts.page` (and essay `opts.page`). Pairs naturally with gap 1's short-form button — same UI touchpoint, one session together.

### 4. Fixture self-reference — expected strings not externally validated — MEDIUM

- **Gap:** 056 records that fixture strings were "drafted from tracker/test corpus" and documents row 8 as "current output, not aspirational Covenant ordering." Row 17 (signed ABD article) has the same smell: the footnote duplicates the article title — `James A. Sanders, "Canon," in David Noel Freedman, ed., Anchor Bible Dictionary (New York: Doubleday, 1992), s.v. "Canon," 835.` (`formatSignedDictionaryFootnote`, `article.ts` lines 121–139, interpolates `quotedTitle(article)` twice). Standard Turabian signed-dictionary form is one title mention (`…, "Canon," in The Anchor Bible Dictionary, ed. David Noel Freedman…, 1:837` or the abbreviated `ABD 1:837`).
- **Impact:** A professor's red pen in October is the failure mode; "20/20 green" gives false comfort where the expected string itself is wrong.
- **Cheapest viable fix:** during August shelf QA, validate the 20 *expected strings* line-by-line against the Covenant Turabian guide (the `.claude/skills/turabian-qa/` skill already exists for this), fix `article.ts` where they diverge, and update fixtures to the corrected form. Contained work — the dispatch and joiners are sound.

### 5. Compiled bibliography excludes essay entries — MEDIUM

- **Gap:** `/library/bibliography?ids=` accepts book ids only and formats book-level entries (`formatCompiledBibliography` over `BookCitationInput[]`). Signed-article bibliography entries (`Sanders, James A. "Canon." In Anchor Bible Dictionary…`) exist only as per-essay copy buttons on each parent volume's detail page.
- **Impact:** A paper citing 3–8 signed articles requires copying each essay bib individually and hand-merging into the pasted bibliography in alphabetical order. Unsigned entries (BDAG s.v.) correctly need no bib entry, so the merge load is small but real.
- **Cheapest viable fix for September:** accept the manual merge (minutes per paper). The proper fix — a paper-scoped "cited works" session that compiles books + essays together — is the same feature as the deferred short-form registry and should be one future design, not two (see Proposed decision D4).

### 6. Bibliography hanging indent doesn't survive paste — MEDIUM (the actual Session 4 driver)

- **Gap:** `formatCompiledBibliography` wraps entries in bare `<p>` tags (`bibliography.ts` line 32). Italics survive Word paste (the `<i>` tags carry); hanging indent doesn't exist in the payload at all. Q4 (tracker line ~545) was resolved 2026-05-16 as "HTML + plain-text clipboard, no file export" before this was noticed; the Wave 2 Session 4 row (".docx export (hanging indent + italics)") was added in 056 as the assumed fix. The two are only in conflict if `.docx` is the only way to get a hanging indent — it isn't.
- **Impact:** After pasting a 20-source bibliography, Parker selects all and applies Format → Paragraph → Hanging in Word. One manual step per paper; annoying, not fatal.
- **Cheapest viable fix:** add inline styles to the compiled HTML — `<p style="margin-left:0.5in;text-indent:-0.5in;">…</p>`. Word converts inline paragraph styles on `<p>` (not `<div>`) into native indents under default/Keep-Source-Formatting paste (verified pattern; needs one hands-on check in Parker's actual Word). ~15 lines of change. Full reconciliation in the Session 4 section below.

### 7. `needs_review` books produce plausible-but-incomplete citations — MEDIUM-LOW

- **Gap:** `formatFootnote`/`formatBibliography` silently omit missing pieces (`formatPublicationFacts` returns empty for null publisher/year — `publication.ts` lines 66–77), and the copy buttons disable only when output is fully empty. The detail page does show a "Needs review" badge near the buttons (page line 760), which mitigates.
- **Impact:** A review-queue book cited mid-paper yields e.g. a footnote with no publication facts — visually fine in Word, wrong on submission. The Citation Critical slice burndown (denominator 265 in `review-progress.ts`) is the systemic defense; its current remaining count isn't visible from the repo — check the `/library/review?slice=critical` counter.
- **Cheapest viable fix:** an amber caption under the copy buttons when `needs_review` or `computeMissingImportant` (already exported from `book-actions.ts`) is non-empty: "Citation may be incomplete — missing: publisher, year." ~20 lines. Plus: keep draining the critical slice before Sept 1 (when `defaultReviewSlice()` flips the default to backlog).

### 8. TDNT-abbreviated dispatch keyed on translator presence — LOW-MEDIUM

- **Gap:** `volumeUsesAbbreviatedArticleCite` (`article.ts` lines 65–69) selects the `Kittel, "λέγω," TDNT 4:100.` form only when the parent volume has a `series_abbreviation` **and a translator row**. TDNT qualifies (Bromiley); IVP dictionaries and other abbreviation-cited works without translators fall through to the long signed-dictionary form.
- **Impact:** Long form is never *wrong*, so this is a style/verbosity issue, not a correctness one — but the heuristic is an undocumented data dependency (delete TDNT's translator row and its citations silently change shape).
- **Cheapest viable fix:** none required for September. When touched next, key the choice on something intentional (e.g. presence of `series_abbreviation` on a `reference_work`, or a per-book flag) and document in the decision log.

### 9. `essays.page_start`/`page_end` are INT — LOW

- **Gap:** Baseline schema (`00000000000000_baseline.sql` lines 383–393) types essay pages as INT, while `scripture_references` and `book_topics` use TEXT — the tracker's own gotcha ("Page numbers are TEXT, not INT — schema handles `IV.317`, `xiv`") applies. Roman-numeral or column-numbered reference works can't be recorded.
- **Fix:** none now; migrate to TEXT only when a real volume hits it.

### 10. Minor notes (no action for September)

- `loadBookCitationInputs` fans out one `loadBookDetail` per id (`loaders.ts` lines 1645–1658) — a 25-source bibliography is 25+ round-trips; fine at this scale, batch later if it drags.
- Bibliography sort orders `lastName → year → title` (`bibliography.ts`); Turabian sorts same-author works by title (or chronologically, consistently). Repeated-author entries repeat the name (no 3-em dash) — acceptable per CMOS 17's own retreat from the dash.
- August shelf QA of all 20 rows is already tracked; keep it — several fixture strings (Payson, Barker/Long) encode shelf metadata drafted from memory.

---

## Session 4 recommendation — and the Open Question 4 reconciliation

**Reconciliation.** Q4's resolution (2026-05-16: "HTML + plain-text clipboard, no file export") and the Wave 2 Session 4 row (".docx export") were written at different times against different information: Q4 predates anyone noticing the hanging-indent hole, and 056 penciled ".docx" as the assumed fix without costing alternatives. The evidence now says: **clipboard HTML can carry the hanging indent** (inline `margin-left` + negative `text-indent` on `<p>` elements converts to a native Word hanging indent on paste), and *footnotes could never sensibly be a file export anyway* — they must land inside the footnote layer of an existing Word document, which only the clipboard can reach. So Q4's "no file export" stands as the default posture, and Session 4 is re-scoped from "build .docx export" to **"close the September writing-session gaps, with .docx as a contingency."**

**What Session 4 should ship:**

1. **Bibliography paste fidelity** — hanging-indent inline styles (0.5 in) in `formatCompiledBibliography` HTML; optional font-size/family hints. Acceptance = hands-on paste into Parker's Word (macOS) shows native hanging indent + italics with no manual fixup.
2. **Short-form copy** — "Copy short form" beside Footnote/Bibliography on book detail and essay rows; essay short-form branch in `article.ts` (gap 1).
3. **Page input** — small field feeding `opts.page` for footnote + short-form copies on book detail and essay rows (gap 3).
4. **Incomplete-citation hint** — amber caption via `computeMissingImportant` (gap 7).

**What Session 4 should skip:**

- **Footnote `.docx` export** — permanently; structurally wrong transport.
- **Compiled-bibliography `.docx` export** — build only if the paste check in (1) fails. It's a contingency line in the acceptance list, not the session goal.
- **The short-form registry / paper-scoped citation session** — not needed for September (see D4). Manual first-vs-subsequent sequencing plus a short-form button is fully workable for a semester.
- **Auto-"Ibid."** — never; correctness depends on document adjacency the app can't observe.

**Library choice if .docx proceeds (the contingency):** use the **`docx` npm package** (dolanmiu/docx v9.7.x — MIT, TypeScript, 15.6M weekly downloads, active May–June 2026 releases; first-class browser support via `Packer.toBlob`; native `indent: { hanging }` + `italics` on paragraphs/runs). Generate **client-side** behind a dynamic `import()` per the repo's bundle rule (4.4 MB unpacked; keep it out of base chunks). **Not** an Edge Function: the pdf-lib-in-Edge precedent exists because invoice PDFs are emailed server-side via Resend; a bibliography is a local download with no secrets and no server involvement — shipping it through Edge adds a deploy surface and CORS for zero benefit. Hand-rolled OOXML: rejected — real .docx is a zip of ~6 XML parts and the `docx` package is maintenance-free by comparison. `html-docx-js`-style MHT converters: rejected — unmaintained, and Word-version-fragile.

---

## Proposed decisions (for Parker — pick one per question)

**D1 — Subsequent footnotes for September**
- **(a) "Copy short form" button + page input on book detail + essay rows (no cross-footnote state).** ← *recommended — removes the biggest per-paper time sink at half-session cost*
- (b) Full paper-scoped citation session (tracks first references, auto-offers short form) as a Wave 2 session before September.
- (c) Nothing — hand-type short forms all semester.

**D2 — Session 4 scope / Q4 reconciliation**
- **(a) Re-scope Session 4 to "writing-session gaps": clipboard hanging-indent styles + short-form + page input + incomplete-citation hint; .docx only as a contingency if the Word paste check fails. Q4's "no file export" stands.** ← *recommended*
- (b) Ship compiled-bibliography `.docx` export as planned (docx npm, client-side); keep footnotes clipboard-only.
- (c) Both: clipboard fixes *and* .docx export in one session.

**D3 — .docx library (only if D2 lands on b/c, or the contingency fires)**
- **(a) `docx` npm, client-side, dynamic import.** ← *recommended*
- (b) Edge Function generation (pdf-lib-style).
- (c) Hand-rolled OOXML template.

**D4 — Essay entries in the compiled bibliography**
- **(a) Accept manual merge for September (3–8 signed entries per paper); design the paper-session feature later as ONE feature covering both the short-form registry and books+essays bibliography compilation.** ← *recommended*
- (b) Quick hack now: `/library/bibliography` also accepts `essay_ids=` and interleaves `formatEssayBibliography` output alphabetically.
- (c) Include *all* essays of any selected volume (wrong: cites articles you didn't use).

**D5 — `work_type` backfill for reference works beyond BDAG/ABD/TDNT**
- **(a) One idempotent SQL sweep (reviewed list, seed-style `WHERE NOT EXISTS` guards) + August shelf verification.** ← *recommended*
- (b) Organic: fix each volume via `/library/review` or the book form as encountered mid-paper.

**D6 — Fixture external validation (gap 4)**
- **(a) Fold into August shelf QA: validate the 20 expected strings against the Covenant guide itself (turabian-qa skill), fix `article.ts` row-17 title duplication if confirmed wrong.** ← *recommended*
- (b) Do it now, pre-August, as part of Session 4.

---

## Copy-paste-ready Session 4 prompt (house format)

```
Session: library — Wave 2 Session 4 (writing-session gaps: short form, page input, bibliography paste fidelity)
Tracker: docs/POS_Library_Build_Tracker.md, Wave 2 Session 4
Read: AGENTS.md, .cursor/rules/library-module.mdc, docs/reviews/2026-07-07-writing-workflow.md,
 docs/decisions/058-library-wave2-session1-article-formatters.md,
 docs/decisions/060-library-wave2-session2-essays-ui.md,
 src/lib/library/turabian/ (format.ts shortForm path, article.ts, bibliography.ts, clipboard.ts),
 docs/library-turabian-fixtures.md (row 20)
Supabase: hosted `db push` only (no local Docker stack) — no migration expected this session
Goal: Make the per-footnote flow real-paper-ready (subsequent references + page numbers) and make the
 compiled bibliography paste into Word with a native hanging indent — reconciling tracker Open Question 4
 ("clipboard, no file export" stands; .docx is contingency-only per docs/reviews/2026-07-07-writing-workflow.md).
Acceptance:
 - [ ] "Copy short form" button beside Footnote/Bibliography on /library/books/[id] (books) and on essay rows;
       books use formatFootnote({ shortForm: 'short' }); essays get a short-form branch in article.ts
       (signed: `Sanders, "Canon," 836.`; TDNT abbreviated form already short — reuse)
 - [ ] Page input beside the copy buttons feeds opts.page for footnote + short-form copies (books + essays);
       empty input keeps the `[page]` placeholder
 - [ ] No auto-"Ibid." anywhere — short form is the only subsequent-note affordance (position-independent)
 - [ ] formatCompiledBibliography HTML wraps entries in <p style="margin-left:0.5in;text-indent:-0.5in;">;
       plain-text payload unchanged
 - [ ] Owner hands-on check: paste bibliography + one footnote into Word (macOS) — italics AND hanging
       indent survive with default paste; if hanging indent fails, file the contingency: .docx export via
       `docx` npm (client-side, dynamic import) for the compiled bibliography ONLY — do not build it preemptively
 - [ ] Amber "Citation may be incomplete — missing: …" caption under the copy buttons when book.needs_review
       or computeMissingImportant(...) is non-empty
 - [ ] Unit tests: essay short form + a compiled-bibliography HTML assertion; fixture row 20 stays green
 - [ ] npm run check + npm run test pass
 - [ ] Mobile-width screenshot of the copy row (buttons + page input) on book detail
End-of-session deliverables:
 - [ ] tracker Wave 2 Session 4 marked done with notes (Q4 reconciliation recorded)
 - [ ] docs/decisions/<next-free-NNN>-library-wave2-session4-writing-session.md filed
 - [ ] PLAN.md refreshed (last-updated, Recent decisions, Next up)
 - [ ] components.mdc / AGENTS.md inventory updated if the copy row becomes a shared component
```

---

## Owner pre-session checklist (independent of Session 4)

1. Apply `supabase/seed/library_essays_seed.sql` in the Dashboard SQL editor; smoke ABD vol 1 essays + audit row (060 owner-smoke steps).
2. Run/commission the `work_type` SQL sweep for the remaining reference works + edited volumes (D5a).
3. Check `/library/review?slice=critical` remaining count; keep draining before Sept 1 (default slice flips to backlog on 2026-09-01 per `review-progress.ts`).
4. August shelf QA: verify the 20 fixture rows against physical volumes **and** validate the expected strings against the Covenant guide (D6a), with special attention to rows 8 and 17.
