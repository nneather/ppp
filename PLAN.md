# PLAN.md — Parker's Platform (ppp)

**Last updated:** 2026-07-23 — Commentary genre mistags ([136](docs/decisions/136-commentary-genre-mistags.md)); book-detail notes focus ([135](docs/decisions/135-book-detail-notes-focus-jump.md)); sermons by-book series/dedupe ([134](docs/decisions/134-sermons-by-book-series-dedupe.md)).
**How to use this file:**
- Cursor reads it automatically.
- For the Claude.ai "Parker's Platform" project, paste the contents of this file at the start of any session that needs current state.
- At the end of every session in either tool, update this file before stopping.

---

## Current focus

**Overnight deep-dive reviews (2026-07-07, decision-first):** three background agents — **usage retrospective** ([064](docs/decisions/064-usage-retrospective-review.md)), **writing workflow** ([065](docs/decisions/065-writing-workflow-review.md)), **operational resilience** ([066](docs/decisions/066-operational-resilience-review.md)); reports in [docs/reviews/](docs/reviews/). All 14 open calls answered. **Review-queue improvement + AI research pass: done** ([067](docs/decisions/067-library-review-sprint-decks.md), [068](docs/decisions/068-library-review-ai-research-pass.md)). **Nav watchdog shipped** ([072](docs/decisions/072-pwa-cold-start-resilience.md)); **PWA update auto-recover** ([082](docs/decisions/082-pwa-update-auto-recover.md)); **update banners non-blocking** ([100](docs/decisions/100-pwa-update-banner-nonblocking.md)). **Ops hardening shipped** ([079](docs/decisions/079-ops-hardening-backups-restore-revoke.md)). **Writing-session gaps shipped** ([094](docs/decisions/094-library-writing-session-gaps.md)). **MYN adopted** ([099](docs/decisions/099-myn-trial-adopted.md)); **fall polish shipped** ([128](docs/decisions/128-myn-fall-polish.md) / lock [126](docs/decisions/126-myn-fall-backlog-lock.md)) — default project + saved views, next-Monday defer, Target Now, 50-total soft-cap; cross-module parked.

**Review queue — research cleanup done ([087](docs/decisions/087-library-review-queue-research-cleanup.md)):** non-shelf `needs_review` and pending proposals drained to **0**. Remaining: **Needs the shelf** deck (**50** books — ISBN/year/publisher/edition). Decks/sprints/proposals UI from [067](docs/decisions/067-library-review-sprint-decks.md)+[068](docs/decisions/068-library-review-ai-research-pass.md) still the workflow for Madison. Taxonomy: Politics and Policy, Leadership, Literary Criticism, Church Fathers, Ancient Biblical Sources, Children's and Young Adult; `books.copy_count` for multi-copy rows.

**Product review remediation (051):** R1 docs trust + **R2 security hardening** ([052](docs/decisions/052-security-hardening.md)) + **R3 UX safety** ([053](docs/decisions/053-ux-safety.md)) + **R4 invoicing polish** ([054](docs/decisions/054-invoicing-polish.md)) + **R5 CI + backups** ([055](docs/decisions/055-ci-backups.md)) — **complete**. Viewer-readiness items stay in backlog until a collaborator nears.

**Projects — v1 feature-complete:** Tree + check-in ([045]), dashboard + filters ([046]), MYN tasks + links + audit ([047](docs/decisions/047-projects-session-3-myn-tasks-links-audit.md)), Epic status appearance ([047b](docs/decisions/047-projects-status-appearance.md)), weekly check-in **progress tracking** ([048](docs/decisions/048-projects-checkin-progress.md)). Design: [MYN_TASKS_DESIGN.md](docs/MYN_TASKS_DESIGN.md). **Session 1 phone smoke** signed off (tree + check-in). **Owner E2E smoke 2026-07-22** passed (recurrence + sheet polish [112](docs/decisions/112-task-sheet-date-overflow.md)).

**Invoicing — ad-hoc enhancements shipped 2026-06-22:** discard sent invoices ([049](docs/decisions/049-invoicing-discard-sent.md)); per-client billing preferences — `billing_cadence` + `consultation_grouping` on `clients`, `buildConsultationLines()` ([050](docs/decisions/050-invoicing-client-billing-preferences.md)). Migration `20260622120000_clients_billing_preferences.sql` applied.

**Library — Wave 2 Sessions 1–4 complete; August shelf QA:** Trip QA **signed off 2026-06-03** ([043](docs/decisions/043-library-trip-qa-signoff-projects-handoff.md)). **Fixture-first build** locked 2026-07-06 ([056](docs/decisions/056-library-wave2-phase0.md)). **Track A (Covenant strings) done** ([102](docs/decisions/102-august-qa-covenant-fixtures.md)). **Track B** (physical shelf of all 20 rows) still open. **Owner smokes ✅** (2026-07-23): essays/DOTHB + Articles ([124](docs/decisions/124-dothb-essay-smoke-seed.md)/[125](docs/decisions/125-books-citation-abbreviation.md)); PWA resume; megacomponent core (OCR deferred). **`.docx` Word smoke ✅** ([063](docs/decisions/063-library-wave2-session4-docx-export.md)); commentary series ([113](docs/decisions/113-commentary-series-volume-omit.md)); cite strip ([114](docs/decisions/114-book-detail-ui-cleanup.md)); postal locations ([115](docs/decisions/115-publisher-location-postal.md)).

Nearest hard dates:
- **2026-05-21** — move to Madison; trip-period workflow (mobile-first) — library usable
- **2026-08** — return; library Wave 2 execution window
- **2026-09** — fall-semester-ready citations, **incl. article-level** (signed articles/essays: ABD, TDNT, IVP dicts, essay collections)

---

## Active modules

| Module | Tracker | State |
|---|---|---|
| Invoicing | [docs/POS_Invoicing_Build_Tracker.md](docs/POS_Invoicing_Build_Tracker.md) | ✅ Code complete (Sessions 1–6) + ad-hoc: discard sent ([049]), per-client billing preferences ([050]), UX standardization ([054](docs/decisions/054-invoicing-polish.md)), dashboard last-week generate ([059](docs/decisions/059-dashboard-last-week-invoice.md)), PDF email MIME harden ([078](docs/decisions/078-invoice-email-pdf-mime.md)), PDF email diagnostics runbook ([083](docs/decisions/083-invoice-pdf-email-diagnostics.md)). |
| Library | [docs/POS_Library_Build_Tracker.md](docs/POS_Library_Build_Tracker.md) | ✅ Trip build complete — QA signed off 2026-06-03. **Wave 2 Sessions 1–4 + writing-session gaps** ([094](docs/decisions/094-library-writing-session-gaps.md)). **Not-owned** Sessions 0–1 + inbox/owned-reappear polish ([101](docs/decisions/101-library-not-owned-session-0.md)–[108](docs/decisions/108-not-owned-owned-reappear-abandon-proposals.md)) — **queue drain done**. **August QA Track A done** ([102](docs/decisions/102-august-qa-covenant-fixtures.md)); Track B (shelf) open. **`.docx` smoke ✅**; commentary series ([113](docs/decisions/113-commentary-series-volume-omit.md)); cite strip ([114](docs/decisions/114-book-detail-ui-cleanup.md)) + cite card/spacing ([118](docs/decisions/118-book-detail-cite-card-spacing.md)); postal locations ([115](docs/decisions/115-publisher-location-postal.md)); IVP location backfill ([127](docs/decisions/127-ivp-publisher-location-backfill.md)); B&H publisher link ([131](docs/decisions/131-bh-publisher-link-backfill.md)); Baker publisher pass ([133](docs/decisions/133-baker-publisher-link-pass.md)); commentary Batches 1–5 ([116](docs/decisions/116-commentary-consistency-batch1.md)–[121](docs/decisions/121-commentary-consistency-batch5.md)); Bible coverage list filter ([123](docs/decisions/123-library-bible-coverage-filter.md)); DOTHB essay seed + citation abbr ([124](docs/decisions/124-dothb-essay-smoke-seed.md)/[125](docs/decisions/125-books-citation-abbreviation.md)); notes focus jump ([135](docs/decisions/135-book-detail-notes-focus-jump.md)); commentary genre mistags ([136](docs/decisions/136-commentary-genre-mistags.md)). **Owner smokes ✅** (essays/Articles, PWA resume, megacomponent core; OCR deferred). |
| Projects | [docs/POS_Projects_Build_Tracker.md](docs/POS_Projects_Build_Tracker.md) | ✅ **v1 complete** + **email-to-task + domain colors** ([077](docs/decisions/077-email-to-task-and-domain-colors.md)) + project select scroll ([080](docs/decisions/080-tasks-project-select-scroll.md)) + domain-root task options ([081](docs/decisions/081-tasks-project-options-domains.md)) + **recurring tasks + active badge** ([109](docs/decisions/109-tasks-active-badge-recurrence.md)) + task sheet date/footer polish ([112](docs/decisions/112-task-sheet-date-overflow.md)) + **fall MYN polish** ([128](docs/decisions/128-myn-fall-polish.md)) + **desktop home dashboard** ([132](docs/decisions/132-desktop-home-dashboard.md)). Tree/check-in, dashboard/filters, MYN `/tasks` (top-level nav; `/projects/tasks` redirects), `/settings/projects` prefs, links, audit. **Inbound live** ([098](docs/decisions/098-resend-inbound-webhook-secrets.md)). **MYN adopted** ([099](docs/decisions/099-myn-trial-adopted.md)). **Owner E2E smoke 2026-07-22 passed.** **Viewer access:** owner-only by design. |
| Sermons | [docs/POS_Sermons_Build_Tracker.md](docs/POS_Sermons_Build_Tracker.md) | ✅ **v1 Sessions 1–2** ([091](docs/decisions/091-sermons-session-1.md), [095](docs/decisions/095-sermons-by-book-stats.md)) + owner-smoke UX ([110](docs/decisions/110-sermons-owner-smoke-ux.md)) + by-book series/dedupe/latest sermon ([134](docs/decisions/134-sermons-by-book-series-dedupe.md)). List + by-book smoke **passed** (venue select, ranged Find-in-library, icon counts). |

Operating guide: [AGENTS.md](AGENTS.md). Cursor rules: [.cursor/rules/](.cursor/rules/). Full decision archive: [docs/decisions/](docs/decisions/).

---

## Recent decisions (last 3 — full archive in `docs/decisions/`)

- [136 — Commentary genre mistags (Calvin + Romans)](docs/decisions/136-commentary-genre-mistags.md) (2026-07-23) — CC vol 19 + 5 Romans series + NICNT Hebrews → Commentary; ESVEC was already correct; by-book “Also on shelf” was the mistag.
- [135 — Book detail personal-notes focus jump](docs/decisions/135-book-detail-notes-focus-jump.md) (2026-07-23) — gate scripture DOM behind `refsOpen`; defer streams/coverage while notes editing; restore focus after save; scoped coverage invalidate.
- [134 — Sermons by-book series, multi-part dedupe, latest sermon date](docs/decisions/134-sermons-by-book-series-dedupe.md) (2026-07-23) — series abbr on hits; collapse same series+author (Wenham/Fee); keep Sklar multi-series; latest `preached_on` left of commentary count.
- [132 — Desktop home dashboard](docs/decisions/132-desktop-home-dashboard.md) (2026-07-23) — `/dashboard` md+ two-column (Now tasks right); mobile glance without task list; upcoming sermons + check-in nudge.
- [131 — B&H free-text publisher link backfill](docs/decisions/131-bh-publisher-link-backfill.md) (2026-07-23) — 25 unlinked + 2 Logos mislinks → `B&H Academic` / Nashville; Lifeway *Praying with Paul* left alone (likely Baker).
- [130 — Retire Email Inbox; default + inbound → Personal](docs/decisions/130-retire-email-inbox-default-personal.md) (2026-07-23) — soft-delete Email Inbox; refile tasks; `INBOUND_TASK_PROJECT_ID` = Personal.
- [129 — Form control height consistency](docs/decisions/129-form-control-height-consistency.md) (2026-07-23) — WebKit date height + Select `size="lg"`; time-entry peers match.
- [128 — Fall MYN polish](docs/decisions/128-myn-fall-polish.md) (2026-07-23) — default project + settings saved views; next-Monday defer; Target Now; soft-cap 50 + `?all=1`.
- [125 — Per-book citation abbreviation](docs/decisions/125-books-citation-abbreviation.md) (2026-07-23) — `books.citation_abbreviation` overrides series abbr; IVP dicts share series (DOTHB/DJG/DPL/DOTWPW).
- [124 — DOTHB essay smoke seed](docs/decisions/124-dothb-essay-smoke-seed.md) (2026-07-23) — Canaan + Judges essays; PWA resume ✅; backup Actions green.
- [117 — Commentary consistency Batch 2](docs/decisions/117-commentary-consistency-batch2.md) (2026-07-22) — CSC/BST/NIVAC/CBC creates; NIGTC/ACCS/BECNT attaches; TOTC/TNTC vols; Beale title; Milgrom.
- [113 — Commentary series volume omit](docs/decisions/113-commentary-series-volume-omit.md) (2026-07-22) — no `Vol. N.` for commentary-in-series; bare series digit after series title; keep `N vols.` / Keener `Vol. N.`; `.docx` smoke passed.
- [105 — Solo git/ship agent guidance](docs/decisions/105-solo-git-ship-agent-guidance.md) (2026-07-21) — `main` protection adopted (required `check-and-test`, no PR theater); agents must not invent PRs or pile onto unrelated branches.
- [104 — SBL series abbreviation cleanup](docs/decisions/104-sbl-series-abbr-cleanup.md) (2026-07-21) — Apollos→ApOTC; K&D off Continental; MHC off Moffatt (MNTC).
- [103 — Library not-owned Session 1](docs/decisions/103-library-not-owned-session-1.md) (2026-07-21) — `books.owned` + default-hide + `/settings/library/not-owned` create-from-queue.
- [102 — August QA Covenant fixtures](docs/decisions/102-august-qa-covenant-fixtures.md) (2026-07-21) — Track A: validated 20 expected strings vs Covenant; fixed signed abbrev + title-then-ed chapter form; dropped signed `s.v.` duplication.
- [101 — Library not-owned Session 0](docs/decisions/101-library-not-owned-session-0.md) (2026-07-21) — Phase 0 lock: `books.owned`, hide defaults, create-from-queue settings page; matched diffs + HC essays deferred.
- [100 — PWA update banner non-blocking](docs/decisions/100-pwa-update-banner-nonblocking.md) (2026-07-21) — top-anchored recovery + update banners; Clear cache primary; Later dismiss so forms stay usable.
- [099 — MYN trial adopted](docs/decisions/099-myn-trial-adopted.md) (2026-07-21) — keep `/tasks`; fall refinements OK; Global Now parked until then.
- [098 — Resend inbound webhook secrets](docs/decisions/098-resend-inbound-webhook-secrets.md) (2026-07-21) — Edge secrets refreshed from live Resend webhook; owner smoke confirmed email→task.
- [096 — Goodreads owned-adds enrichment](docs/decisions/096-goodreads-owned-adds-enrichment.md) (2026-07-20) — filled 26 title-only owned adds (authors/genre/pub/ISBN where clear); Wingfeather WaterBrook + Silvia 2e locked; 12 remain shelf-flagged for edition/ISBN.
- [094 — Library writing-session gaps](docs/decisions/094-library-writing-session-gaps.md) (2026-07-19) — short-form + page input + incomplete citation hint; essay short form; `work_type` reference sweep.
- [088 — Commentary Bible coverage cleanup](docs/decisions/088-commentary-bible-coverage-cleanup.md) (2026-07-17) — 363 coverage rows; IVP Background → Biblical Reference; NIB Vol X essays (Boring/Wright/Sampley); 8 intentional untagged (thematic + deuterocanonical).
- [087 — Library review-queue research cleanup](docs/decisions/087-library-review-queue-research-cleanup.md) (2026-07-17) — non-shelf review + proposals → 0; 50 shelf-bound remain; genre taxonomy + `copy_count`; Church Fathers / Ancient Biblical Sources / Children's and Young Adult.
- [083 — Invoice PDF email diagnostics](docs/decisions/083-invoice-pdf-email-diagnostics.md) (2026-07-14) — owner runbook for same-org “one can open PDF / one cannot”; collect Resend + Show original + manual attach A/B before more MIME changes.
- [082 — PWA update auto-recover](docs/decisions/082-pwa-update-auto-recover.md) (2026-07-10) — chunk-load → auto clear-cache+reload (card only on loop); resume auto-applies waiting SW; keep prompt toast for mid-session updates.
- [081 — Tasks project options are domain roots](docs/decisions/081-tasks-project-options-domains.md) (2026-07-10) — `/tasks` filter + New task pick Personal/Education/… (roots); domain filter includes descendants; edit keeps child option for email/legacy tasks.
- [071 — Review queue authorless + undo](docs/decisions/071-review-queue-authorless-undo.md) (2026-07-08) — work-type chips + editors-only monograph one-tap fix on review cards; role-aware missing preview; 10s Confirm undo (field restore + proposal re-pending); Back button for skipped cards.
- [069 — Review queue follow-ups](docs/decisions/069-review-queue-follow-ups.md) (2026-07-07) — Turabian `publisher_location` normalization; proposal filter + dismissed-stays-gone; editable Apply on review card; italic citation previews; `books.no_attributed_author` for authorless reference works; `rejectRedundantProposals.ts` cleanup script.
- [067 — Review queue sprint decks](docs/decisions/067-library-review-sprint-decks.md) (2026-07-06) — deck picker (6 decks, live counts) replaces slice pills; Genre Sprint one-tap fast lane (585 books); 5/10/25 sprints + ring + summary; live-ticking burndown; milestones (25/50/75/100% + per-100 lifetime); shuffle; shelf-bound books excluded by default while away. Shelf marker is the word `shelf`, not the importer prefix.
- [065 — Writing workflow review](docs/decisions/065-writing-workflow-review.md) (2026-07-07) — formatters September-ready, writing session not: no short-form UI, `[page]` on every copy → writing-session-gaps session; `work_type` SQL sweep; fixture strings need Covenant validation in August; never build auto-Ibid.

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

**Invoicing helpers:** `src/lib/invoicing/` — `chicago-date.ts`, `hours.ts`, `consultation-lines.ts` ([050]). Loaders/actions live inline in route `+page.server.ts` files **by design** (see AGENTS.md › Module structure).

**Library (maintenance only):** [docs/library-trip-qa-runbook.md](docs/library-trip-qa-runbook.md) — complete; viewer §B still deferred without collaborator.

**Supabase workflow:** Hosted `db push` / `deploy-functions` only — [supabase/README.md](supabase/README.md). Library schema: **`npm run ship-library:apply`**.

**Repo gate:** `npm run check` + `npm run test` **2026-07-23** ([135](docs/decisions/135-book-detail-notes-focus-jump.md); **0 errors**, 303 tests). Prior: [134](docs/decisions/134-sermons-by-book-series-dedupe.md).

**Data safety (R2 export):** Project is on the Supabase **Free plan** ([066](docs/decisions/066-operational-resilience-review.md)), so the R2 dumps are the **only** backup. **Pipeline live + restore proven** ([079](docs/decisions/079-ops-hardening-backups-restore-revoke.md)). `pg_dump -F c` to **private Cloudflare R2** via [`.github/workflows/backup.yml`](.github/workflows/backup.yml) (`workflow_dispatch` + **weekly** cron `0 8 * * 1`):

- `ppp-invoicing-YYYY-MM.dump` — **profiles**, clients, client_rates, time_entries, invoices, invoice_line_items
- `ppp-library-YYYY-MM.dump` — books, people, series, publishers, bible_books, ancient_texts, book_authors, book_bible_coverage, book_ancient_coverage, book_topics, essays, essay_authors, scripture_references
- `ppp-projects-YYYY-MM.dump` — projects, project_updates, project_tasks, project_links

**Restore smoke green** ([`restore-smoke.sh`](scripts/backup-restore-verify/restore-smoke.sh)): pre-data + data into scratch Postgres 17; invoicing 2 clients / 1 profile; library 1379 books / 1509 book_authors / 555 scripture_references. Owner runbook: [docs/reviews/2026-07-07-operational-resilience.md](docs/reviews/2026-07-07-operational-resilience.md). PITR add-on intentionally skipped. Retention: keep all for now.

---

## Session prompts (copy-paste)

### Sermons — Session 2: by-book commentary × sermon stats ✅ done ([095](docs/decisions/095-sermons-by-book-stats.md))

Spec: [brainstorms/2026-07-17-commentary-sermon-stats-dashboard.md](brainstorms/2026-07-17-commentary-sermon-stats-dashboard.md). Tracker: [docs/POS_Sermons_Build_Tracker.md](docs/POS_Sermons_Build_Tracker.md).

```
Session: sermons #2 — by-book commentary × sermon stats
… (shipped 2026-07-19)
```

### Invoicing — outgoing PDF diagnostics (owner; after [078](docs/decisions/078-invoice-email-pdf-mime.md) / [083](docs/decisions/083-invoice-pdf-email-diagnostics.md))

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

### Library Wave 2 — Session 2: essays CRUD UI ✅ done ([060](docs/decisions/060-library-wave2-session2-essays-ui.md))

### Library Wave 2 — Session 3: megacomponent split ✅ done ([062](docs/decisions/062-library-wave2-session3-megacomponent-split.md))

### Library Wave 2 — Session 4: .docx export ✅ done ([063](docs/decisions/063-library-wave2-session4-docx-export.md))

### Library — essay visibility + article discovery in search ✅ done ([086](docs/decisions/086-essay-visibility-and-search-lanes.md))

### Library Wave 2 — writing-session gaps (subsequent footnotes + page numbers) ✅ done ([094](docs/decisions/094-library-writing-session-gaps.md))

### Library — not-owned / research stubs Session 0 ✅ done ([101](docs/decisions/101-library-not-owned-session-0.md))

Capture: [brainstorms/2026-07-21-library-not-owned-session-0.md](brainstorms/2026-07-21-library-not-owned-session-0.md). Queue: [brainstorms/2026-07-17-goodreads-not-owned-queue.md](brainstorms/2026-07-17-goodreads-not-owned-queue.md).

### Library — not-owned Session 1: `owned` + hide + create-from-queue ✅ done ([103](docs/decisions/103-library-not-owned-session-1.md))

Owner follow-up: drain curated queue via `/settings/library/not-owned` (Create stub or Don’t create); mark physical copies owned when they arrive. Inbox UX: [107](docs/decisions/107-not-owned-pending-inbox-dismiss.md). Owned reappear fix + Session 2 abandoned: [108](docs/decisions/108-not-owned-owned-reappear-abandon-proposals.md).

### Library — not-owned settings pending inbox + dismiss ✅ done ([107](docs/decisions/107-not-owned-pending-inbox-dismiss.md))

### Library — not-owned owned-reappear + abandon Goodreads proposals ✅ done ([108](docs/decisions/108-not-owned-owned-reappear-abandon-proposals.md))

### Library — review-queue improvement + AI research pass ✅ done, full backlog run ✅ done ([067](docs/decisions/067-library-review-sprint-decks.md) + [068](docs/decisions/068-library-review-ai-research-pass.md) + [070](docs/decisions/070-library-genre-taxonomy-audit.md))

Owner follow-up: phone smoke the Research deck accept flow at ~673 pending proposals; the 45 books with no AI signal at all need eventual manual attention.

### Ops hardening — from [066](docs/decisions/066-operational-resilience-review.md) Q10–Q14 ✅ done ([079](docs/decisions/079-ops-hardening-backups-restore-revoke.md))

Owner follow-up: phone smoke cold-start / nav watchdog / chunk recovery ([072](docs/decisions/072-pwa-cold-start-resilience.md)); glance Actions after next Monday 08:00 UTC weekly backup for three R2 objects.

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

### Library Wave 2 — Session 1: article-level formatters ✅ done ([058](docs/decisions/058-library-wave2-session1-article-formatters.md))

### Projects — optional full phone smoke (owner)

```
Goal: Sign off Session 3 tracker row — full flow on phone (PWA if possible).
Flow: Create project under Work + sub-project → weekly check-in save → /dashboard glance →
  /tasks (add, zone, defer, promote, complete) → edit project → add link →
  /settings/audit-log?module=projects (task row + soft-delete revert).
Then: check Session 3 smoke box on docs/POS_Projects_Build_Tracker.md and note date in PLAN.md.
```

### Projects — fall MYN polish ✅ done ([128](docs/decisions/128-myn-fall-polish.md))

```
Session: projects — fall MYN polish
… (shipped 2026-07-23 — /settings/projects prefs; /tasks views + soft-cap + Target Now + defer presets)
```

Owner follow-up: mobile glance at-cap banner + Target Now row when convenient.
### PWA — branded icon set (deferred from 057)

```
Session: cross-cutting — PWA branded icons
Read: AGENTS.md, docs/decisions/057-pwa-consistency.md, static/manifest.webmanifest, static/icon-*.png
Goal: Replace black-square placeholders with a monogram icon set.
Acceptance:
 - [ ] icon-192.png + icon-512.png with visible "ppp" mark on zinc background
 - [ ] maskable variant with proper safe-zone padding
 - [ ] apple-touch-icon.png 180×180
 - [ ] Optional: apple-touch-startup-image splash screens for common iPhone sizes
 - [ ] Owner: re-add home-screen icon after deploy; spot-check light status bar + icon on springboard
```

### Review remediation — Session R2: security hardening

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

### Review remediation — Session R3: UX safety + first impressions ✅ done ([053](docs/decisions/053-ux-safety.md))

```
Session: cross-module — UX safety (review 051, Session R3)
Read: AGENTS.md, docs/decisions/051-product-review.md, .cursor/rules/components.mdc,
  src/routes/login/+page.svelte, src/routes/settings/permissions/+page.server.ts,
  src/routes/library/books/[id]/+page.svelte, src/routes/dashboard/+page.svelte
Goal: Rebuild login to the design system; add branded error surfaces; confirm-before-delete on books; dashboard Projects tile.
Acceptance:
 - [ ] Login uses shadcn Input/Label/Button, labeled inputs, role="alert" error, no inline style=
 - [ ] Root +error.svelte (branded, link home); /settings/permissions returns inline owner-only message not bare 403
 - [ ] Book delete goes through <ConfirmDialog> (desktop toolbar + mobile actions sheet)
 - [ ] Dashboard tile for Projects/Tasks with a live stat (open critical tasks or overdue check-in)
 - [ ] npm run check passes; mobile-width screenshots of login + dashboard
```

### Review remediation — Session R4: invoicing polish (half) ✅ done ([054](docs/decisions/054-invoicing-polish.md))

```
Session: invoicing — UX standardization (review 051, Session R4)
Read: AGENTS.md, docs/decisions/051-product-review.md, .cursor/rules/hotkeys.mdc,
  src/routes/invoicing/+page.svelte, src/routes/invoicing/invoices/[id]/+page.svelte,
  src/routes/settings/invoicing/+page.svelte, src/lib/components/time-entry-sheet.svelte
Goal: Retire window.confirm for <ConfirmDialog>; hotkey coverage on settings/invoicing; PageHeader migration; bottom-tabbar FABs.
Acceptance:
 - [x] No window.confirm left in src/; destructive invoicing actions use <ConfirmDialog>
 - [x] settings/invoicing primary buttons carry hotkeys (s/u/d/e per convention)
 - [x] Invoicing headers use <PageHeader>; FABs use bottom-tabbar class (no inline style=)
 - [x] npm run check passes; formMessage narrowed on form.kind on /invoicing
```

### Review remediation — Session R5: CI + backups ✅ done ([055](docs/decisions/055-ci-backups.md))

```
Session: repo — CI + monthly backups (review 051, Session R5)
Read: AGENTS.md, docs/decisions/051-product-review.md, PLAN.md › Data safety
Goal: GitHub Actions for check + test on push; monthly two-file pg_dump backup Action per Data safety spec.
Acceptance:
 - [x] .github/workflows/ci.yml — npm ci + npm run check + npm run test on push/PR
 - [x] .github/workflows/backup.yml — monthly cron, two pg_dump -F c files to private R2 (secret: DB URL)
 - [x] One test restore to scratch documented in the decision log
```

---

## Next up

### Do now
1. **Optional** — OCR matrix when next touching scripture batch ([030](docs/decisions/030-ocr-pdf-input.md)).

### Next week
2. **PWA icons** — branded monogram set (deferred from [057](docs/decisions/057-pwa-consistency.md); see Session prompts).
3. **Invoicing — first real-client send** (Sarah back in office). If outgoing PDF still missing/unopenable for one same-org recipient after [078](docs/decisions/078-invoice-email-pdf-mime.md), run [`docs/invoice-pdf-email-diagnostics.md`](docs/invoice-pdf-email-diagnostics.md) ([083](docs/decisions/083-invoice-pdf-email-diagnostics.md)) and return the minimum useful set before any further Edge MIME change.

### Wait for Madison / August
4. **Needs the shelf** — commentary Batch 5 added Calvin imprint / EHS / NIB / Arnold WBC / Berit Olam / Spurgeon Treasury flags ([121](docs/decisions/121-commentary-consistency-batch5.md)); plus prior ~50 + Goodreads leftovers ([096](docs/decisions/096-goodreads-owned-adds-enrichment.md)) on `/library/review?deck=shelf` ([087](docs/decisions/087-library-review-queue-research-cleanup.md)). Non-shelf research queue already **0**.
5. **Library Wave 2 — August shelf QA Track B** — physical shelf of all 20 fixture rows ([docs/library-turabian-fixtures.md](docs/library-turabian-fixtures.md)). Track A (Covenant strings) **done** ([102](docs/decisions/102-august-qa-covenant-fixtures.md)). Checklist in session prompt below.
6. **Harvard Classics full essay breakout** ([093](docs/decisions/093-goodreads-triage-execution.md)) — shelf-bound; do with other Madison library cleanup.

### Done recently (not open work)
- **Owner glance** — ✅ mobile `/tasks` at-cap banner + Target Now after fall polish ([128](docs/decisions/128-myn-fall-polish.md)).
- **Form control height consistency** — ✅ ([129](docs/decisions/129-form-control-height-consistency.md)); WebKit date + Select `lg`.
- **Fall MYN polish** — ✅ ([128](docs/decisions/128-myn-fall-polish.md)); lock [126](docs/decisions/126-myn-fall-backlog-lock.md).
- **Owner smoke (2026-07-22 / 23)** — sermons ✅ ([110](docs/decisions/110-sermons-owner-smoke-ux.md)); Projects E2E ✅ ([112](docs/decisions/112-task-sheet-date-overflow.md)); **`.docx` / commentary / cite** ✅; **PWA resume ✅**; **essays/DOTHB + Articles ✅** ([124](docs/decisions/124-dothb-essay-smoke-seed.md)/[125](docs/decisions/125-books-citation-abbreviation.md) — compact first footnote kept); megacomponent core ✅ (OCR deferred); weekly backup **pipeline OK** (Actions green + three R2 objects 2026-07-20; TOC/`pg_restore -l` skipped — no local client).
- **Baker publisher link pass** — ✅ ([133](docs/decisions/133-baker-publisher-link-pass.md)); Academic/Books linked + Grand Rapids; clear mislinks reminted.
- **B&H publisher link backfill** — ✅ ([131](docs/decisions/131-bh-publisher-link-backfill.md)); 28 rows → `B&H Academic` / Nashville (incl. Broadman / Holman; Logos mislink fix).
- **IVP publisher_location backfill** — ✅ ([127](docs/decisions/127-ivp-publisher-location-backfill.md)); free-text link + B&H/Eerdmans outlier fixes.
- **Not-owned queue drain** — ✅ ([107](docs/decisions/107-not-owned-pending-inbox-dismiss.md), [108](docs/decisions/108-not-owned-owned-reappear-abandon-proposals.md)); Session 2+ Goodreads proposals abandoned.
