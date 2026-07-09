# Operational resilience review — backups, restore, advisors, nav skeleton

**Date:** 2026-07-07 (overnight desk review, run evening of 2026-07-06)
**Scope:** Can Parker recover his data, and what blocks the backup pipeline? Plus advisor diff vs 040/052 and a code-level hypothesis for the 061 "endless nav skeleton" question.
**Method:** Read-only — repo files, `gh` (workflow/run/secret lists only), Supabase MCP `get_advisors` + `list_tables`. No repo edits besides this file, no DB writes, no workflow triggers.

---

## TLDR

- **The backup pipeline is LIVE, not blocked.** Contrary to the "secrets may not be set" expectation: all five GitHub secrets exist (set 2026-07-06), and run [28830982000](https://github.com/nneather/ppp/actions/runs/28830982000) (2026-07-06 23:43 UTC) uploaded both dumps to R2 — `2026/ppp-invoicing-2026-07.dump` (32.7 KiB) and `2026/ppp-library-2026-07.dump` (385.5 KiB). Next cron fire: 2026-08-01 08:00 UTC.
- **Verdict — can Parker recover his data today? Probably, but it is unproven.** A fresh off-site snapshot of invoicing + library exists in R2. But the restore path has **never been executed**, and desk-checking `restore-smoke.sh` found one **definite bug** (`pg_dump --where` does not exist in PostgreSQL 17 — the script will fail at the profiles-row step) plus several likely failures (schema-only `profiles` dump carries FKs/triggers/policies whose dependencies don't exist in a scratch container, under `ON_ERROR_STOP=1`).
- **Worst-case recovery point is ~1 month** (monthly cron) if Supabase's own backups are unavailable. PLAN.md says "Supabase Pro's 7-day daily backups" but decision 040 recorded the project on the **Free plan** — these contradict, and the answer changes the whole DR picture. Needs a 10-second Dashboard check (see Proposed decision D1).
- **Table drift: projects tables are no longer a reasonable exclusion.** `projects` (24 rows) and `project_updates` (120 rows — a month of weekly check-ins) hold real, irreplaceable data and are in no dump. `profiles` (1 row) is also in no dump — the restore procedure fetches it from *live prod*, which does not exist in a true-disaster scenario.
- **Advisors: one genuinely new security finding.** `library_refresh_book_list_denorm` + its trigger function (migration `20260603160000`, created *after* the 040 revoke pass) are anon-executable SECURITY DEFINER functions — the same class of issue 040 fixed with `20260528150000`. Everything else matches the 040/052 accepted baseline. Performance lints are volume noise (240× multiple-permissive-policies is the known owner+viewer policy architecture), nothing urgent.
- **Endless nav skeleton — hypothesis formed:** the SW's 10s `NetworkOnly` timeout only protects *document* navigations. Client-side SvelteKit navigations fetch `__data.json`, which no service-worker route matches and which has **no timeout anywhere** — a hung data fetch (classic on iOS PWA resume with a stale socket) leaves `navigating.to` set forever, and the root layout renders `<NavModuleSkeleton>` unconditionally while it is set. Phone repro with Safari remote inspector remains an owner task.
- **CI is healthy:** last 5 runs on `main` all green (latest: the 061 push, 43s).

---

## 1. Live status (gh evidence)

`gh workflow list`: both workflows active — `Monthly database backup` (308191297), `CI` (308191298).

`gh secret list` (names + set-dates only):

| Secret | Updated |
|---|---|
| `BACKUP_DATABASE_URL` | 2026-07-06 23:17 UTC |
| `R2_ACCESS_KEY_ID` | 2026-07-06 23:41 UTC |
| `R2_BUCKET` | 2026-07-06 22:39 UTC |
| `R2_ENDPOINT` | 2026-07-06 22:39 UTC |
| `R2_SECRET_ACCESS_KEY` | 2026-07-06 23:41 UTC |

`gh run list --workflow=backup.yml`: 6 runs on 2026-07-06, all `workflow_dispatch`. Five failures (the Direct-URI, pg_dump-16-vs-17, and swapped-R2-key iterations documented in 055's follow-up) then **success 28830982000** at 23:43 UTC. The run log confirms `pg_dump (PostgreSQL) 17.10` and both `aws s3 cp` uploads completing (`32.7 KiB` invoicing, `385.5 KiB` library, keys under `2026/`).

`gh run list --workflow=ci.yml`: last 5 runs green, including pushes for decisions 058–061.

**What is actually still open** (the real "blocking" list, much shorter than expected):

1. Restore has never been tested (055: "Local `restore-smoke.sh` still optional" — and see §3, it will fail as written).
2. The August 1 cron has never fired unattended; nobody is notified on scheduled-run failure unless Parker watches the Actions tab (GitHub only emails the workflow-file author on scheduled failures, and that's easy to miss).
3. Confirm the Supabase plan tier (D1) — determines whether R2 is the *only* backup or belt-and-suspenders.

---

## 2. Backup table-list drift

Source of truth compared: `backup.yml` arrays vs live schema (`list_tables` against prod, 27 public tables) vs `src/lib/types/database.ts` vs `supabase/migrations/` filenames. No migrations exist after `20260705170000`, and none since 055 (same-day) created tables — so there is **no post-055 accidental drift**. The question is whether 055's *intentional* exclusions still hold.

| Table | In dump? | Assessment |
|---|---|---|
| `clients`, `client_rates`, `time_entries`, `invoices`, `invoice_line_items` | invoicing dump | Correct, complete for the module. |
| `books`, `people`, `series`, `publishers`, `bible_books`, `ancient_texts`, `book_authors`, `book_bible_coverage`, `book_ancient_coverage`, `book_topics`, `essays`, `essay_authors`, `scripture_references` | library dump | Correct — includes the Wave-2 `essays`/`essay_authors` tables (5 + 2 rows live). |
| `projects`, `project_updates`, `project_tasks`, `project_links` | **no** | **Drift — should be added.** 055 deferred these for "low change rate," but prod now holds 24 projects and **120 `project_updates` rows** — a month of weekly check-in history that exists nowhere else and is exactly the kind of hand-entered data backups are for. `project_tasks`/`project_links` are empty today but cost nothing to include. See D2. |
| `profiles` | **no** | **Gap in the disaster path.** PLAN.md's note "a restore loads the single `profiles` row first" is only true while prod is alive to be dumped from — `restore-smoke.sh` fetches it live. In a total-loss scenario the row (and its `auth.users` parent) is gone; every `created_by`/`user_id` in the dumps references its UUID. A re-signup would mint a *new* UUID via `handle_new_user`. One row, kilobytes: include it. See D3. |
| `audit_log` | no | Intentional, fine — 10,726 rows of trigger-generated history; losing it loses forensics, not data. Acceptable for a solo app (revisit if it ever feeds features). |
| `user_permissions` | no | Intentional, fine — 0 rows; recreated in minutes when a viewer is added. |
| `library_ocr_usage` | no | Intentional, fine — ephemeral daily counters, 0 rows. |
| `module_registry` | no | Intentional, fine — 0 rows, seeded by migration. |
| `bible_books` | **in dump** | Included (migration-seeded static vocab, 66 rows) — harmless redundancy, keep. |

Also worth noting: `-t` table dumps do **not** include `invoice_number_seq`. Benign — the self-healing `generate_invoice_number()` (migration `20260427170000`) recomputes the sequence from `MAX(invoice_number)` on next call, so a restore self-corrects. Worth one line in the restore notes so nobody panics at the missing sequence.

---

## 3. Restore coverage — the weak half of the pipeline

### 3a. The smoke script will fail as written (desk verification)

`scripts/backup-restore-verify/restore-smoke.sh` has never been run (055 session note: Docker daemon unavailable). Desk-checking it found:

1. **Definite bug — `--where` does not exist.** Line 75 runs `pg_dump --data-only ... --where "id = '$OWNER_ID'"`. PostgreSQL 17's `pg_dump` has no `--where` option (verified against the [v17 docs](https://www.postgresql.org/docs/17/app-pgdump.html); row filtering was never merged — only object-level `--filter`). The step exits non-zero and `set -euo pipefail` aborts the script. Simplest fix (there is exactly 1 profiles row anyway): drop `--where` and dump the whole table data-only, or use `psql \copy (SELECT * FROM public.profiles WHERE id = '…') TO CSV`.
2. **Likely failure — schema-only `profiles` load into a bare scratch container.** `pg_dump --schema-only -t public.profiles` emits the table *plus* its FK to `auth.users`, its `set_updated_at`/`write_audit_log` triggers, and its RLS policies calling `app_is_owner()` — none of whose dependencies exist in the scratch container. Loaded via `psql -v ON_ERROR_STOP=1`, the first missing dependency aborts. (Exact failure point depends on pg_dump's emission order; the FK `ALTER TABLE` and `CREATE TRIGGER` statements are both fatal candidates.)
3. **README/script mismatch.** The README describes step 4 as `pg_restore --data-only --disable-triggers`, but the script runs a plain `pg_restore -d postgres /invoicing.dump` (schema + data). In the schema+data mode, the dump's own `CREATE TRIGGER` statements (audit triggers referencing `write_audit_log`, absent from the dump) will error; `pg_restore` exits 1 when any errors occurred, which `set -e` treats as fatal.

Conclusion: **the restore procedure is not just unverified — it is currently guaranteed to fail.** This is the single most important resilience finding of the night. The fix is small (a session under an hour) but it must actually be run, with Docker up, before backups can be called recoverable.

### 3b. Does an invoicing-only smoke give false confidence for library?

Yes, moderately. What the invoicing smoke exercises: profiles-first FK ordering, one flat module with a shallow FK graph (5 tables, deepest chain `invoice_line_items → invoices → clients`). What library adds that it never touches:

- **A much deeper FK graph across 13 tables.** Vocabulary parents (`people`, `series`, `publishers` — note `publishers.parent_id` self-reference, `people`/`publishers`/`ancient_texts` `merged_into_id` self-references, `books.publisher_id` *and* `books.reprint_publisher_id` both into `publishers`) must exist before `books`; `books` before `book_authors`/`essays`; `essays` before `essay_authors` and before the polymorphic `(book_id XOR essay_id)` children (`scripture_references`, `book_topics`, `book_bible_coverage`, `book_ancient_coverage`).
- **Trigger interaction.** Library tables carry `compute_verse_abs`, denorm-refresh, and audit triggers. A data-only restore into a migration-built schema **must** use `--disable-triggers` (superuser) or the denorm/audit triggers will fire mid-load — slow at best, error-prone at worst (e.g. `library_refresh_book_list_denorm` reading `book_authors` before it's loaded is harmless but wasteful; audit triggers would write thousands of bogus `audit_log` rows).
- **Sequences:** none — library PKs are all UUID. Only invoicing's `invoice_number_seq` matters, and it self-heals (§2).
- **Volume:** 1,381 books / 1,513 book_authors / 942 people / 555 scripture_references — enough that a restore actually proves something, unlike 2 clients.

The good news: because the dumps are `-F c` with schema included, the *realistic* production restore ("scratch/replacement project, restore both archives") lets `pg_restore` create tables and apply FK constraints *after* data — ordering mostly solves itself in that mode. The fragile mode is data-only restore into a schema built from `supabase/migrations/` (the mode you'd use to restore into a fresh Supabase project that already ran migrations), and that is exactly the mode the smoke should rehearse. Recommendation in D4.

---

## 4. Supabase advisors vs the 040/052 baseline

Ran `get_advisors` (security + performance) against the linked prod project on 2026-07-06 evening.

### Security — one new finding, rest matches baseline

| Lint | Count | vs baseline | Assessment |
|---|---|---|---|
| `anon_security_definer_function_executable` — `library_refresh_book_list_denorm(p_book_id uuid)` and `library_refresh_book_list_denorm_trigger()` | 2 | **NEW** (WARN) | Both created in `20260603160000_books_list_denorm_search.sql` (2026-06-03) — *after* the 2026-05-28 hardening in 040 — and the migration contains no `REVOKE`. Anon can invoke `/rest/v1/rpc/library_refresh_book_list_denorm` and force denorm recomputes on arbitrary book UUIDs (write-side nuisance/DoS surface, no data exposure). Same fix pattern as `20260528150000`: `REVOKE EXECUTE … FROM PUBLIC, anon; GRANT … TO authenticated`. See D5. |
| `authenticated_security_definer_function_executable` | 12 | Accepted per 040 (10 documented + the same 2 new denorm functions) | The 10 known functions match 040's accepted list exactly. The 2 denorm rows will remain (trigger needs `authenticated` EXECUTE) — add them to 040's documented-accepted table when D5 ships. |
| `auth_leaked_password_protection` | 1 (WARN) | Waived in 040 (Free plan) | Still present. **If** the project has since upgraded to Pro (see the PLAN.md contradiction, D1), this becomes actionable — it's a Dashboard toggle. |
| `rls_enabled_no_policy` — `library_ocr_usage` | 1 (INFO) | Known-intentional | Service-role-only counter; zero policies = fail-closed by design (documented in `db-changes.mdc`). |

Cleared items from 040 (`function_search_path_mutable`, `extension_in_public`, old anon rows) remain cleared. The 052 storage/publishers regate raised no new lint.

### Performance — no resilience blockers, all INFO/WARN volume

| Lint | Count | Note |
|---|---|---|
| `multiple_permissive_policies` | 240 (WARN) | The owner-policy + viewer-policy split on every module table, times each role/action combo. Known architecture trade-off; harmless at 1-user scale. Fold into a future perf pass only if `Server-Timing: db` budgets regress. |
| `unindexed_foreign_keys` | 32 (INFO) | Mostly `created_by` FKs, plus a few real ones (`invoices_client_id`, `invoice_line_items_invoice_id`, `book_ancient_coverage_book_id`, `essays_parent_book_id`, `client_rates_client_id`). Mildly contradicts the `db-changes.mdc` "index every FK" checklist; irrelevant at current row counts. Optional batch-index migration someday. |
| `auth_rls_initplan` | 4 (WARN) | `profiles`, `user_permissions`, `module_registry`, `books` policies re-evaluate `auth.*()` per row (the pre-helper policies). `books` at 1,381 rows is the only one that could ever matter. Optional `(select auth.uid())` rewrite. |
| `unused_index` | 10 (INFO) | Expected at low traffic (merge indexes, `search_vector` GIN, projects indexes). No action. |

---

## 5. Endless nav skeleton (061 open question) — code-level hypothesis

Evidence chain:

```53:53:src/routes/+layout.svelte
	const showNavSkeleton = $derived(navTarget != null && !isLogin);
```

The skeleton renders in place of `children()` for the entire time SvelteKit's `navigating.to` is non-null. Nothing bounds how long that is.

```17:23:src/service-worker.ts
registerRoute(
	new NavigationRoute(
		new NetworkOnly({
			networkTimeoutSeconds: 10
		})
	)
);
```

The 10s timeout + `setCatchHandler → offline.html` **only applies to `mode: 'navigate'` requests, i.e. full document loads** (cold start, hard reload). A client-side SvelteKit navigation — which is what tapping a tab in the running PWA does — issues a `fetch` for `/settings/library/__data.json?...`. That request:

- is not matched by `NavigationRoute` (wrong mode),
- is not matched by the vocab SWR route (`LIBRARY_VOCAB_CACHE_PATHS` doesn't include `__data.json` paths),
- therefore passes through the service worker with **no strategy, no timeout, no catch handler**,
- and SvelteKit itself applies **no timeout** to data-request fetches.

**Hypothesis:** on iOS standalone PWA, resuming the app (or navigating on a half-dead connection) can leave that `__data.json` fetch hung indefinitely — iOS is known to freeze in-flight sockets across background/foreground transitions without erroring them. `navigating.to` stays set, the root layout shows `<NavModuleSkeleton>` forever, and the offline fallback never triggers because no document navigation ever failed. This cleanly explains why 061's SW fix (which addressed document navigations) may not fully cure it, and why `/settings/library` — typically reached by in-app tab navigation, never by cold start — is where it shows.

Secondary suspects, considered less likely: `/settings/library/+layout.server.ts` runs a `profiles` query per navigation (server-side; would surface as a slow-but-finite response, not an infinite hang); a `beforeNavigate`-cancel loop from dirty-form guards (none are mounted on the settings-library path).

**What would fix it (future session, not tonight):** a navigation watchdog in the root layout — when `navigating.to` has been set for >10–15s, surface a "Still loading — tap to retry" affordance that does `window.location.assign(navTarget.url)` (a *document* navigation, which the SW timeout+offline fallback *does* protect). **Phone repro remains an owner task:** capture Safari remote inspector on `/settings/library` while the skeleton is stuck, per 061, to confirm the hung request is the `__data.json` fetch.

---

## OWNER RUNBOOK — backup pipeline

State as of 2026-07-09 ([079](../decisions/079-ops-hardening-backups-restore-revoke.md)): **steps 1–5 DONE** — secrets set, first R2 upload green (2026-07-06), weekly cron + profiles/projects dumps shipped, restore-smoke proven green. Steps 1–4 kept as rebuild-from-zero reference.

### 1. Create the R2 bucket (Cloudflare dashboard) — ✅ done

1. Cloudflare dashboard → **R2 Object Storage** → **Create bucket**. Name it (e.g. `ppp-backups`), location Automatic. **Do not** enable public access — the repo is public; dumps must stay private.
2. R2 → **API Tokens** (Manage API tokens) → **Create API Token** → permission **Object Read & Write**, scoped to that bucket only. Copy the **Access Key ID** (32 chars) and **Secret Access Key** (64 chars) — shown once.
3. Note the S3 endpoint from the bucket details: `https://<accountid>.r2.cloudflarestorage.com` (base URL only, **no** `/bucket-name` suffix).

### 2. Set the five GitHub secrets — ✅ done (2026-07-06)

```bash
# Session Pooler URI derived from the Direct URI in .env.local (probes aws-{0..3}-<region>;
# ppp-prod is on aws-1-us-east-2). Pipes straight into the secret:
npx dotenv -e .env.local -e .env -- npx tsx scripts/backup-restore-verify/derive-pooler-url.ts | gh secret set BACKUP_DATABASE_URL

gh secret set R2_ENDPOINT          # https://<accountid>.r2.cloudflarestorage.com
gh secret set R2_BUCKET            # ppp-backups (or chosen name)
gh secret set R2_ACCESS_KEY_ID     # the 32-char Access Key ID
gh secret set R2_SECRET_ACCESS_KEY # the 64-char Secret Access Key
```

### 3. Trigger the workflow — ✅ done (run 28830982000)

Actions → **Monthly database backup** → **Run workflow** on `main`, or:

```bash
gh workflow run backup.yml --ref main
gh run watch "$(gh run list --workflow=backup.yml --limit 1 --json databaseId -q '.[0].databaseId')"
```

Never **Re-run** an old failed run — it replays the stale workflow YAML from that commit (this bit the pg_dump-16 iteration on 2026-07-06).

### 4. Verify objects in R2 — ✅ done

Cloudflare dashboard → R2 → bucket → confirm `2026/ppp-invoicing-2026-07.dump` and `2026/ppp-library-2026-07.dump`. (Run-log evidence: 32.7 KiB and 385.5 KiB uploaded 23:44 UTC.) Or with any S3 client using the same keys:

```bash
AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… aws s3 ls "s3://<bucket>/2026/" --endpoint-url "https://<accountid>.r2.cloudflarestorage.com"
```

### 5. Local restore smoke — ✅ done ([079](../decisions/079-ops-hardening-backups-restore-revoke.md))

```bash
# Requires Docker Desktop running. Uses BACKUP_DATABASE_URL or LIBRARY_DST_DATABASE_URL from .env.local:
npx dotenv -e .env.local -- bash scripts/backup-restore-verify/restore-smoke.sh
```

Rewritten in 079: pre-data + data restore (post-data skipped); auto-derives Session Pooler when Direct URI is set; asserts invoicing + library row counts. Proven green 2026-07-09 (2 clients / 1 profile; 1379 books / 1509 book_authors / 555 scripture_references). Current docs: [`scripts/backup-restore-verify/README.md`](../../scripts/backup-restore-verify/README.md).

### 6. Known failure modes (from scripts/backup-restore-verify/README.md + the 2026-07-06 run history)

| Symptom | Cause | Fix |
|---|---|---|
| `connection to server at "db.<ref>.supabase.co" (2600:…) Network is unreachable` | `BACKUP_DATABASE_URL` is the **Direct** URI — IPv6-only; GitHub runners are IPv4-only. The workflow now pre-flights and refuses it. | Session Pooler URI, port 5432, user `postgres.<ref>` (step 2 derive command). |
| `Tenant or user not found` | Wrong pooler cluster — host is not always `aws-0-<region>`; ppp-prod is `aws-1-us-east-2`. | Copy host from Dashboard → Connect → Session pooler, or use `derive-pooler-url.ts` (probes aws-0..3). |
| pg_dump refuses / port 6543 in URI | Transaction pooler — doesn't support `pg_dump`. The workflow pre-flights this too. | Session pooler, port **5432**. |
| `Credential access key has length 64, should be 32` | Secret Access Key pasted into `R2_ACCESS_KEY_ID` (this exact failure happened 2026-07-06 23:17). | 32-char → `R2_ACCESS_KEY_ID`, 64-char → `R2_SECRET_ACCESS_KEY`. |
| `Credential access key has length 34, should be 32` | Account ID or other value pasted as the access key. | Re-copy from R2 → API Tokens. |
| Upload 4xx with correct keys | `R2_ENDPOINT` has a `/bucket-name` suffix. | Base URL only. |
| `server version: 17.x; pg_dump version: 16.x` | Runner PATH still has apt's v16 client. Workflow now installs PGDG 17 and calls `/usr/lib/postgresql/17/bin/pg_dump` explicitly. | Only reappears if the workflow YAML regresses — and only via **Run workflow** on `main`, never Re-run of old runs. |

---

## Proposed decisions (multiple choice for Parker)

**All answered in [066](../decisions/066-operational-resilience-review.md); Q10–Q13 shipped in [079](../decisions/079-ops-hardening-backups-restore-revoke.md); Q14 nav watchdog in [072](../decisions/072-pwa-cold-start-resilience.md).** Historical options below kept for the review trail.

**D1 — Supabase plan tier / platform backups.** PLAN.md § Data safety says "beyond Supabase Pro's 7-day daily backups"; decision 040 (2026-05-28) says the project is on the **Free plan** (leaked-password protection waived as Pro-only, and that WARN is still firing). Which is true?
- **(a)** On Pro → platform daily backups exist; R2 is belt-and-suspenders as PLAN.md claims. Also flip on leaked-password protection (Dashboard toggle) and retire the 040 waiver.
- **(b)** On Free → **R2 monthly is the only backup**; fix the PLAN.md line, and consider bumping cron to weekly (`0 8 * * 1`) since RPO is otherwise up to a month. ← **check Dashboard → Billing first; if Free, my recommendation is (b) with weekly cron** — the dumps are sub-MB, R2 cost is nil.

**D2 — Add projects tables to the backup?** 24 projects + 120 weekly check-ins currently unprotected.
- **(a)** Add `projects project_updates project_tasks project_links` as a third `ppp-projects-YYYY-MM.dump` in `backup.yml`. ← **recommended** (4 lines in the workflow; keeps per-module restore story clean)
- **(b)** Append them to the library dump (fewer files, muddier module boundaries).
- **(c)** Keep deferring (accept losing check-in history).

**D3 — Include `profiles` in a dump?** Restore currently depends on live prod for the FK-parent row.
- **(a)** Add `profiles` to the invoicing dump's `-t` list (1 row; every module's restore needs it). ← **recommended**
- **(b)** Separate `ppp-core` dump with `profiles` (+ `user_permissions` when viewers exist).
- **(c)** Status quo — document the owner UUID somewhere safe and hand-craft the row on restore.

**D4 — Restore smoke scope?** The script is broken as written (§3a) and covers invoicing only (§3b).
- **(a)** One session: fix the `--where` bug + profiles-load approach, keep invoicing-only. Minimum viable.
- **(b)** Fix + extend to a **library restore smoke**: migrations-built scratch schema (schema from repo, not from dump), `pg_restore --data-only --disable-triggers` of the real R2 library dump, assert `books`/`book_authors`/`scripture_references` counts > 0. ← **recommended** — library is the irreplaceable dataset (1,381 hand-entered books), and this rehearses the actual DR mode
- **(c)** Also add a quarterly calendar reminder to re-run it against the latest R2 object.

**D5 — Advisor follow-up migration?** Two anon-executable SECURITY DEFINER functions from `20260603160000` (post-040 regression of a known pattern).
- **(a)** Ship `REVOKE EXECUTE … FROM PUBLIC; GRANT … TO authenticated` for `library_refresh_book_list_denorm(uuid)` + `library_refresh_book_list_denorm_trigger()`, mirroring `20260528150000`, and add both to 040's accepted-`authenticated` table. ← **recommended** (10-minute migration; also add "new SECURITY DEFINER fn ⇒ REVOKE PUBLIC" to the db-changes checklist so this stops recurring)
- **(b)** Accept the WARN (anon can only trigger recomputes, not read data).

**D6 — Nav-skeleton watchdog?** (§5 — separate from the backup mission but filed while fresh.)
- **(a)** Owner phone repro first (Safari remote inspector on `/settings/library` per 061), then decide. ← **recommended sequencing**
- **(b)** Build the >10s "Still loading — retry" watchdog in the root layout now; it's a safe UX net regardless of root cause.

---

*Per workflow.mdc, this review should land as a decision-log entry + PLAN.md refresh; tonight's guardrails allowed exactly this one file, so filing `docs/decisions/NNN-operational-resilience-review.md` (next free number) and updating PLAN.md › Next up item 7 (which still says "set GitHub secrets + R2 bucket" — now done) is carried forward to the next session.*
