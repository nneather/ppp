# Personal Operations System — Studies Module Build Tracker

_Last updated: 2026-10-23 | Module: Studies | By verse reads Calvin, Bavinck, van Mastricht, Turretin, Leiden, then volume and page ([301](decisions/301-systematics-verse-reading-order.md))_

**Read before any session:** [docs/MODULE_KICKOFF_PLAYBOOK.md](MODULE_KICKOFF_PLAYBOOK.md), [243](decisions/243-studies-session-0.md), papers retro [188](decisions/188-classwork-research-papers-session-0.md) / [189](decisions/189-classwork-papers-session-1.md) / [190](decisions/190-classwork-papers-session-2.md), sermons [090](decisions/090-sermons-session-0.md) / [095](decisions/095-sermons-by-book-stats.md). Brainstorm: [brainstorms/2026-10-19-papers-research-tool.md](../brainstorms/2026-10-19-papers-research-tool.md).

---

## Critical path

Core value — **a study (paper or sermon) can pull a maintained resource set and keep a bibliography that outlives the semester.**

- **End of Session 1** = schema + `/studies` shell + Sets list/detail (rule + sticky overrides).
- **Session 2** = import into a paper (set or prior paper) + usage + archived view.
- **Session 3** = sermon detail shares the sources panel; hit rate.
- **Session 4** = sectioned `.docx` + read-only MCP + Overview polish.

---

## Phase 0 — Structure Lock (signed off 2026-10-19)

| Gate | Resolution |
|---|---|
| **Taxonomy singular** | The paper is the bibliography container. No `bibliographies` or `research_projects` table. Sermons stay a separate table. Shared junction is `study_sources` (paper XOR sermon). Resource sets are rule + sticky overrides, resolved at read time — members are not materialized on insert. |
| **Nav** | One desktop sidebar item **Studies** replaces Sermons. Tabs: Overview (default) \| Papers \| Sermons \| Sets \| By book. Routes under `/studies/*`. 308 from `/classwork/papers*` and `/sermons*`. Venues stay `/settings/sermons/venues`. Classwork keeps a Papers link. Phone bottom bar last slot is Studies ([292](decisions/292-mobile-tab-studies.md)); Session 0 “no mobile tab” is superseded. |
| **Nullable / required** | Papers: `title` + `status` required. Sets: `name`, `slug`, `kind`, `rules` (default `[]`), `default_for` (default `{}`). Set members: `set_id` + book XOR essay + `kind` include\|exclude\|dismiss. Study sources: exactly one parent (paper XOR sermon) + book XOR essay; `usage` default `candidate`. Passages: `bible_book` required; `role` default `primary`. |
| **Form delivery** | Sets list + detail are pages (`/studies/sets`, `/studies/sets/[id]`). Paper identity stays a Sheet; paper detail stays the research home. Sermon metadata stays a Sheet; sermon sources detail is Session 3. |
| **RLS + viewer** | New `studies` slug for papers, groups, sources, sets, set members, `paper_passages`. SELECT `app_is_owner() OR app_has_module_read('studies')`; writes owner-only. Viewer write **waived** v1. Sermons tables keep `sermons`. |
| **Seed** | 66 `Commentaries: {Book}` (`bible_book` rule; Commentary genre applied by the resolver, not stored as a second rule). NT language tools (`Greek Language Tools`). OT language tools (`Hebrew Language Tools`). Systematic Theology static includes, `default_for={sermon}` — auto-attach on sermon create is Session 3. |
| **Edge Function ↔ `deleted_at`** | N/A. |

**Checklist:**

- [x] Taxonomy singular
- [x] Nullable matrix signed
- [x] Routes / form surfaces decided
- [x] RLS plan (`studies` slug; sermons unchanged)
- [x] MCP deferred to Session 4
- [x] Open questions ≤2 per entity

---

## Schema sketch (Session 1 ships `ppp_studies_v1`)

Standard conventions: `deleted_at`, `created_at` / `updated_at` + `set_updated_at`, `created_by`, audit trigger, explicit GRANTs, RLS helpers only.

### `resource_sets`

```sql
resource_sets
  id               UUID PRIMARY KEY
  name             TEXT NOT NULL
  slug             TEXT NOT NULL          -- partial unique while live
  kind             TEXT NOT NULL CHECK (kind IN ('bible_book','language','custom'))
  rules            JSONB NOT NULL DEFAULT '[]'
                   -- array of {kind:'bible_book'|'genre'|'topic', value}
  default_for      TEXT[] NOT NULL DEFAULT '{}'
                   -- values subset of sermon, paper
  last_reviewed_at TIMESTAMPTZ            -- null = never reviewed; "N new" stays 0
  sort_order       INT NOT NULL DEFAULT 0
  deleted_at, created_at, updated_at, created_by
```

**Read-time members** = rule matches ∪ `include` overrides − `exclude` overrides. A `bible_book` rule matches Commentary coverage for that book (same collapse as `/sermons/by-book`). Genre and topic rules match catalog books. New catalog rows appear until sticky-excluded.

### `resource_set_members` (overrides only)

```sql
resource_set_members
  id, set_id, book_id XOR essay_id,
  kind TEXT NOT NULL CHECK (kind IN ('include','exclude')),
  deleted_at, created_at, updated_at, created_by
```

Partial unique `(set_id, book_id)` and `(set_id, essay_id)` while live — one override per catalog row.

### Rename

- `paper_sources` → `study_sources`: `sermon_id` nullable; `paper_id` nullable; XOR parent; `usage` `candidate` \| `consulted` \| `cited` default `candidate`. Partial uniques widened to sermon parent.
- `paper_research_groups` → `study_research_groups`: `sermon_id` nullable; `paper_id` nullable; XOR parent.

### Passages + flags

- `paper_passages` mirrors `sermon_passages`.
- `role` `primary` \| `secondary` default `primary` on both passage tables. Secondary passages are display-only for hit-rate (Session 3).
- `secondary_passage_display` on `papers` and `sermons`.
- `topical` boolean: papers default **true**, sermons default **false**.
- `papers.status`: `researching` \| `drafting` \| `submitted` \| `published` \| `archived`. Migrate `draft` → `researching`, `in_progress` → `drafting`. Default list hides `archived` (archived view is Session 2).
- `books.acquired_on date`, backfill `created_at::date`.

### Nullable / required matrix

| Table | Required | Nullable |
|---|---|---|
| `papers` | `title`, `status`, `topical` (default true), `sort_order` | `course_id`, `assignment_id`, `due_date`, `topic`, `passage_display`, `secondary_passage_display`, `notes`, `created_by` |
| `study_research_groups` | `name`, XOR parent, `sort_order` | the other parent, `created_by` |
| `study_sources` | XOR parent, XOR book/essay, `usage` (default), `sort_order` | `group_id`, `notes`, `created_by` |
| `paper_passages` | `paper_id`, `bible_book`, `role` (default), `sort_order` | chapter/verse ends, `created_by` |
| `resource_sets` | `name`, `slug`, `kind`, `rules`, `default_for`, `sort_order` | `last_reviewed_at`, `created_by` |
| `resource_set_members` | `set_id`, XOR book/essay, `kind` | `created_by` |

### RLS / audit

- Papers, groups, sources, `paper_passages`, sets, set members: module `studies`.
- Sermons + `sermon_passages`: module `sermons` (unchanged), new columns only.
- Audit UI: `_STUDIES_TABLES`; soft-delete revert for the studies tables. Drop renamed names from `_CLASSWORK_TABLES`.

---

## Open questions (≤2 per entity)

| # | Entity | Q | Resolve by |
|---|---|---|---|
| S1 | resource set | Systematic Theology seed: which catalog titles count as Calvin / van Mastricht / Bavinck / Leiden Synopsis / Turretin? | Session 1 — exact title + genre `Systematic Theology` (multi-volume includes). Empty includes only if a title is missing. |
| B1 | book | `acquired_on` backfill from `created_at::date` is the day the row was entered. | Dates stay stored ([287](decisions/287-queue-paper-and-acquired-on.md)). Hit rate for those rows starts 2027-01-01 when the helper is next touched; a real earlier date is the window ([288](decisions/288-hit-rate-epoch-2027.md)). |

---

## Session arc

| Session | Status | Goal |
|---|---|---|
| 0 | ✅ 2026-10-19 | Phase 0 + this tracker + [243](decisions/243-studies-session-0.md) |
| 1 | ✅ 2026-10-19 | `ppp_studies_v1` applied. `/studies` shell + moved papers/sermons/by-book + 308s. Sets list/detail. Seeds: 66 commentary sets, NT/OT language tools, Systematic Theology (18 volume includes). [244](decisions/244-studies-session-1.md). |
| 2 | ✅ 2026-10-19 | Import (set or prior paper) → auto-named group; remove-from-study vs remove-from-set with undo; usage cycle; bib scope; Complete/archived view; title-vs-passage display. [245](decisions/245-studies-session-2.md). |
| 3 | ✅ 2026-10-19 | `/studies/sermons/[id]` + shared sources panel; Systematic Theology auto-attach on sermon create; By book papers column; book-detail "Used in"; hit rate (expository + primary passage + since `acquired_on`). [247](decisions/247-studies-session-3.md). |
| 4 | ✅ 2026-10-19 | Sectioned `.docx` + clipboard; MCP `list_studies` / `get_study_sources` / `suggest_sources`; Overview (in-progress papers + upcoming sermons). [248](decisions/248-studies-session-4.md). |

### Session 1 acceptance

- [x] Migration applied (`db push` + `gen-types`)
- [x] `studies` slug; papers/groups/sources RLS moved; sermons slug unchanged
- [x] Seeds: 66 commentary sets, NT/OT language tools, Systematic Theology (`default_for` sermon; 18 volumes)
- [x] `/studies` tabs; papers + sermons + by-book moved; old paths 308
- [x] Sets list (Bible books / Language / Custom, counts, N new) + detail review (included, excluded add-back, rule chips)
- [x] Audit whitelist + `npm run check` + `npm run test` (582) + `npm run build`
- [x] Security review launched on the uncommitted diff (RLS)

### Session 2 acceptance

- [x] Import from set (suggestion from passage / testament / topical) or prior paper (notes copied)
- [x] Auto-named research group; checklist; already-attached rows greyed
- [x] Remove-from-study vs remove-from-set, both undo
- [x] Usage candidate → consulted → cited; compiled bib defaults to consulted+cited
- [x] Archived = complete terminal; default list hides it; `?show=archived`

### Session 3 acceptance

- [x] Sermon detail shares the sources panel
- [x] New sermon auto-attaches Systematic Theology as `candidate` rows, respecting set excludes
- [x] By book papers column + book-detail "Used in"
- [x] Hit rate per resource per Bible book

### Session 4 acceptance

- [x] Clipboard + `.docx`, optional sectioned-by-group
- [x] Read-only MCP tools wrapping loaders
- [x] Overview: active papers + upcoming sermons (stub may land in Session 1)

### Follow-on (not a tracker session)

- [x] Overlapping passage sections import as the book; footnote page prefills from the tightest span ([251](decisions/251-studies-passage-section-import.md)). Sections stay off by-book, hit rate, and auto-attach.
- [x] Sets sections collapse; commentaries load; Septuagint under Language tools; reference-only; multi-select move/dismiss ([257](decisions/257-sets-sections-septuagint.md)).
- [x] New paper on `/studies/papers` opens that paper ([275](decisions/275-new-paper-opens-detail.md)).
- [x] Import sources is a large dialog with authors / abbreviations ([276](decisions/276-import-sources-detail-dialog.md)).
- [x] Import picker research UX: collapsed sections, series leads, checklist JSON, Not included / New set / Save as set ([277](decisions/277-import-picker-research.md)).
- [x] Commentary standing: park on the book or essay (Matthew Henry seeded). Active counts exclude parked rows. A sermon can hide one locally ([303](decisions/303-commentary-shelf-standing.md)).
- [x] Phone commentary rows lead with the series. Stars and Attach / Dismiss share the next line ([304](decisions/304-sermon-commentary-mobile.md)).
- [x] Ranking a commentary on a sermon saves the stars without reloading. The shelf re-sorts on the next load ([305](decisions/305-sermon-commentary-rating-stay.md)).
- [x] Attach on a systematic hit marks that hit only. It does not add the volume or reload the sermon ([302](decisions/302-systematic-hit-attach.md)).
