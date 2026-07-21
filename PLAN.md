# PLAN.md — Parker's Platform (ppp)

**Last updated:** 2026-07-21 — **PWA update banners non-blocking** ([100](docs/decisions/100-pwa-update-banner-nonblocking.md)): top-anchored; Clear cache primary + Later. Prior: MYN trial adopted ([099](docs/decisions/099-myn-trial-adopted.md)).
**How to use this file:**
- Cursor reads it automatically.
- For the Claude.ai "Parker's Platform" project, paste the contents of this file at the start of any session that needs current state.
- At the end of every session in either tool, update this file before stopping.

---

## Current focus

**Overnight deep-dive reviews (2026-07-07, decision-first):** three background agents — **usage retrospective** ([064](docs/decisions/064-usage-retrospective-review.md)), **writing workflow** ([065](docs/decisions/065-writing-workflow-review.md)), **operational resilience** ([066](docs/decisions/066-operational-resilience-review.md)); reports in [docs/reviews/](docs/reviews/). All 14 open calls answered. **Review-queue improvement + AI research pass: done** ([067](docs/decisions/067-library-review-sprint-decks.md), [068](docs/decisions/068-library-review-ai-research-pass.md)). **Nav watchdog shipped** ([072](docs/decisions/072-pwa-cold-start-resilience.md)); **PWA update auto-recover** ([082](docs/decisions/082-pwa-update-auto-recover.md)); **update banners non-blocking** ([100](docs/decisions/100-pwa-update-banner-nonblocking.md)). **Ops hardening shipped** ([079](docs/decisions/079-ops-hardening-backups-restore-revoke.md)). **Writing-session gaps shipped** ([094](docs/decisions/094-library-writing-session-gaps.md)). **MYN adopted** ([099](docs/decisions/099-myn-trial-adopted.md)) — keep `/tasks`; fall polish OK; Global Now parked.

**Review queue — research cleanup done ([087](docs/decisions/087-library-review-queue-research-cleanup.md)):** non-shelf `needs_review` and pending proposals drained to **0**. Remaining: **Needs the shelf** deck (**50** books — ISBN/year/publisher/edition). Decks/sprints/proposals UI from [067](docs/decisions/067-library-review-sprint-decks.md)+[068](docs/decisions/068-library-review-ai-research-pass.md) still the workflow for Madison. Taxonomy: Politics and Policy, Leadership, Literary Criticism, Church Fathers, Ancient Biblical Sources, Children's and Young Adult; `books.copy_count` for multi-copy rows.

**Product review remediation (051):** R1 docs trust + **R2 security hardening** ([052](docs/decisions/052-security-hardening.md)) + **R3 UX safety** ([053](docs/decisions/053-ux-safety.md)) + **R4 invoicing polish** ([054](docs/decisions/054-invoicing-polish.md)) + **R5 CI + backups** ([055](docs/decisions/055-ci-backups.md)) — **complete**. Viewer-readiness items stay in backlog until a collaborator nears.

**Projects — v1 feature-complete:** Tree + check-in ([045]), dashboard + filters ([046]), MYN tasks + links + audit ([047](docs/decisions/047-projects-session-3-myn-tasks-links-audit.md)), Epic status appearance ([047b](docs/decisions/047-projects-status-appearance.md)), weekly check-in **progress tracking** ([048](docs/decisions/048-projects-checkin-progress.md)). Design: [MYN_TASKS_DESIGN.md](docs/MYN_TASKS_DESIGN.md). **Session 1 phone smoke** signed off (tree + check-in). **Full end-to-end smoke** (dashboard + tasks + links + audit) still optional on tracker.

**Invoicing — ad-hoc enhancements shipped 2026-06-22:** discard sent invoices ([049](docs/decisions/049-invoicing-discard-sent.md)); per-client billing preferences — `billing_cadence` + `consultation_grouping` on `clients`, `buildConsultationLines()` ([050](docs/decisions/050-invoicing-client-billing-preferences.md)). Migration `20260622120000_clients_billing_preferences.sql` applied.

**Library — Wave 2 Sessions 1–4 complete; August shelf QA next:** Trip QA **signed off 2026-06-03** ([043](docs/decisions/043-library-trip-qa-signoff-projects-handoff.md)). **Fixture-first build** locked 2026-07-06 ([056](docs/decisions/056-library-wave2-phase0.md)): [library-turabian-fixtures.md](docs/library-turabian-fixtures.md) — **20 pass / 0 fail**. **Session 1 shipped** ([058](docs/decisions/058-library-wave2-session1-article-formatters.md)): article formatters + essay seed SQL. **Session 2 shipped** ([060](docs/decisions/060-library-wave2-session2-essays-ui.md)): essays CRUD on book detail + per-essay copy. **Session 3 shipped** ([062](docs/decisions/062-library-wave2-session3-megacomponent-split.md)): megacomponent split. **Session 4 shipped** ([063](docs/decisions/063-library-wave2-session4-docx-export.md)): `.docx` bibliography export (hanging indent + italics) from `/library/bibliography`. **Owner:** apply essay seed SQL if not yet run; phone smoke after split; `.docx` Word smoke (build bibliography → download → verify indent/italics).

Nearest hard dates:
- **2026-05-21** — move to Madison; trip-period workflow (mobile-first) — library usable
- **2026-08** — return; library Wave 2 execution window
- **2026-09** — fall-semester-ready citations, **incl. article-level** (signed articles/essays: ABD, TDNT, IVP dicts, essay collections)

---

## Active modules

| Module | Tracker | State |
|---|---|---|
| Invoicing | [docs/POS_Invoicing_Build_Tracker.md](docs/POS_Invoicing_Build_Tracker.md) | ✅ Code complete (Sessions 1–6) + ad-hoc: discard sent ([049]), per-client billing preferences ([050]), UX standardization ([054](docs/decisions/054-invoicing-polish.md)), dashboard last-week generate ([059](docs/decisions/059-dashboard-last-week-invoice.md)), PDF email MIME harden ([078](docs/decisions/078-invoice-email-pdf-mime.md)), PDF email diagnostics runbook ([083](docs/decisions/083-invoice-pdf-email-diagnostics.md)). |
| Library | [docs/POS_Library_Build_Tracker.md](docs/POS_Library_Build_Tracker.md) | ✅ Trip build complete — QA signed off 2026-06-03. **Wave 2 Sessions 1–4 + writing-session gaps** ([094](docs/decisions/094-library-writing-session-gaps.md)). **Next: August shelf QA** (all 20 fixture rows). Owner phone smoke of copy row. |
| Projects | [docs/POS_Projects_Build_Tracker.md](docs/POS_Projects_Build_Tracker.md) | ✅ **v1 complete** + **email-to-task + domain colors** ([077](docs/decisions/077-email-to-task-and-domain-colors.md)) + project select scroll ([080](docs/decisions/080-tasks-project-select-scroll.md)) + domain-root task options ([081](docs/decisions/081-tasks-project-options-domains.md)). Tree/check-in, dashboard/filters, MYN `/tasks` (top-level nav; `/projects/tasks` redirects), links, audit. **Inbound live** ([098](docs/decisions/098-resend-inbound-webhook-secrets.md)). **MYN adopted** ([099](docs/decisions/099-myn-trial-adopted.md)); Global Now parked until fall. **Viewer access:** owner-only by design. **Backlog:** fall MYN polish ([MYN_TASKS_DESIGN.md](docs/MYN_TASKS_DESIGN.md)). |
| Sermons | [docs/POS_Sermons_Build_Tracker.md](docs/POS_Sermons_Build_Tracker.md) | ✅ **v1 Sessions 1–2** ([091](docs/decisions/091-sermons-session-1.md), [095](docs/decisions/095-sermons-by-book-stats.md)): `/sermons` + venues + seed + Find-in-library + `/sermons/by-book`. **Owner:** phone smoke list + by-book if not done. |

Operating guide: [AGENTS.md](AGENTS.md). Cursor rules: [.cursor/rules/](.cursor/rules/). Full decision archive: [docs/decisions/](docs/decisions/).

---

## Recent decisions (last 3 — full archive in `docs/decisions/`)

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
- `/dashboard` — domain status strip + attention deep link.
- `/tasks` — MYN zones (Critical / Opportunity / OTH), FRESH sort, defer/promote; `?project=` filter. Legacy `/projects/tasks` 308-redirects here.
- Edit project Sheet — metadata + **links** (edit mode only).
- `/settings/audit-log?module=projects` — includes `project_tasks` soft-delete revert.

**Projects helpers:** `src/lib/projects/` — `week.ts`, `filter.ts`, `progress.ts` ([048]), `carry-forward.ts` ([048]), `health-appearance.ts` ([047b](docs/decisions/047-projects-status-appearance.md)), `project-colors.ts` + `email-inbound.ts` ([077](docs/decisions/077-email-to-task-and-domain-colors.md)), `server/loaders.ts`, `server/actions.ts`, `server/task-loaders.ts`, `server/task-actions.ts`. Design: [MYN_TASKS_DESIGN.md](docs/MYN_TASKS_DESIGN.md).

**Projects migrations (prod):** `20260603170000_ppp_projects_v1.sql`, `20260603200000_projects_add_not_started_lifecycle.sql`, `20260604030000_ppp_project_tasks_myn.sql`, `20260604100000_project_updates_progress.sql`, `20260709164016_projects_email_inbox_and_domain_colors.sql`.

**Sermons:** `/sermons` list + Sheet; `/sermons/by-book` commentary × sermon spine; `/settings/sermons/venues`; helpers `src/lib/sermons/`; migration `20260717190000_ppp_sermons_v1.sql` ([091](docs/decisions/091-sermons-session-1.md), [095](docs/decisions/095-sermons-by-book-stats.md)).

**Invoicing helpers:** `src/lib/invoicing/` — `chicago-date.ts`, `hours.ts`, `consultation-lines.ts` ([050]). Loaders/actions live inline in route `+page.server.ts` files **by design** (see AGENTS.md › Module structure).

**Library (maintenance only):** [docs/library-trip-qa-runbook.md](docs/library-trip-qa-runbook.md) — complete; viewer §B still deferred without collaborator.

**Supabase workflow:** Hosted `db push` / `deploy-functions` only — [supabase/README.md](supabase/README.md). Library schema: **`npm run ship-library:apply`**.

**Repo gate:** `npm run check` + `npm run test` (pwa recovery) **2026-07-21** ([100](docs/decisions/100-pwa-update-banner-nonblocking.md); check **0 errors**). Prior: `npm run build` exit 0 ([097](docs/decisions/097-vercel-deploy-ci-build-gate.md)).

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

### Library — review-queue improvement + AI research pass ✅ done, full backlog run ✅ done ([067](docs/decisions/067-library-review-sprint-decks.md) + [068](docs/decisions/068-library-review-ai-research-pass.md) + [070](docs/decisions/070-library-genre-taxonomy-audit.md))

Owner follow-up: phone smoke the Research deck accept flow at ~673 pending proposals; the 45 books with no AI signal at all need eventual manual attention.

### Ops hardening — from [066](docs/decisions/066-operational-resilience-review.md) Q10–Q14 ✅ done ([079](docs/decisions/079-ops-hardening-backups-restore-revoke.md))

Owner follow-up: phone smoke cold-start / nav watchdog / chunk recovery ([072](docs/decisions/072-pwa-cold-start-resilience.md)); glance Actions after next Monday 08:00 UTC weekly backup for three R2 objects.

### Library Wave 2 — August shelf QA (owner + agent)

```
Session: library — Wave 2 August shelf QA
Tracker: docs/POS_Library_Build_Tracker.md, Wave 2 "August" row
Read: AGENTS.md, docs/library-turabian-fixtures.md, docs/decisions/063-library-wave2-session4-docx-export.md,
  docs/decisions/065-writing-workflow-review.md, .claude/skills/turabian-qa/
Goal: Verify all 20 fixture rows against the physical shelf; fix formatter gaps surfaced by real metadata.
Also (from 065): validate the 20 EXPECTED STRINGS against the Covenant guide itself, not just re-run the
  suite — special attention rows 8 + 17 (signed-ABD title duplication in article.ts); verify the work_type
  SQL sweep (Q8) against the shelf's reference works.
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

### Projects — global MYN Now view (future session)

```
Read: docs/MYN_TASKS_DESIGN.md (Future architectural build), AGENTS.md projects inventory,
  src/lib/components/project-task-list.svelte, docs/decisions/047-projects-session-3-myn-tasks-links-audit.md
Goal: Cross-project (and eventually cross-module) unified Now list — reuse task list component.
Phase 0: nullable project_id? nav entry? defer-to-Review automation scope?
```

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

1. **Owner — protect `main`** ([097](docs/decisions/097-vercel-deploy-ci-build-gate.md)) — GitHub branch protection: require CI job `check-and-test` (now includes `npm run build`) so red check cannot reach Vercel. Confirm next Production deploy stays Ready after CI lands.
2. **Owner smokes** — phone smoke `/sermons/by-book` ([095](docs/decisions/095-sermons-by-book-stats.md)); sermons list ([091](docs/decisions/091-sermons-session-1.md)); writing-session copy row ([094](docs/decisions/094-library-writing-session-gaps.md)); phone smoke after megacomponent split ([062](docs/decisions/062-library-wave2-session3-megacomponent-split.md), `.claude/skills/library-owner-smoke/`); `.docx` Word smoke ([063](docs/decisions/063-library-wave2-session4-docx-export.md)); essays smoke on ABD vol 1 **+ essay preview / Articles-in-volumes search** ([086](docs/decisions/086-essay-visibility-and-search-lanes.md)); **archive Fountain of Life client** ([064](docs/decisions/064-usage-retrospective-review.md) Q4); **cold-start / nav watchdog** ([072](docs/decisions/072-pwa-cold-start-resilience.md)) + **resume auto-update** ([082](docs/decisions/082-pwa-update-auto-recover.md)); glance Actions after next Monday weekly backup ([079](docs/decisions/079-ops-hardening-backups-restore-revoke.md)).
3. **Library — review queue non-shelf drained** ([087](docs/decisions/087-library-review-queue-research-cleanup.md)) — Research deck empty. Next review work is **Madison Needs the shelf** (50 books).
4. **MYN adopted** ([099](docs/decisions/099-myn-trial-adopted.md)) — keep `/tasks`; fall polish as needed. Global Now parked until fall. **Email → task live** ([098](docs/decisions/098-resend-inbound-webhook-secrets.md)).
5. **Library Wave 2 — August shelf QA** — 20 fixture rows against the shelf **+ Covenant-guide string validation** ([065](docs/decisions/065-writing-workflow-review.md) Q9). See Session prompts. **Plus:** drain the "Needs the shelf" review deck (prior **50** + Goodreads edition leftovers from [096](docs/decisions/096-goodreads-owned-adds-enrichment.md): NASB, D-Day Encyclopedia, DK WW2, Geschichte, Drive, Hitler/Churchill, Tollbooth, classics).
6. **PWA icons** — branded monogram set (deferred from [057](docs/decisions/057-pwa-consistency.md); see Session prompts).
7. **Library — not owned / research stubs** (Parker to plan; [089](docs/decisions/089-book-rating-ui-goodreads-import.md), queue [brainstorms/2026-07-17-goodreads-not-owned-queue.md](brainstorms/2026-07-17-goodreads-not-owned-queue.md)) — `owned` flag, hide from `/library` search by default, selective create from queue, matched ISBN/year/publisher diffs. Also: Harvard Classics full essay breakout ([093](docs/decisions/093-goodreads-triage-execution.md)).
8. **Invoicing:** first real-client send cadence (owner-driven). **Owner:** if outgoing PDF still missing/unopenable for one same-org recipient after [078](docs/decisions/078-invoice-email-pdf-mime.md), run [`docs/invoice-pdf-email-diagnostics.md`](docs/invoice-pdf-email-diagnostics.md) ([083](docs/decisions/083-invoice-pdf-email-diagnostics.md)) and return the minimum useful set before any further Edge MIME change.
