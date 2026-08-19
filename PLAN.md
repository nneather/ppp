# PLAN.md — Parker's Platform (ppp)

**Last updated:** 2026-08-19 — Desktop Now task rail ([205](docs/decisions/205-desktop-now-task-rail.md)); prior Knoppers AB 1 Chronicles 10–29 vol 12A ([204](docs/decisions/204-library-knoppers-ab-1-chronicles.md)).

**How to use this file — read this first:**

- **What this file is:** the *current* state of ppp — active focus, live session prompts, and the Next-up queue. **Keep it lean.** It's pasted into every Claude.ai "Parker's Platform" session and auto-read by Cursor, so every line costs context on every session.
- **Where history lives (NOT here):** completed work is recorded in **`docs/decisions/NNN-*.md`** (one per session/decision) and the per-module **`docs/POS_*_Build_Tracker.md`**. This file *points* to them; it does not duplicate them. When you need past detail, look there.
- **At the end of every session, in this order:**
  1. Write/append the decision doc: `docs/decisions/<next-free-number>-*.md` (format: see any recent one).
  2. Tick the module's `docs/POS_*_Build_Tracker.md`.
  3. Update this file: bump **Last updated**; refresh the module row's *state* (a short status, **not** a citation trail); add one line to **Recent decisions** and **trim that list back to the last 5**; and **delete any session prompt you just completed** (its detail now lives in the decision doc).
- **Prompt policy:** keep a full copy-paste prompt only for *Do-now / Next* work. Deferred / someday items get a **one-line pointer** to their decision doc, not a full block.

---

## Current focus

**Fall semester window ([138](docs/decisions/138-fall-semester-priorities.md) / [139](docs/decisions/139-lightweight-crm-fall-priority.md)):** **classwork** + **lightweight CRM/contacts** (meet cadence, Christmas cards; mailing-list send later).

- **Classwork** — Sessions 0–2 shipped ([153](docs/decisions/153-classwork-session-1.md), [161](docs/decisions/161-classwork-session-2.md)). **Papers Sessions 1–2 shipped** ([189](docs/decisions/189-classwork-papers-session-1.md), [190](docs/decisions/190-classwork-papers-session-2.md)) — publication surface + research groups live for the St. Louis edit.
- **Contacts / CRM** — Sessions 1–3 + list mass-add ([183](docs/decisions/183-contacts-list-mass-add.md)). Lists checklist + sheet list toggles. Thin v1 target ~Thanksgiving; mailing send later.
- **MCP read-only v1** ([144](docs/decisions/144-ppp-mcp-readonly-v1.md)) + classwork tools ([161](docs/decisions/161-classwork-session-2.md)) + health filters ([164](docs/decisions/164-mcp-list-project-health-filters.md)) + `list_week_tasks` ([165](docs/decisions/165-mcp-list-week-tasks.md)/[184](docs/decisions/184-mcp-monday-protocol-finetune.md)) + contacts ([180](docs/decisions/180-contacts-session-2.md)).
- Madison shelf QA after Aug 9. Personal priorities: `~/Neal/context/current-priorities.md`.

Nearest hard dates:
- **2026-08-09** — return from Madison; library Wave 2 execution + shelf QA window opens.
- **2026-08-31** — fall semester starts; classwork ready; fall-semester-ready citations, **incl. article-level** (signed articles/essays: ABD, TDNT, IVP dicts, essay collections).

---

## Active modules

| Module | Tracker | State |
|---|---|---|
| Invoicing | [docs/POS_Invoicing_Build_Tracker.md](docs/POS_Invoicing_Build_Tracker.md) | ✅ Code complete (Sessions 1–6) + ad-hoc polish. PDF send confirmed ([185](docs/decisions/185-invoice-pdf-received-resolved.md)). Historical FOL + TWH hours ([196](docs/decisions/196-invoicing-historical-fol-twh-hours.md)). Analytics + **YTD range** + first-class one-offs ([197](docs/decisions/197-invoicing-analytics.md)/[201](docs/decisions/201-invoicing-analytics-range-one-offs.md)). List **one-tap mark-paid** + undo ([202](docs/decisions/202-invoicing-list-mark-paid.md)). **Open:** key rotation (#4, Sep 2026); optional invoice period reconstruction. |
| Library | [docs/POS_Library_Build_Tracker.md](docs/POS_Library_Build_Tracker.md) | ✅ Trip build + Wave 2 Sessions 1–4 complete; owner smokes ✅. **Open:** August shelf QA Track B + "Needs the shelf" (65) — Madison. Catalog consistency P0/P1 remint ✅ ([177](docs/decisions/177-catalog-consistency-audit-track-b.md)). Aug 3 shelf batch + KCC ✅ ([191](docs/decisions/191-library-aug3-shelf-batch.md)). Language + coverage integrity ✅ ([192](docs/decisions/192-library-language-coverage-integrity.md)); German edition ISBN follow-up ✅ ([193](docs/decisions/193-german-edition-isbn-corrections.md)); ISBN integrity Collins + dups ✅ ([194](docs/decisions/194-library-isbn-integrity-collins-dups.md)); Aug 5 Shepherd/Noll/Vallier ✅ ([195](docs/decisions/195-library-aug5-shepherd-noll-vallier.md)); Aug 12 classics/commentaries + Fitzgerald Homer ✅ ([198](docs/decisions/198-library-aug12-shelf-batch.md)); Charles ICC Revelation 2-vol ✅ ([199](docs/decisions/199-library-charles-icc-revelation.md)); Aug 15 Holland / Fitzmyer AB / Shirer ✅ ([200](docs/decisions/200-library-holland-fitzmyer-shirer.md)); Lincoln WBC Ephesians 1990 ✅ ([203](docs/decisions/203-library-lincoln-wbc-ephesians.md)); Knoppers AB 1 Chronicles 10–29 ✅ ([204](docs/decisions/204-library-knoppers-ab-1-chronicles.md)). |
| Projects | [docs/POS_Projects_Build_Tracker.md](docs/POS_Projects_Build_Tracker.md) | ✅ v1 complete + fall MYN polish + desktop home dashboard + **persistent desktop Now rail** ([205](docs/decisions/205-desktop-now-task-rail.md)) + MCP week/health finetune ([184](docs/decisions/184-mcp-monday-protocol-finetune.md)). Owner E2E smoke 2026-07-22 passed. Viewer access owner-only by design. |
| Sermons | [docs/POS_Sermons_Build_Tracker.md](docs/POS_Sermons_Build_Tracker.md) | ✅ v1 Sessions 1–2 + by-book series/dedupe. List + by-book smoke passed. |
| Classwork | [docs/POS_Classwork_Build_Tracker.md](docs/POS_Classwork_Build_Tracker.md) | ✅ Sessions 0–2 + **Papers Sessions 0–2** ([190](docs/decisions/190-classwork-papers-session-2.md)) — `/classwork/papers` research surface complete (attach books/essays/stubs, cite, compiled bib, research groups). Backlog: Canvas import ([173](docs/decisions/173-canvas-classwork-import-deferred.md)). |
| Contacts / CRM | [docs/POS_Contacts_Build_Tracker.md](docs/POS_Contacts_Build_Tracker.md) | ✅ Sessions 1–3 + mass-add ([183](docs/decisions/183-contacts-list-mass-add.md)) — Lists checklist, sheet toggles, meet vs card, card bulk log. MCP smoke open (`contacts_with_cadence` on due tool — [184](docs/decisions/184-mcp-monday-protocol-finetune.md)). Mailing send later; **≠ library `people`.** |
| MCP | [scripts/ppp-mcp/README.md](scripts/ppp-mcp/README.md) | ✅ Read-only v1 + Monday-protocol finetune ([184](docs/decisions/184-mcp-monday-protocol-finetune.md)): week split, deferred_until, assignment link, contacts_with_cadence. |

Operating guide: [AGENTS.md](AGENTS.md). Cursor rules: [.cursor/rules/](.cursor/rules/). Full decision archive: [docs/decisions/](docs/decisions/).

---

## Recent decisions (last 5 — full archive in `docs/decisions/`)

- [205 — Desktop Now task rail](docs/decisions/205-desktop-now-task-rail.md) (2026-08-19) — persistent `md+` Critical/Opportunity bar left of page content; `/tasks` stays the full list; mobile unchanged.
- [204 — Library Knoppers AB 1 Chronicles 10–29](docs/decisions/204-library-knoppers-ab-1-chronicles.md) (2026-08-18) — Gary N. Knoppers; AB vol 12A; Doubleday / New York 2004; ISBN `9780385512886`; 1 Chronicles coverage.
- [203 — Library Lincoln WBC Ephesians](docs/decisions/203-library-lincoln-wbc-ephesians.md) (2026-08-18) — Andrew T. Lincoln; WBC vol 42; Word / Waco 1990; ISBN `9780849902413`; Ephesians coverage.
- [202 — Invoice list mark-paid + undo](docs/decisions/202-invoicing-list-mark-paid.md) (2026-08-17) — one-tap Mark paid on sent rows; 10s undo toast; detail drops confirm, keeps Mark unpaid.
- [201 — Invoicing analytics range + one-offs](docs/decisions/201-invoicing-analytics-range-one-offs.md) (2026-08-15) — YTD-default range presets; Hours|One-off sheet; generate/discard/analytics treat one-offs as money not hours.

---

## Session handoff

**Projects (use weekly):**
- `/projects` — inline tree + weekly check-in (`depends('app:projects:tree')`), optional **progress tracking** per check-in (value / of / note — [048](docs/decisions/048-projects-checkin-progress.md)).
- `/dashboard` — desktop two-column home (status + modules + upcoming sermons; Due soon + Due to meet); **Now tasks** are the persistent left rail on `md+` ([205](docs/decisions/205-desktop-now-task-rail.md)); mobile glance tiles for Tasks + Classwork + Contacts ([132](docs/decisions/132-desktop-home-dashboard.md), [161](docs/decisions/161-classwork-session-2.md), [180](docs/decisions/180-contacts-session-2.md)).
- `/tasks` — MYN zones (Critical / Opportunity / OTH), FRESH sort, defer/promote; `?project=` / `?view=` / `?all=1` ([128](docs/decisions/128-myn-fall-polish.md)). Legacy `/projects/tasks` 308-redirects here.
- `/settings/projects` — default New Task project + named saved views.
- Edit project Sheet — metadata + **links** (edit mode only).
- `/settings/audit-log?module=projects` — includes `project_tasks` soft-delete revert.

**Projects helpers:** `src/lib/projects/` — `week.ts`, `filter.ts` (`countMissingWeekCheckIns`), `progress.ts` ([048]), `carry-forward.ts` ([048]), `health-appearance.ts` ([047b](docs/decisions/047-projects-status-appearance.md)), `project-colors.ts` + `email-inbound.ts` ([077](docs/decisions/077-email-to-task-and-domain-colors.md)), `task-views.ts` ([128](docs/decisions/128-myn-fall-polish.md)), `deferred.ts` + `week-tasks.ts` ([184](docs/decisions/184-mcp-monday-protocol-finetune.md)), `now-task-rail.ts` ([205](docs/decisions/205-desktop-now-task-rail.md)), `server/loaders.ts`, `server/actions.ts`, `server/task-loaders.ts` (`loadDashboardNowTasks` — [132](docs/decisions/132-desktop-home-dashboard.md); `loadNowTaskRail` — [205](docs/decisions/205-desktop-now-task-rail.md); `loadWeekTasks` — [165](docs/decisions/165-mcp-list-week-tasks.md)/[184](docs/decisions/184-mcp-monday-protocol-finetune.md)), `server/task-actions.ts`, `server/task-prefs-actions.ts`. Design: [MYN_TASKS_DESIGN.md](docs/MYN_TASKS_DESIGN.md).

**Projects migrations (prod):** `20260603170000_ppp_projects_v1.sql`, `20260603200000_projects_add_not_started_lifecycle.sql`, `20260604030000_ppp_project_tasks_myn.sql`, `20260604100000_project_updates_progress.sql`, `20260709164016_projects_email_inbox_and_domain_colors.sql`, `20260723170000_profiles_task_prefs.sql`, `20260727155538_mcp_monday_protocol_finetune.sql` ([184](docs/decisions/184-mcp-monday-protocol-finetune.md)).

**Sermons:** `/sermons` list + Sheet; `/sermons/by-book` commentary × sermon spine (series label + multi-part collapse + latest sermon date — [134](docs/decisions/134-sermons-by-book-series-dedupe.md)); `/settings/sermons/venues`; helpers `src/lib/sermons/` (incl. `loadUpcomingSermons`); migration `20260717190000_ppp_sermons_v1.sql` ([091](docs/decisions/091-sermons-session-1.md), [095](docs/decisions/095-sermons-by-book-stats.md), [132](docs/decisions/132-desktop-home-dashboard.md)).

**Classwork:** `/classwork` list + Sheets; dashboard Due soon under Now + mobile Classwork tile ([161](docs/decisions/161-classwork-session-2.md)); helpers `src/lib/classwork/` + MCP course resolve; migrations `20260724220000_ppp_classwork_v1.sql`, `20260801120600_ppp_classwork_papers_v1.sql`. **Papers:** `/classwork/papers` + `/classwork/papers/[id]` research home (attach books/essays/stubs, per-row cite + page, per-source notes, merged compiled bib; P1 stamp+lock; **research groups** — CRUD + per-row select + Ungrouped-first buckets, G1 null-out) ([189](docs/decisions/189-classwork-papers-session-1.md), [190](docs/decisions/190-classwork-papers-session-2.md)).

**Contacts:** `/contacts` tabs Contacts \| Households \| Lists (multi-add checklist + Log cards) + Sheets with list toggles; `/settings/contacts/lists` redirects to Lists tab; dashboard Due to meet ([180](docs/decisions/180-contacts-session-2.md), [182](docs/decisions/182-contacts-session-3-lists-cadence-touch-kinds.md), [183](docs/decisions/183-contacts-list-mass-add.md)); helpers `src/lib/contacts/`; migrations `20260725020000_ppp_contacts_v1.sql`, `20260725180115_contacts_touch_kind_and_cadence_ui.sql`. Desktop sidebar only.

**Invoicing helpers:** `src/lib/invoicing/` — `chicago-date.ts` (incl. `firstOfYearThroughYmd`), `hours.ts`, `consultation-lines.ts` ([050](docs/decisions/050-invoicing-client-billing-preferences.md)), `analytics.ts` ([197](docs/decisions/197-invoicing-analytics.md)/[201](docs/decisions/201-invoicing-analytics-range-one-offs.md)), `one-off.ts` ([201](docs/decisions/201-invoicing-analytics-range-one-offs.md)), `mark-paid.ts` ([202](docs/decisions/202-invoicing-list-mark-paid.md)). Routes: `/invoicing`, `/invoicing/invoices`, `/invoicing/analytics` (Time \| Invoices \| Analytics toggle; analytics default range YTD). Loaders/actions live inline in route `+page.server.ts` files **by design** (see AGENTS.md › Module structure).

**Library (maintenance only):** [docs/library-trip-qa-runbook.md](docs/library-trip-qa-runbook.md) — complete; viewer §B still deferred without collaborator.

**Supabase workflow:** Hosted `db push` / `deploy-functions` only — [supabase/README.md](supabase/README.md). Library schema: **`npm run ship-library:apply`**.

**Repo gate:** Desktop Now task rail [205](docs/decisions/205-desktop-now-task-rail.md) — `npm run check` **0 errors**, `npm run test` **461** passed (2026-08-19).

**Data safety (R2 export):** Project is on the Supabase **Free plan** ([066](docs/decisions/066-operational-resilience-review.md)), so the R2 dumps are the **only** backup. **Pipeline live + restore proven** ([079](docs/decisions/079-ops-hardening-backups-restore-revoke.md)). `pg_dump -F c` to **private Cloudflare R2** via [`.github/workflows/backup.yml`](.github/workflows/backup.yml) (`workflow_dispatch` + **weekly** cron `0 8 * * 1`):

- `ppp-invoicing-YYYY-MM.dump` — **profiles**, clients, client_rates, time_entries, invoices, invoice_line_items
- `ppp-library-YYYY-MM.dump` — books, people, series, publishers, bible_books, ancient_texts, book_authors, book_bible_coverage, book_ancient_coverage, book_topics, essays, essay_authors, scripture_references
- `ppp-projects-YYYY-MM.dump` — projects, project_updates, project_tasks, project_links

**Restore smoke green** ([`restore-smoke.sh`](scripts/backup-restore-verify/restore-smoke.sh)): pre-data + data into scratch Postgres 17; invoicing 2 clients / 1 profile; library 1379 books / 1509 book_authors / 555 scripture_references. Owner runbook: [docs/reviews/2026-07-07-operational-resilience.md](docs/reviews/2026-07-07-operational-resilience.md). PITR add-on intentionally skipped. Retention: keep all for now.

---

## Session prompts (copy-paste) — LIVE only

*Completed prompts are deleted; their detail lives in the cited decision doc. Deferred items are pointers in "Next up," not full blocks.*

### Contacts / CRM — remaining MCP smoke (owner, ~5 min)

```
Session: contacts — MCP smoke leftover
Tracker: docs/POS_Contacts_Build_Tracker.md › Owner smoke Session 2 MCP rows
Do:
 - [ ] Reload ppp MCP client
 - [ ] list_contacts_due returns a due row; search_contacts returns card fields for a known name
 - [ ] Tick MCP rows + Last smoked note on tracker
```

### Library — ISBN prefill: Google Books cross-check — from [151](docs/decisions/151-book-metadata-source-strategy.md)

```
Session: library — ISBN prefill Google Books cross-check
Tracker: ad-hoc (docs/POS_Library_Build_Tracker.md maintenance)
Read: AGENTS.md, docs/decisions/151-book-metadata-source-strategy.md,
  docs/decisions/084-isbn-lookup-csp-openlibrary.md, docs/decisions/143-ol-edition-prefill-person-edit.md,
  src/lib/library/open-library-prefill.ts, src/lib/library/book-form-ol.ts, src/hooks.server.ts (CSP)
Supabase: no schema change expected
Goal: Add Google Books (volumes?q=isbn:) as a parallel prefill source with per-field merge +
  disagreement flags so plausible-junk stops sailing through confirmation.
Acceptance:
 - [ ] CSP connect-src allows https://www.googleapis.com (same one-origin pattern as 084)
 - [ ] fetchGoogleBooksPrefill (client fetch, AbortSignal.timeout, no key; note quota fallback = API key)
 - [ ] Parallel OL + GB fetch; pure merge helper with policy: GB preferred for
       title/subtitle/authors/year/pages/language; OL kept for publisher_location/series;
       publisher via registry match (matchPublisher) before either raw string
 - [ ] Provenance in <BookForm>: sources agree = silent autofill; disagree or single-source =
       visible flag with both values pickable
 - [ ] OL 404 → GB-only prefill still works (niche seminary ISBN gap from 084)
 - [ ] Decide in-session: does <BookOlRefreshDialog> get the same cross-check (optional scope)
 - [ ] Unit tests for the merge helper (no fetch); npm run check + npm run test pass
 - [ ] Owner phone smoke: one scan on /library/add end-to-end
End-of-session: docs/decisions/<next-free>-*.md; PLAN.md refreshed; AGENTS.md inventory + components.mdc
  updated for the new helper
```

### Library Wave 2 — August shelf QA Track B (owner + agent; Madison)

Track A (Covenant expected strings) ✅ [102](docs/decisions/102-august-qa-covenant-fixtures.md). **Track B = physical books only.**

```
Session: library — Wave 2 August shelf QA Track B
Tracker: docs/POS_Library_Build_Tracker.md, Wave 2 "August" row
Read: AGENTS.md, docs/library-turabian-fixtures.md, docs/decisions/102-august-qa-covenant-fixtures.md,
  docs/decisions/063-library-wave2-session4-docx-export.md, docs/decisions/065-writing-workflow-review.md,
  .claude/skills/turabian-qa/
Goal: For each of the 20 fixture shelf examples, confirm live DB metadata + in-app citations match the physical book.
Per row (use the Shelf example column in docs/library-turabian-fixtures.md):
 - [ ] Find the volume on the shelf; open title page (and essay/lemma locus for rows 16–19)
 - [ ] Open matching book (or essay) in ppp; fix any wrong author/title/edition/publisher/year/series/volume/work_type
 - [ ] Copy Footnote + Bibliography (+ Short form / page where applicable); confirm vs fixture expected string
       and vs title page (do not invent ISBNs)
 - [ ] Article rows: ABD (17) abbreviated `in ABD, …`; TDNT (18) `in TDNT, …`; BDAG (16) unsigned s.v.;
       chapter-in-edited-volume (19) title-then-ed. form — series_abbreviation must be on parent book
 - [ ] Spot-check work_type on reference works (handbooks/concordances left monograph is OK per 094)
Fix formatter bugs only when real shelf metadata exposes a gap; otherwise correct the book record.
End-of-session: fixture doc statuses re-confirmed, docs/decisions/<next-free>-*.md, tracker August row ticked, PLAN.md refreshed
```

### Library — Madison Needs the shelf (50 books, [087](docs/decisions/087-library-review-queue-research-cleanup.md))

```
Session: library — Needs the shelf deck (Madison)
Read: AGENTS.md, docs/decisions/087-library-review-queue-research-cleanup.md, PLAN.md
Goal: Clear the 50 shelf-bound needs_review books (ISBN / year / publisher / edition).
Workflow: /library/review?deck=shelf (or Needs the shelf); confirm title pages; clear needs_review when verified.
Do not invent ISBNs — leave null when pre-ISBN or binding-ambiguous.
End-of-session: decision log + PLAN.md; note remaining count.
```

### Security hardening — review 051, Session R2 (open items remain)

```
Session: cross-module — security hardening (review 051, Session R2)
Read: AGENTS.md, docs/decisions/051-product-review.md, .cursor/rules/edge-functions.mdc,
  src/hooks.server.ts, src/lib/server/auth-session.ts,
  supabase/functions/send-invoice/index.ts, supabase/functions/generate-invoice-pdf/index.ts,
  supabase/functions/ocr_scripture_refs/index.ts (CORS pattern lines ~10-24),
  supabase/migrations/20260428200000_library_scripture_images_bucket.sql,
  supabase/migrations/20260521120000_publishers.sql
Goal: Close the five medium security findings from 051.
Acceptance:
 - [ ] Security headers (X-Frame-Options DENY, Referrer-Policy, baseline CSP) in hooks.server.ts handle
 - [ ] Invoicing Edge Functions use the OCR origin-allowlist CORS pattern (SITE_URL)
 - [ ] OCR rate limit fails closed on library_ocr_usage read error
 - [ ] Storage SELECT policy migration: app_has_module_read('library'); publishers_select regated same
 - [x] resolveSessionUser moved to getClaims()
 - [x] ECC JWT rotated to Current + re-login smoke (2026-07-06)
 - [ ] npm run check + npm run test pass; npm run test:rls on staging after policy migrations
 - [ ] npm run supabase:deploy-functions after Edge changes
```

---

## Next up

### Do now (fall — [138](docs/decisions/138-fall-semester-priorities.md) / [139](docs/decisions/139-lightweight-crm-fall-priority.md))
1. **Owner — use `/classwork/papers` for the St. Louis publication edit** ([189](docs/decisions/189-classwork-papers-session-1.md), [190](docs/decisions/190-classwork-papers-session-2.md)) — create the real paper, attach sources, file them into research groups, report friction.
2. **Owner — Contacts MCP smoke leftover** — reload `ppp`; tick tracker MCP rows.
3. **Contacts data entry** — seed real people before Thanksgiving card pass.
4. **~/brain monday-protocol** — update skill field docs for [184](docs/decisions/184-mcp-monday-protocol-finetune.md) payload shapes.

### Next / parallel
5. **Library — ISBN prefill Google Books cross-check** ([151](docs/decisions/151-book-metadata-source-strategy.md)) — prompt above.
6. **Security hardening (051 R2)** — open medium findings; prompt above.
7. **Optional** — OCR matrix when next touching a scripture batch ([030](docs/decisions/030-ocr-pdf-input.md)).
8. **Classwork backlog** — bulk/quick-add if syllabus entry hurts; prefer Canvas one-shot import first ([173](docs/decisions/173-canvas-classwork-import-deferred.md)).
9. **Invoicing — key rotation** (tracker #4, Sep 2026) — JWT + Resend when convenient; runbook in [Supabase_deployment_and_go_live.md](docs/Supabase_deployment_and_go_live.md#key-rotation-runbook).

### Wait for Madison / August
9. **August shelf QA Track B** — 20 fixture rows ([docs/library-turabian-fixtures.md](docs/library-turabian-fixtures.md)); Track A done ([102](docs/decisions/102-august-qa-covenant-fixtures.md)). Prompt above.
10. **Needs the shelf** — 50 shelf-bound needs_review ([087](docs/decisions/087-library-review-queue-research-cleanup.md)) + Goodreads leftovers ([096](docs/decisions/096-goodreads-owned-adds-enrichment.md)); plus Research-deck phone smoke at ~673 proposals + the 45 no-AI-signal books ([068](docs/decisions/068-library-review-ai-research-pass.md)). Prompt above.
11. **Shared ISBN shelf barcodes** ([194](docs/decisions/194-library-isbn-integrity-collins-dups.md)) — Lost Tales 1 vs 2 (`9780780715462`); Foundation vs Second Foundation (`9789993068808`).
12. **Harvard Classics full essay breakout** ([093](docs/decisions/093-goodreads-triage-execution.md)) — with other Madison library cleanup.
13. **Writing smoke** — one paper/sermon path: footnote → short form → page → `.docx` into Word.
14. **Classwork — Canvas one-shot import** ([173](docs/decisions/173-canvas-classwork-import-deferred.md)) — late August after first Fall syllabi/bibliographies; mint semester token (≈1 mo life); preview→confirm into `courses`/`assignments`; expect week-1–3 re-pull for drops/adds and professor due-date reloads. Not live sync.

### Deferred / someday (pointer only — detail in the cited decision doc)
- **PWA branded icons** ([057](docs/decisions/057-pwa-consistency.md)) — replace placeholder squares with a monogram set.
- **CRM mailing-list send pipeline** (Resend campaigns + unsubscribe) — designed-for in Contacts v1, not built.
- **MARC-source prefill proxy** (LoC SRU / Harvard LibraryCloud) — only if GB cross-check + registries leave gaps ([151](docs/decisions/151-book-metadata-source-strategy.md)).
- **Ops phone smoke** — cold-start / nav watchdog / chunk recovery ([072](docs/decisions/072-pwa-cold-start-resilience.md)); glance backup Actions after a Monday 08:00 UTC run.
- **Classwork Canvas OAuth / continuous sync** — rejected for now; semester-start token + occasional re-pull ([173](docs/decisions/173-canvas-classwork-import-deferred.md)).
