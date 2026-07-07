# 066 — Operational resilience review (backups, restore, advisors, nav skeleton)

**Date:** 2026-07-07 (overnight run 2026-07-06 evening; answers recorded 2026-07-07)
**Module:** cross-module (ops)
**Tracker session:** Ad-hoc — overnight background agent, decision-first review

## Built

- Overnight desk review (read-only `gh`, Supabase `get_advisors`, repo): [docs/reviews/2026-07-07-operational-resilience.md](../reviews/2026-07-07-operational-resilience.md) — live pipeline status, table-list drift, restore desk-check, advisor diff vs 040/052, nav-skeleton hypothesis, owner runbook.
- Headline verdict: **backups are live; restore is unproven and the smoke script is guaranteed to fail as written.** Run 28830982000 (2026-07-06 23:43 UTC) uploaded `2026/ppp-invoicing-2026-07.dump` (32.7 KiB) + `2026/ppp-library-2026-07.dump` (385.5 KiB) to R2; all five secrets set same day. But `restore-smoke.sh` line 75 uses `pg_dump --where` (does not exist in PostgreSQL 17), and the schema-only `profiles` load trips on `auth.users` FK / triggers / RLS under `ON_ERROR_STOP=1`. Never executed.

## Decided (Parker's answers, Q10–Q14)

- **Q10 — Backup coverage: add both** — third `ppp-projects-YYYY-MM.dump` (`projects project_updates project_tasks project_links`; 120 check-ins currently unprotected) **and** `profiles` in the invoicing dump (restore currently depends on live prod for the FK-parent row). Rejected: append to library dump; keep deferring.
- **Q11 — Supabase plan: Free confirmed.** R2 is the **only** backup → fix the PLAN.md "Pro 7-day backups" line (done this session) and **bump the cron to weekly** (`0 8 * * 1`; dumps are sub-MB). Leaked-password-protection WARN remains waived (Pro-only), 040 waiver stands.
- **Q12 — Restore smoke: fix + extend to library** — repair the `--where` bug + profiles-load approach, then a library-scale data-only rehearsal (migrations-built scratch schema, `pg_restore --data-only --disable-triggers` of the real R2 library dump, assert `books`/`book_authors`/`scripture_references` counts). Library is the irreplaceable dataset (1,381 hand-entered books).
- **Q13 — Advisor WARN: ship the REVOKE migration** for `library_refresh_book_list_denorm(uuid)` + `library_refresh_book_list_denorm_trigger()` (anon-executable SECURITY DEFINER from `20260603160000`, post-040 regression), mirroring `20260528150000`; add both to 040's accepted-`authenticated` table and add "new SECURITY DEFINER fn ⇒ REVOKE PUBLIC" to the db-changes checklist.
- **Q14 — Nav skeleton: both** — build the >10–15s "Still loading — tap to retry" watchdog in the root layout (retry as a *document* navigation so the SW timeout + offline fallback apply) **and** owner phone repro with Safari remote inspector to confirm the hung `__data.json` hypothesis.

All five land in one **ops hardening session** (prompt in PLAN.md).

## Schema changes

- None this session. The Q13 REVOKE migration ships in the ops hardening session.

## New components / patterns added

- Owner runbook (report §Runbook) — complete rebuild-from-zero backup-pipeline reference incl. the six known failure modes from the 2026-07-06 run history.

## Open questions surfaced

- Scheduled-run failure visibility: GitHub only emails the workflow-file author on cron failures — first unattended fire is 2026-08-01 (weekly once the cron change ships); check the Actions tab after.
- Quarterly restore re-run cadence — revisit after the first successful library restore smoke.

## Surprises (read these before the next session)

- PLAN.md's "Supabase Pro 7-day backups" claim contradicted 040's Free-plan record for over a month — the docs-trust failure mode from 051 again, this time on the DR posture.
- The backup pipeline went live the **same evening** the review ran to check why it was blocked — 055's follow-up closed it hours before the agent looked. Stale "Next up" items cost real review time.
- `pg_dump --where` looks plausible and does not exist — the restore script shipped in 055 was desk-written and never executed, which is exactly how restore paths rot.
- `-t` dumps exclude `invoice_number_seq` — benign only because `generate_invoice_number()` self-heals from `MAX(invoice_number)`; noted so nobody panics mid-restore.

## Carry-forward updates

- [x] components.mdc — no new components
- [x] AGENTS.md inventory — no new helpers
- [x] new env vars — none
- [x] PLAN.md refreshed (Data safety rewritten for Free plan + weekly cron + third dump; Next up #8 replaced; ops hardening prompt added)
