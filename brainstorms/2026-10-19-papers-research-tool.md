# Papers as a research tool: Brainstorm / Discovery Notes
Date: 2026-10-19 · Goal: Rethink the papers / bibliography surface so papers persist over time with their sources, bibliographies can be imported to start new work (with deselect), and reusable resource presets (language tools, commentaries by Bible book, topics) feed them.

## Prior art (read before grilling)

- Papers Sessions 0–2 shipped ([188](../docs/decisions/188-classwork-research-papers-session-0.md), [189](../docs/decisions/189-classwork-papers-session-1.md), [190](../docs/decisions/190-classwork-papers-session-2.md)): `papers` (title, status draft/in_progress/submitted, optional course/assignment, due_date, topic, `passage_display`, notes), `paper_sources` (book XOR essay, per-source notes, optional group), `paper_research_groups`. Routes `/classwork/papers`, `/classwork/papers/[id]`. Flat compiled bib to clipboard. Orphan papers (no assignment) already allowed.
- Only way to add sources today: `?src_q=` catalog search on the paper page + not-owned stub. No import, no presets.
- `/sermons/by-book` loader already computes "commentaries covering Bible book X" from `book_bible_coverage` + `genre='Commentary'`, with series/author collapse (`collapseCommentaryHits`) and essay-over-parent preference. Reusable for a dynamic commentary preset.
- Library genres already include `Greek/Hebrew Language Tools`, `Pneumatology`, `Christology`, etc.; `book_topics` exists for lowercase topic tags.
- Library `.docx` bibliography export exists (`buildBibliographyDocx`, books only) behind `/library/bibliography/download`.
- Earlier open flag (188 Q8): export sections by *resource type* (commentary / essays / abbreviations) — never built.

## Summary / key decisions
(running synthesis, updated as you go)
- **Container: the paper IS the bibliography.** Extend `papers` (lifecycle statuses, reuse via import-from-paper); no separate `bibliographies` or `research_projects` entity.
- **Home: `/studies` nav umbrella** (one sidebar item replaces Sermons; no mobile tab). Tabs: Overview (default) | Papers | Sermons | By book. Routes `/studies/papers`, `/studies/papers/[id]`, `/studies/sermons`, `/studies/by-book`; 308 redirects from `/classwork/papers*` and `/sermons*`. **Data models stay separate** (`papers` vs `sermons`; `sermons` permissions slug + dashboard tile + MCP unchanged) — the one deliberate cross-cut is the shared `study_sources` junction (Q8). Classwork keeps a Papers link.
- **Overview tab** = small landing: active papers + next sermons.
- **Resource sets = rule + sticky overrides, computed at read time.** `resource_sets` (name, rules ORable: `bible_book` | `genre` | `topic`, `default_for`, `last_reviewed_at`) + `resource_set_members` (book XOR essay; `kind` = include | exclude). Members = rule matches ∪ includes − excludes; new catalog books appear automatically until opted out at the set level. Over-firing acceptable.
- **Seeded sets:** 66 "Commentaries: {Book}" (rule bible_book + genre Commentary), "NT language tools", "OT language tools" (genre rules, pruned by hand), "Systematic Theology" (static: Calvin, van Mastricht, Bavinck, Leiden Synopsis, Turretin; `default_for=sermon`, auto-attached on sermon create).
- **Sets tab in /studies** (not settings): list grouped Bible books / Language tools / Custom with counts + "N new" badge; detail = included + collapsible Excluded (add-back) + rule chips. Same review component used during import.
- **Import flow:** Set (smart suggestion from passage/testament/topical) or prior Paper (notes copied); checklist pre-checked; attached rows greyed; lands in an auto-named research group; per-row remove-from-study vs remove-from-set, both with undo toast.
- **Sermons get sources:** `paper_sources` → `study_sources` (paper XOR sermon); groups study-scoped; `/studies/sermons/[id]` detail page shares `<StudySourcesPanel>`.
- **Usage per source:** candidate (import default) / consulted / cited; bib defaults to consulted+cited. Backlinks: book-detail "Used in" + By book papers column.
- **Hit rate per resource per Bible book:** numerator = expository studies where consulted/cited; denominator = expository (`topical=false`) studies with a *primary* passage on that book dated after `books.acquired_on`. Secondary passages excluded. `books.acquired_on` new (backfill `created_at::date`).
- **`topical` boolean** on papers (default on) and sermons (default off): steers suggestions and defines the denominator.
- **Passages:** papers mirror sermons (`paper_passages`, optional); `role` primary|secondary on both passage tables; `secondary_passage_display` on both parents. Paper header: title primary unless a passage is set.
- **Statuses:** researching / drafting / submitted / published / archived; archived = "complete" terminal reachable from any status; default list hides it; archived view.
- **Export:** clipboard + `.docx`, optional sectioned-by-group. **MCP:** `list_studies`, `get_study_sources`, `suggest_sources` (read-only).
- **Permissions:** new `studies` slug for papers + sets + sources (RLS rewrite → security review); sermons keep `sermons`.

## Q&A log
### Q1 — Durable container
- Asked: Paper-is-container vs separate `bibliographies` entity vs `research_projects` parent.
- Captured: **Paper is the container.** Orphan papers (passage-only, e.g. "1 Cor 14:26–33a") already exist; extend `papers` rather than adding a parent entity.
- Flags: none

### Q2 — Where research lives
- Asked: Promote to `/research` vs stay under classwork; Parker countered with a "Studies" umbrella that also absorbs Sermons.
- Captured: **"Studies" as a nav umbrella only** — sermons and papers keep separate tables/permissions; one sidebar item; tabs Overview | Papers | Sermons | By book. **Default landing = Overview** (active papers + next sermons). Redirects from old routes. Venues stay a settings page (`/settings/sermons/venues`, optional redirect to `/settings/studies/venues`).
- Rationale captured: sermons carry operational weight (venues, logistics, dashboard, MCP); papers carry research weight. Merge nav, not data. Shared home enables a future sermon → paper bibliography link.
- Flags: none

### Q3 — Preset ("resource set") model
- Asked: one table static+dynamic vs static-only vs two tables.
- Captured (Parker's words, paraphrased closely): sets are **effectively static lists that are seeded and kept topped-up by a rule**. "There will always be a resource set for each book of the Bible, start with every commentary I have on that book, I reduce it, then every time a book is added to that category it pulls in automatically until I opt out." Opt-out is **at the set level and sticky** (distinct from removing from one paper/sermon). Rules keyed on **genre** (+ coverage), refined over time; **over-firing is acceptable**. 
- Captured UX: when pulling a set into a paper, review list with per-row **"remove from this paper"** vs **"remove from preset"**, both with **undo toast**. Preset review surface shows **excluded members** so they can be added back.
- Design consequence (agent): implement as **rule + overrides computed at read time** — `resource_sets` (name, optional rule) + `resource_set_members` holding only overrides (`force_include` manual adds, `exclude` sticky opt-outs). Candidates = rule matches ∪ includes − excludes. New catalog books matching the rule appear with zero bookkeeping; no trigger-driven materialization. Pure-static sets (language tools) = no rule, includes only. Add `last_reviewed_at` so "new since you last looked" can be badged.
- Flags: none

### Q4 — Rule kinds + seeded sets
- Asked: which rule kinds in v1; what is seeded.
- Captured: **Rule kinds = `bible_book` (coverage + genre Commentary, by-book collapse logic), `genre`, `topic`; ORable within one set.** **Seed via migration: 66 "Commentaries: {Book}" sets + "NT language tools" + "OT language tools"** (genre-rule seeded, then pruned by Parker). Hand-create others (e.g. "Pneumatology core").
- Emphasis (Parker): **the set-management UI must be clean and easy to use** — first-class surface, not a settings afterthought.
- Flags: none

### Q5 — Set management surface
- Asked: Sets tab in /studies vs /settings vs inline-only.
- Captured: **`Sets` tab inside `/studies`** (tabs: Overview | Papers | Sermons | Sets | By book). List grouped Bible books (canon order, member count, "N new" badge) / Language tools / Custom. Set detail = included members (Remove-from-set) + collapsible "Excluded (N)" (Add-back) + rule chips. **Same review component reused in the paper import flow.**
- Flags: none

### Q6 — Import flow
- Asked: where imports land; whether notes travel from a prior paper.
- Captured: "Import sources…" picker on a paper with two source types — **Set** (smart suggestion: Bible-book set from `passage_display`, NT/OT language tools by testament) or **prior Paper**. Same checklist, all pre-checked, already-attached rows greyed "Attached". **Imports land in an auto-created research group named after the source** ("Commentaries: 1 Corinthians", "NT language tools", "From: <paper title>") — satisfies the 188 resource-type-sections flag. **Per-source notes are copied** when importing from a prior paper.
- Flags: none

### Q7 — Usage tracking + backlinks
- Asked: usage states per source; reverse lookups.
- Captured: **`paper_sources.usage` = candidate (import default) / consulted / cited**, one-tap cycle; compiled bib defaults to consulted+cited with an include-all toggle. **Both backlinks**: book-detail "Used in" section + papers count column on the By book spine.
- Captured (Parker, new): **note when a resource was acquired** — so usage is judged against opportunity, not raw count. **Hit rate per resource per Bible book**: "a commentary I have used 3/3 times may be better than one I have used 4/17 times while preaching through a book." Denominator = sermons/papers on that Bible book *since the book was acquired*; numerator = those where it was consulted/cited.
- Design consequence (agent): `books` has no acquisition date today (only `created_at`, which ≈ import date for the 2026 backfill). Needs a nullable `books.acquired_on date` (backfill = `created_at::date`, editable on book detail / review). Hit-rate needs sermons to also record sources (see Q8) or the denominator is papers-only.
- Flags: acquired-date backfill accuracy for pre-app books → Parker (accept `created_at` default; fix notable ones by hand)

### Q8 — Sermons get sources too
- Asked: sermon→paper link vs shared `study_sources` (paper XOR sermon) vs sermons source-less.
- Captured: **B — `study_sources` with paper XOR sermon** (migrate `paper_sources` → `study_sources`; groups likewise become study-scoped). Sets, import flow, usage, hit rate all work for both.
- Captured (Parker, new): **"Topical" toggle on both papers and sermons** — default **off for sermons, on for papers**. (Interpretation to confirm in Q9: steers which sets are suggested — passage/commentary sets vs genre/topic sets.)
- Captured (Parker, new): **seeded static set "Systematic Theology"** = Calvin *Institutes*, van Mastricht *Theoretical-Practical Theology*, Bavinck *Reformed Dogmatics*, *Synopsis of a Purer Theology* (Leiden Synopsis), Turretin *Institutes of Elenctic Theology*. **Default-included on every sermon.** → implies sets carry a `default_for` (sermon / paper / both) flag.
- Flags: none

### Q9 — Topical semantics + default-set hardness
- Asked: what Topical does; how hard the Systematic Theology default is.
- Captured: **`topical` boolean on papers and sermons** (default off sermons / on papers). (1) Steers which sets are suggested first (off → Bible-book commentary set + testament language tools + Systematic Theology; on → genre/topic sets matched on `topic` text, commentary sets still available when a passage is set). (2) **Also defines the hit-rate denominator**: an expository study on 1 Corinthians counts as an *opportunity* for every 1 Corinthians commentary; a topical study does not. So "used 3/3" means 3 of the 3 expository studies on that book since acquisition.
- Captured: **Systematic Theology set auto-attaches on sermon create** as `candidate` rows in an auto "Systematic Theology" group; sticky set-level excludes respected. Sets carry `default_for` (`sermon` | `paper` | `both` | none).
- Flags: none

### Q10 — Paper lifecycle + passage structure
- Asked: statuses; structured passages on papers.
- Captured statuses: **researching / drafting / submitted / published / archived**, but **not everything passes through published** — a paper must be markable **complete** directly so it goes "out of sight, out of mind", with a view that shows archived. → Treat `archived` as the "complete/done" terminal state reachable from any status (label it "Complete / archived" in UI); default list hides archived; `?show=archived` view.
- Captured passages: **mirror sermons (`paper_passages`) but optional for papers.** Paper display rule: **title is primary unless a passage is set, then the passage leads.** 
- Captured (Parker, new): **secondary passages on both sermons and papers** (mostly topical sermons, but expository ones may study several passages). **Secondary passages do not count in the hit-rate denominator.** 
- Design consequence (agent): `sermon_passages` has no primary/secondary distinction today. Add `role text check in ('primary','secondary') default 'primary'` to `sermon_passages` and new `paper_passages`; add `secondary_passage_display` text on `sermons` and `papers` (synced via `parsePassageDisplay` like the primary string). Hit-rate denominator = studies with a `role='primary'` passage on that Bible book and `topical=false`.
- Flags: none

### Q11 — Export + MCP
- Asked: bib output transports; MCP tools.
- Captured: **Clipboard + `.docx`** (reuse `buildBibliographyDocx`, extend for essays), default scope consulted+cited, **optional sectioned-by-research-group** output (auto import groups become Commentaries / Language tools / Systematic Theology sections). **MCP: `list_studies`, `get_study_sources`, `suggest_sources`** — all read-only, wrapping new loaders.
- Flags: none

### Q12 — Sermon surface + permissions slug
- Asked: where sermon sources live; module slug for new tables.
- Captured: **`/studies/sermons/[id]` detail page** sharing the paper's `<StudySourcesPanel>` (import, groups, usage, cite, compiled bib); Sheet stays for quick metadata edits; list rows link to detail. **New `studies` module_registry slug** for `papers` (RLS rewrite → security-review subagent) + `resource_sets` / members / `study_sources` / `paper_passages`; `sermons*` tables keep the `sermons` slug. Audit-log UI gets a Studies module filter.
- Flags: none

### Q13 — Sequencing + completeness backstop
- Asked: session arc + timing; anything missed.
- Captured: **Arc accepted; start S1 soon** — a paper this semester should use it. **Nothing more to add; lock.** Explicitly left out: global never-pull flag on a book (sticky set excludes cover it), Zotero/BibTeX import, freeform non-library citations (not-owned stubs cover it), rich notes editor.
- Flags: none

## Session arc (locked)
| Session | Goal |
|---|---|
| **0** (this) | Lock + tracker (Studies section) + decision log entry |
| **1** | Schema: `studies` slug; `resource_sets` + `resource_set_members` (overrides only); `paper_sources` → `study_sources` (paper XOR sermon, `usage`); groups → study-scoped; `paper_passages` + `role` on `sermon_passages`/`paper_passages` + `secondary_passage_display`; `topical`; `books.acquired_on` (backfill `created_at::date`); statuses migrate. `/studies` shell + tabs + 308 redirects from `/classwork/papers*`, `/sermons*`. **Sets tab**: list (Bible books canon / Language tools / Custom, member counts, "N new"), detail (included + Excluded add-back + rule chips), shared review component. Seeds: 66 Commentaries sets, NT/OT language tools, Systematic Theology (default_for=sermon). |
| **2** | Paper import flow (Set with smart suggestion by passage/testament/topical; prior Paper with notes copy); auto-named research groups; remove-from-paper vs remove-from-set with undo toasts; usage cycle candidate→consulted→cited; bib scope toggle; Complete/archived + archived view; title-vs-passage display rule. |
| **3** | `/studies/sermons/[id]` detail + shared `<StudySourcesPanel>`; Systematic Theology auto-attach on sermon create; By book papers column; book-detail "Used in"; hit rate per resource per Bible book (expository primary-passage denominator since `acquired_on`). |
| **4** | Sectioned `.docx` (reuse `buildBibliographyDocx` + essays); MCP `list_studies` / `get_study_sources` / `suggest_sources`; Overview tab (active papers + next sermons). |

## Open flags (pending input)
- `books.acquired_on` backfill: default to `created_at::date`; Parker hand-corrects notable commentaries → Parker, during Session 1 smoke
