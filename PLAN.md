# PLAN.md — Parker's Platform (ppp)

**Last updated:** 2026-07-06 — Library Wave 2 Session 1 shipped ([058](docs/decisions/058-library-wave2-session1-article-formatters.md)): article formatters, 20/20 Turabian fixtures green, essay seed SQL. Prior: PWA consistency ([057](docs/decisions/057-pwa-consistency.md)).
**How to use this file:**
- Cursor reads it automatically.
- For the Claude.ai "Parker's Platform" project, paste the contents of this file at the start of any session that needs current state.
- At the end of every session in either tool, update this file before stopping.

---

## Current focus

**Product review remediation (051):** R1 docs trust + **R2 security hardening** ([052](docs/decisions/052-security-hardening.md)) + **R3 UX safety** ([053](docs/decisions/053-ux-safety.md)) + **R4 invoicing polish** ([054](docs/decisions/054-invoicing-polish.md)) + **R5 CI + backups** ([055](docs/decisions/055-ci-backups.md)) — **complete**. Viewer-readiness items stay in backlog until a collaborator nears.

**Projects — v1 feature-complete:** Tree + check-in ([045]), dashboard + filters ([046]), MYN tasks + links + audit ([047](docs/decisions/047-projects-session-3-myn-tasks-links-audit.md)), Epic status appearance ([047b](docs/decisions/047-projects-status-appearance.md)), weekly check-in **progress tracking** ([048](docs/decisions/048-projects-checkin-progress.md)). Design: [MYN_TASKS_DESIGN.md](docs/MYN_TASKS_DESIGN.md). **Session 1 phone smoke** signed off (tree + check-in). **Full end-to-end smoke** (dashboard + tasks + links + audit) still optional on tracker.

**Invoicing — ad-hoc enhancements shipped 2026-06-22:** discard sent invoices ([049](docs/decisions/049-invoicing-discard-sent.md)); per-client billing preferences — `billing_cadence` + `consultation_grouping` on `clients`, `buildConsultationLines()` ([050](docs/decisions/050-invoicing-client-billing-preferences.md)). Migration `20260622120000_clients_billing_preferences.sql` applied.

**Library — Wave 2 Session 1 complete; Session 2 next:** Trip QA **signed off 2026-06-03** ([043](docs/decisions/043-library-trip-qa-signoff-projects-handoff.md)). **Fixture-first build** locked 2026-07-06 ([056](docs/decisions/056-library-wave2-phase0.md)): [library-turabian-fixtures.md](docs/library-turabian-fixtures.md) — **20 pass / 0 fail**. **Session 1 shipped** ([058](docs/decisions/058-library-wave2-session1-article-formatters.md)): `formatEssayFootnote` / `formatEssayBibliography`, short-footnote fix, essay seed SQL. **Session 2:** essays CRUD UI. **Session 3:** megacomponent split. **Session 4:** `.docx` export.

Nearest hard dates:
- **2026-05-21** — move to Madison; trip-period workflow (mobile-first) — library usable
- **2026-08** — return; library Wave 2 execution window
- **2026-09** — fall-semester-ready citations, **incl. article-level** (signed articles/essays: ABD, TDNT, IVP dicts, essay collections)

---

## Active modules

| Module | Tracker | State |
|---|---|---|
| Invoicing | [docs/POS_Invoicing_Build_Tracker.md](docs/POS_Invoicing_Build_Tracker.md) | ✅ Code complete (Sessions 1–6) + ad-hoc: discard sent ([049]), per-client billing preferences ([050]), UX standardization ([054](docs/decisions/054-invoicing-polish.md) — ConfirmDialog / PageHeader / bottom-tabbar / hotkeys). |
| Library | [docs/POS_Library_Build_Tracker.md](docs/POS_Library_Build_Tracker.md) | ✅ Trip build complete — QA signed off 2026-06-03. **Wave 2 Session 1 shipped** ([058](docs/decisions/058-library-wave2-session1-article-formatters.md)): 20/20 Turabian fixtures, article formatters, essay seed SQL. **Next: Session 2** essays UI. Sessions 3–4: megacomponent split, `.docx`. |
| Projects | [docs/POS_Projects_Build_Tracker.md](docs/POS_Projects_Build_Tracker.md) | ✅ **v1 complete** — tree/check-in, dashboard/filters, MYN `/projects/tasks`, links in Sheet, audit. **Viewer access:** owner-only by design (not deferred debt); revisit only if a collaborator is added — [POS_Projects_Build_Tracker.md](docs/POS_Projects_Build_Tracker.md). **Backlog:** polish, global Now ([MYN_TASKS_DESIGN.md](docs/MYN_TASKS_DESIGN.md)), optional full phone smoke. |

Operating guide: [AGENTS.md](AGENTS.md). Cursor rules: [.cursor/rules/](.cursor/rules/). Full decision archive: [docs/decisions/](docs/decisions/).

---

## Recent decisions (last 3 — full archive in `docs/decisions/`)

- [058 — Library Wave 2 Session 1 — article formatters](docs/decisions/058-library-wave2-session1-article-formatters.md) (2026-07-06) — `formatEssayFootnote`/`formatEssayBibliography` dispatch; short-footnote casing + article strip; 20/20 fixtures; `library_essays_seed.sql`.
- [057 — PWA consistency pass](docs/decisions/057-pwa-consistency.md) (2026-07-06) — light theme chrome; offline navigate fallback; hourly + on-resume SW update checks; `__APP_BUILD__` on Settings; `vocab-cache-paths.ts` single source of truth.
- [056 — Library Wave 2 Phase 0 — fixture-first Turabian](docs/decisions/056-library-wave2-phase0.md) (2026-07-06) — 20-row QA fixture doc + `WAVE2_FIXTURES` vitest mirror; 15 pass / 5 fail gap analysis; Session 1–4 sequence locked; `EssayCitationInput.authors` type wedge.
- [054 — Invoicing UX standardization (review 051 R4)](docs/decisions/054-invoicing-polish.md) (2026-07-06) — retired all `window.confirm` for `<ConfirmDialog>` (invoice detail + time-entry sheet + library batch-scripture nav guard), `<PageHeader>` migration, `bottom-tabbar` FAB, `hotkey="b"` on create triggers, `formMessage` narrowed on `form.kind`.

---

## Session handoff

**Projects (use weekly):**
- `/projects` — inline tree + weekly check-in (`depends('app:projects:tree')`), optional **progress tracking** per check-in (value / of / note — [048](docs/decisions/048-projects-checkin-progress.md)).
- `/dashboard` — domain status strip + attention deep link.
- `/projects/tasks` — MYN zones (Critical / Opportunity / OTH), FRESH sort, defer/promote; `?project=` filter.
- Edit project Sheet — metadata + **links** (edit mode only).
- `/settings/audit-log?module=projects` — includes `project_tasks` soft-delete revert.

**Projects helpers:** `src/lib/projects/` — `week.ts`, `filter.ts`, `progress.ts` ([048]), `carry-forward.ts` ([048]), `health-appearance.ts` ([047b](docs/decisions/047-projects-status-appearance.md)), `server/loaders.ts`, `server/actions.ts`, `server/task-loaders.ts`, `server/task-actions.ts`. Design: [MYN_TASKS_DESIGN.md](docs/MYN_TASKS_DESIGN.md).

**Projects migrations (prod):** `20260603170000_ppp_projects_v1.sql`, `20260603200000_projects_add_not_started_lifecycle.sql`, `20260604030000_ppp_project_tasks_myn.sql`, `20260604100000_project_updates_progress.sql`.

**Invoicing helpers:** `src/lib/invoicing/` — `chicago-date.ts`, `hours.ts`, `consultation-lines.ts` ([050]). Loaders/actions live inline in route `+page.server.ts` files **by design** (see AGENTS.md › Module structure).

**Library (maintenance only):** [docs/library-trip-qa-runbook.md](docs/library-trip-qa-runbook.md) — complete; viewer §B still deferred without collaborator.

**Supabase workflow:** Hosted `db push` / `deploy-functions` only — [supabase/README.md](supabase/README.md). Library schema: **`npm run ship-library:apply`**.

**Repo gate:** `npm run check` + `npm run test` + `npm run build` re-verified **2026-07-06** (Library Wave 2 Session 1 / [058](docs/decisions/058-library-wave2-session1-article-formatters.md); check **0 errors**; test **132/132** green). Prior: PWA consistency / [057](docs/decisions/057-pwa-consistency.md).

**Data safety (monthly export):** Off-Supabase belt-and-suspenders beyond Supabase Pro's 7-day daily backups. Monthly `pg_dump -F c`, two files pushed to **private Cloudflare R2** via [`.github/workflows/backup.yml`](.github/workflows/backup.yml) (cron 1st of month + `workflow_dispatch`):

- `ppp-invoicing-YYYY-MM.dump` — clients, client_rates, time_entries, invoices, invoice_line_items
- `ppp-library-YYYY-MM.dump` — books, people, series, publishers, bible_books, ancient_texts, book_authors, book_bible_coverage, book_ancient_coverage, book_topics, essays, essay_authors, scripture_references

Notes: both reference `profiles`/`audit_log` — a restore loads the single `profiles` row first. Verify with [`scripts/backup-restore-verify/restore-smoke.sh`](scripts/backup-restore-verify/restore-smoke.sh) once GitHub secrets + R2 bucket are set ([055](docs/decisions/055-ci-backups.md)). Projects export deferred (low change rate). PITR add-on intentionally skipped (cost vs. solo value). Retention: keep all for now.

---

## Session prompts (copy-paste)

### Library Wave 2 — Session 2: essays CRUD UI

```
Session: library — Wave 2 Session 2 (essays UI)
Tracker: docs/POS_Library_Build_Tracker.md, Wave 2 Session 2
Read: AGENTS.md, docs/decisions/058-library-wave2-session1-article-formatters.md,
  src/lib/library/turabian/article.ts, src/routes/library/books/[id]/+page.svelte
Goal: Essays CRUD on book detail; per-essay copy footnote/bib; loaders hydrate EssayCitationInput.
Acceptance:
 - [ ] Apply supabase/seed/library_essays_seed.sql if not yet run
 - [ ] Essay list + create/edit/delete on book detail (reference_work + edited_volume parents)
 - [ ] Copy Footnote / Copy Bibliography per essay row
 - [ ] audit_log whitelist extended for essays + essay_authors
 - [ ] npm run check + npm run test pass
End-of-session: docs/decisions/059-*.md, tracker Session 2 ticked, PLAN.md refreshed
```

### Library Wave 2 — Session 1: article-level formatters ✅ done ([058](docs/decisions/058-library-wave2-session1-article-formatters.md))

### Projects — optional full phone smoke (owner)

```
Goal: Sign off Session 3 tracker row — full flow on phone (PWA if possible).
Flow: Create project under Work + sub-project → weekly check-in save → /dashboard glance →
  /projects/tasks (add, zone, defer, promote, complete) → edit project → add link →
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

1. **Library Wave 2 Session 2** — essays CRUD UI on book detail; per-essay copy; loaders + audit whitelist ([058](docs/decisions/058-library-wave2-session1-article-formatters.md)).
2. **Apply essay seed** — paste [`supabase/seed/library_essays_seed.sql`](supabase/seed/library_essays_seed.sql) in Supabase SQL editor; confirm `audit_log` row for one INSERT.
3. **Projects — use v1 weekly** (tree check-in + optional `/projects/tasks`). Retrospective / process: central Claude project (see tracker Notes).
4. **Projects backlog (pick one when ready):** global MYN Now view · optional full phone smoke on tracker.
5. **PWA icons** — branded monogram set (deferred from [057](docs/decisions/057-pwa-consistency.md); see Session prompts).
6. **Invoicing:** first real-client send cadence (owner-driven).
7. **Backups:** set GitHub secrets + R2 bucket; run `workflow_dispatch` + restore smoke once ([055](docs/decisions/055-ci-backups.md)).
