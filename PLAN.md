# PLAN.md — Parker's Platform (ppp)

**Last updated:** 2026-07-24 — Restructured: trimmed to current state + live prompts; completed-work archive now lives only in `docs/decisions/` and the module trackers ([159](docs/decisions/159-plan-md-trim-and-conventions.md)).

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

- **Classwork** — Session 1 shipped ([153](docs/decisions/153-classwork-session-1.md)); **Session 2** (dashboard due-soon + MCP tools) is the active build — prompt below.
- **Contacts / CRM** — Session 0 (Phase 0 lock) not started — prompt below. Thin v1 target ~Thanksgiving.
- **MCP read-only v1 shipped** ([144](docs/decisions/144-ppp-mcp-readonly-v1.md)) — owner to wire Cursor + Claude Code.
- Madison shelf QA after Aug 9. Personal priorities: `~/Neal/context/current-priorities.md`.

Nearest hard dates:
- **2026-08-09** — return from Madison; library Wave 2 execution + shelf QA window opens.
- **2026-08-31** — fall semester starts; classwork ready; fall-semester-ready citations, **incl. article-level** (signed articles/essays: ABD, TDNT, IVP dicts, essay collections).

---

## Active modules

| Module | Tracker | State |
|---|---|---|
| Invoicing | [docs/POS_Invoicing_Build_Tracker.md](docs/POS_Invoicing_Build_Tracker.md) | ✅ Code complete (Sessions 1–6) + ad-hoc polish. **Open:** outgoing-PDF diagnostics (prompt below / [083](docs/decisions/083-invoice-pdf-email-diagnostics.md)); first real-client send pending Sarah. |
| Library | [docs/POS_Library_Build_Tracker.md](docs/POS_Library_Build_Tracker.md) | ✅ Trip build + Wave 2 Sessions 1–4 complete; owner smokes ✅ (essays/Articles, PWA resume, megacomponent core; OCR deferred). **Open:** August shelf QA Track B + "Needs the shelf" (50) — Madison; ISBN Google Books cross-check ([151](docs/decisions/151-book-metadata-source-strategy.md)). |
| Projects | [docs/POS_Projects_Build_Tracker.md](docs/POS_Projects_Build_Tracker.md) | ✅ v1 complete + fall MYN polish + desktop home dashboard. Owner E2E smoke 2026-07-22 passed. Viewer access owner-only by design. |
| Sermons | [docs/POS_Sermons_Build_Tracker.md](docs/POS_Sermons_Build_Tracker.md) | ✅ v1 Sessions 1–2 + by-book series/dedupe. List + by-book smoke passed. |
| Classwork | [docs/POS_Classwork_Build_Tracker.md](docs/POS_Classwork_Build_Tracker.md) | 🟡 Session 1 done ([153](docs/decisions/153-classwork-session-1.md)) — `courses` + `assignments`, `/classwork` CRUD. **Session 2** (dashboard due-soon + MCP tools) in progress; target before 2026-08-31. |
| Contacts / CRM | *(tracker created in Session 0)* | 🔲 Fall priority ([139](docs/decisions/139-lightweight-crm-fall-priority.md)) — meet cadence + Christmas cards; mailing send later; **≠ library `people`.** |
| MCP | [scripts/ppp-mcp/README.md](scripts/ppp-mcp/README.md) | ✅ Read-only v1 ([144](docs/decisions/144-ppp-mcp-readonly-v1.md)) — local stdio; Cursor + Claude Code. classwork/contacts tools land as those modules ship. |

Operating guide: [AGENTS.md](AGENTS.md). Cursor rules: [.cursor/rules/](.cursor/rules/). Full decision archive: [docs/decisions/](docs/decisions/).

---

## Recent decisions (last 5 — full archive in `docs/decisions/`)

- [158 — Book detail polish + in-page author edit](docs/decisions/158-book-detail-polish-author-edit.md) (2026-07-24) — drop book icon; quieter cite/facts; On the shelf; owner author tap → Edit person dialog + View books.
- [157 — Multi-volume systematics credits + set bibliography](docs/decisions/157-multivol-systematics-credits-set-bib.md) (2026-07-24) — Calvin/Synopsis/Mastricht/Bavinck/Turretin editors+translators; house-style titles; Turabian §17.1.4 cite-set checkbox on book detail.
- [156 — Book detail densify (siblings, also-by, peeks)](docs/decisions/156-book-detail-densify.md) (2026-07-24) — series siblings + also-by-author under facts; conditional section peeks; genre in facts `<dl>`; author/series links.
- [155 — Batch essay entry + remove top preview](docs/decisions/155-batch-essay-entry.md) (2026-07-24) — multi-row essay create (`?/createEssaysBatch`); dropped near-title essays preview card; edit stays single-row.
- [153 — Classwork Session 1 (schema + `/classwork` CRUD)](docs/decisions/153-classwork-session-1.md) (2026-07-24) — `ppp_classwork_v1`; list group toggle; Sheets; mobile nav trim; C2 Education suggest; A1 due_date milestones.

---

## Session handoff

**Projects (use weekly):**
- `/projects` — inline tree + weekly check-in (`depends('app:projects:tree')`), optional **progress tracking** per check-in (value / of / note — [048](docs/decisions/048-projects-checkin-progress.md)).
- `/dashboard` — desktop two-column home (status + modules + upcoming sermons; sticky Critical/Opportunity Now); mobile glance without task list ([132](docs/decisions/132-desktop-home-dashboard.md)).
- `/tasks` — MYN zones (Critical / Opportunity / OTH), FRESH sort, defer/promote; `?project=` / `?view=` / `?all=1` ([128](docs/decisions/128-myn-fall-polish.md)). Legacy `/projects/tasks` 308-redirects here.
- `/settings/projects` — default New Task project + named saved views.
- Edit project Sheet — metadata + **links** (edit mode only).
- `/settings/audit-log?module=projects` — includes `project_tasks` soft-delete revert.

**Projects helpers:** `src/lib/projects/` — `week.ts`, `filter.ts` (`countMissingWeekCheckIns`), `progress.ts` ([048]), `carry-forward.ts` ([048]), `health-appearance.ts` ([047b](docs/decisions/047-projects-status-appearance.md)), `project-colors.ts` + `email-inbound.ts` ([077](docs/decisions/077-email-to-task-and-domain-colors.md)), `task-views.ts` ([128](docs/decisions/128-myn-fall-polish.md)), `server/loaders.ts`, `server/actions.ts`, `server/task-loaders.ts` (`loadDashboardNowTasks` — [132](docs/decisions/132-desktop-home-dashboard.md)), `server/task-actions.ts`, `server/task-prefs-actions.ts`. Design: [MYN_TASKS_DESIGN.md](docs/MYN_TASKS_DESIGN.md).

**Projects migrations (prod):** `20260603170000_ppp_projects_v1.sql`, `20260603200000_projects_add_not_started_lifecycle.sql`, `20260604030000_ppp_project_tasks_myn.sql`, `20260604100000_project_updates_progress.sql`, `20260709164016_projects_email_inbox_and_domain_colors.sql`, `20260723170000_profiles_task_prefs.sql`.

**Sermons:** `/sermons` list + Sheet; `/sermons/by-book` commentary × sermon spine (series label + multi-part collapse + latest sermon date — [134](docs/decisions/134-sermons-by-book-series-dedupe.md)); `/settings/sermons/venues`; helpers `src/lib/sermons/` (incl. `loadUpcomingSermons`); migration `20260717190000_ppp_sermons_v1.sql` ([091](docs/decisions/091-sermons-session-1.md), [095](docs/decisions/095-sermons-by-book-stats.md), [132](docs/decisions/132-desktop-home-dashboard.md)).

**Classwork:** `/classwork` CRUD (list group toggle); schema `courses` + `assignments` (migration `ppp_classwork_v1`); helpers `src/lib/classwork/`; MCP `list_due_soon` / `get_assignments_for_course` landing in Session 2 ([150](docs/decisions/150-classwork-session-0.md), [153](docs/decisions/153-classwork-session-1.md)).

**Invoicing helpers:** `src/lib/invoicing/` — `chicago-date.ts`, `hours.ts`, `consultation-lines.ts` ([050]). Loaders/actions live inline in route `+page.server.ts` files **by design** (see AGENTS.md › Module structure).

**Library (maintenance only):** [docs/library-trip-qa-runbook.md](docs/library-trip-qa-runbook.md) — complete; viewer §B still deferred without collaborator.

**Supabase workflow:** Hosted `db push` / `deploy-functions` only — [supabase/README.md](supabase/README.md). Library schema: **`npm run ship-library:apply`**.

**Repo gate:** `npm run check` + `npm run test` **2026-07-24** ([158](docs/decisions/158-book-detail-polish-author-edit.md); **0 errors**, 343 tests).

**Data safety (R2 export):** Project is on the Supabase **Free plan** ([066](docs/decisions/066-operational-resilience-review.md)), so the R2 dumps are the **only** backup. **Pipeline live + restore proven** ([079](docs/decisions/079-ops-hardening-backups-restore-revoke.md)). `pg_dump -F c` to **private Cloudflare R2** via [`.github/workflows/backup.yml`](.github/workflows/backup.yml) (`workflow_dispatch` + **weekly** cron `0 8 * * 1`):

- `ppp-invoicing-YYYY-MM.dump` — **profiles**, clients, client_rates, time_entries, invoices, invoice_line_items
- `ppp-library-YYYY-MM.dump` — books, people, series, publishers, bible_books, ancient_texts, book_authors, book_bible_coverage, book_ancient_coverage, book_topics, essays, essay_authors, scripture_references
- `ppp-projects-YYYY-MM.dump` — projects, project_updates, project_tasks, project_links

**Restore smoke green** ([`restore-smoke.sh`](scripts/backup-restore-verify/restore-smoke.sh)): pre-data + data into scratch Postgres 17; invoicing 2 clients / 1 profile; library 1379 books / 1509 book_authors / 555 scripture_references. Owner runbook: [docs/reviews/2026-07-07-operational-resilience.md](docs/reviews/2026-07-07-operational-resilience.md). PITR add-on intentionally skipped. Retention: keep all for now.

---

## Session prompts (copy-paste) — LIVE only

*Completed prompts are deleted; their detail lives in the cited decision doc. Deferred items are pointers in "Next up," not full blocks.*

### Classwork — Session 2: dashboard due-soon + MCP tools — from [153](docs/decisions/153-classwork-session-1.md)

```
Session: classwork #2 — dashboard due-soon + MCP tools
Tracker: docs/POS_Classwork_Build_Tracker.md, Session 2
Read: AGENTS.md, docs/POS_Classwork_Build_Tracker.md, docs/decisions/153-classwork-session-1.md,
  docs/decisions/150-classwork-session-0.md, scripts/ppp-mcp/README.md, src/lib/classwork/,
  src/routes/dashboard/+page.svelte (desktop Now column — [132])
Supabase: hosted db push only if needed — supabase/README.md
Goal: Surface open assignments due within 14 days on /dashboard and replace MCP stubs.
Lock before UI (tracker open Q D1 — owner pick):
 - [ ] Desktop home placement: (A) badge/strip under the Now tasks card, or (B) integrated
       into the Now column as a distinct Classwork section (not MYN task rows). Mobile glance follows.
Acceptance:
 - [ ] Dashboard due-soon (14d, overdue first) per D1; deep-link to /classwork
 - [ ] MCP list_due_soon real (horizon_days default 14, overdue included) — same tool name
 - [ ] MCP get_assignments_for_course (fuzzy course resolve)
 - [ ] npm run mcp:smoke green; npm run check + npm run test
End-of-session: tracker Session 2 done; docs/decisions/<next-free>-classwork-session-2.md; PLAN.md refreshed
```

### Contacts / CRM — Session 0: Phase 0 lock (fall) — from [139](docs/decisions/139-lightweight-crm-fall-priority.md)

```
Session: contacts #0 — Phase 0 structure lock (lightweight CRM)
Tracker: create docs/POS_Contacts_Build_Tracker.md (or POS_CRM_…) this session
Read: AGENTS.md, docs/MODULE_KICKOFF_PLAYBOOK.md, docs/decisions/041-library-module-retro.md,
  docs/decisions/000-invoicing-retro.md, docs/decisions/138-fall-semester-priorities.md,
  docs/decisions/139-lightweight-crm-fall-priority.md, PLAN.md, latest 3 docs/decisions/
  Note: library table `people` = authors — DO NOT reuse for CRM contacts.
  Note: invoicing `clients` = billing — keep separate unless owner explicitly wants a link FK later.
Supabase: hosted db push only — supabase/README.md
Goal: Lock a lightweight personal/ministry CRM before schema. Thin v1 target ~Thanksgiving (Christmas cards).
v1 in scope: contacts + meet cadence (who is due) + seasonal flags (Christmas card) + MCP-readable due list.
v1 out of scope: mailing-list send / Resend campaigns / unsubscribe compliance (design email fields only).
Phase 0 gates (owner answers; agent proposes options):
 - [ ] Taxonomy singular — contact vs household vs tag/list; table name ≠ `people`
 - [ ] Cadence model — interval + last_met vs explicit next_touch_on vs both
 - [ ] Christmas / seasonal — boolean flags vs list membership table
 - [ ] Nullable matrix + address/email/phone fields (mailing-list-ready without send)
 - [ ] Form surfaces — /contacts list + Sheet vs pages; dashboard “due to meet” strip?
 - [ ] RLS + viewer plan (or solo waiver); module permission key name
 - [ ] MCP tools day one — list_contacts_due, search_contacts, (optional) christmas_card_list
 - [ ] Open Questions on tracker ≤2 per entity
Out of scope this session: migrations, UI CRUD, mailing send.
End-of-session:
 - [ ] Tracker + schema sketch; Phase 0 signed
 - [ ] docs/decisions/<next-free>-contacts-session-0.md
 - [ ] PLAN.md Next up + Session 1 prompt
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

### Invoicing — outgoing PDF diagnostics (owner; conditional — after [078](docs/decisions/078-invoice-email-pdf-mime.md) / [083](docs/decisions/083-invoice-pdf-email-diagnostics.md))

```
Goal: Diagnose same-org asymmetric invoice PDF (one recipient opens, one does not).
Read: docs/invoice-pdf-email-diagnostics.md, docs/decisions/078-invoice-email-pdf-mime.md,
  docs/decisions/083-invoice-pdf-email-diagnostics.md
Do NOT change send-invoice MIME until the minimum useful set is collected:
 - [ ] Resend email id + attachment filename / content_type / size screenshot
 - [ ] Failing user symptom + client (web/iOS/Android) + screenshot
 - [ ] Show original from failing mailbox: PDF part present or not
 - [ ] Manual Gmail attach A/B (download from invoice page → email both people) vs app Resend
Bring those four into chat; then decide MIME tweak vs org/client fix.
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
1. **Classwork Session 2** — lock desktop home placement (tracker D1), then due-soon UI + MCP `list_due_soon` / `get_assignments_for_course`. Session 1 done ([153](docs/decisions/153-classwork-session-1.md)); prompt above.
2. **Contacts / CRM Session 0** — lightweight people tracker (meet cadence + Christmas cards; mailing send later). Prompt above. Thin v1 by ~Thanksgiving.
3. **Owner:** wire `ppp` MCP in Cursor + Claude Code ([scripts/ppp-mcp/README.md](scripts/ppp-mcp/README.md)); confirm one chat smoke (`list_now_tasks`).

### Next / parallel
4. **Library — ISBN prefill Google Books cross-check** ([151](docs/decisions/151-book-metadata-source-strategy.md)) — prompt above.
5. **Invoicing — first real-client send** (Sarah back in office). If the outgoing PDF is unopenable for one same-org recipient after [078](docs/decisions/078-invoice-email-pdf-mime.md), run the diagnostics prompt above ([083](docs/decisions/083-invoice-pdf-email-diagnostics.md)) before further Edge MIME change.
6. **Security hardening (051 R2)** — open medium findings; prompt above.
7. **Optional** — OCR matrix when next touching a scripture batch ([030](docs/decisions/030-ocr-pdf-input.md)).

### Wait for Madison / August
8. **August shelf QA Track B** — 20 fixture rows ([docs/library-turabian-fixtures.md](docs/library-turabian-fixtures.md)); Track A done ([102](docs/decisions/102-august-qa-covenant-fixtures.md)). Prompt above.
9. **Needs the shelf** — 50 shelf-bound needs_review ([087](docs/decisions/087-library-review-queue-research-cleanup.md)) + Goodreads leftovers ([096](docs/decisions/096-goodreads-owned-adds-enrichment.md)); plus Research-deck phone smoke at ~673 proposals + the 45 no-AI-signal books ([068](docs/decisions/068-library-review-ai-research-pass.md)). Prompt above.
10. **Harvard Classics full essay breakout** ([093](docs/decisions/093-goodreads-triage-execution.md)) — with other Madison library cleanup.
11. **Writing smoke** — one paper/sermon path: footnote → short form → page → `.docx` into Word.

### Deferred / someday (pointer only — detail in the cited decision doc)
- **PWA branded icons** ([057](docs/decisions/057-pwa-consistency.md)) — replace placeholder squares with a monogram set.
- **CRM mailing-list send pipeline** (Resend campaigns + unsubscribe) — designed-for in Contacts v1, not built.
- **MARC-source prefill proxy** (LoC SRU / Harvard LibraryCloud) — only if GB cross-check + registries leave gaps ([151](docs/decisions/151-book-metadata-source-strategy.md)).
- **Ops phone smoke** — cold-start / nav watchdog / chunk recovery ([072](docs/decisions/072-pwa-cold-start-resilience.md)); glance backup Actions after a Monday 08:00 UTC run.
