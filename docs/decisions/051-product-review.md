# 051 — Product review: security / usability / docs + remediation plan

**Date:** 2026-07-05
**Module:** cross-module (repo-wide)
**Tracker session:** Ad-hoc — product-lead review, then remediation Session R1 (docs trust) executed in the same chat

## Built

- Full three-track audit (security, usability, documentation/consistency) of the whole repo. **Zero critical security findings.** Recurring theme: **drift at the edges** — newer/older surfaces not brought up to standards the rest of the app already set.
- Remediation Session R1 (docs trust) shipped in this session: PLAN.md refreshed for 047b/048/049/050 + this review; AGENTS.md inventory caught up (13 library helpers, 3 projects helpers, invoicing helpers section, all 4 projects migrations, module-structure asymmetry note); README.md replaced (was default `sv` scaffold); `.env.example` added; `always.mdc` component-naming rule fixed to kebab-case; decision-log collision index added to `docs/decisions/README.md`; `components.mdc` gained `nav-module-skeleton` row + accurate `source-picker` flag wording; go-live doc deploy-functions list corrected (3 functions).
- New rule: [.cursor/rules/workflow.mdc](../../.cursor/rules/workflow.mdc) — session workflow + task-to-agent routing (see 'New components / patterns').

## Decided

- **Viewer role is real (~12 months)** — viewer-readiness findings stay in backlog (storage SELECT policy alignment, permission-aware nav, viewer onboarding, graceful 403s) rather than being cut as single-user-by-design.
- **Auth: migrate to `getClaims()`** — enable Supabase asymmetric JWT signing keys and replace the `getSession`-first trust in `src/lib/server/auth-session.ts` with local verification. Rejected alternative: per-request `getUser()` (violates the performance rule); rejected alternative: accept as-is (leaves revoked-token window).
- **CI: both** — GitHub Actions for `check` + `test` on push, plus the monthly two-file `pg_dump` backup Action already spec'd in PLAN.md › Data safety.
- **Invoicing: polish, not freeze** — half-session to retire `window.confirm`, add hotkeys to `/settings/invoicing`, migrate to `<PageHeader>`, fix inline-style FABs.
- **Decision numbering: freeze + index** — no renumbering (IDs live in commit messages); collision index in `docs/decisions/README.md`; check `ls | sort` for next free number; 051+ collision-free.
- **Component filenames are kebab-case** — `always.mdc` said PascalCase while 34/35 files are kebab-case; the rule was wrong, not the code.
- **Invoicing route-inline loaders/actions are intentional** — documented in AGENTS.md so agents stop scaffolding `src/lib/invoicing/server/`; new modules follow the library/projects extracted shape.

## Key findings carried into sessions R2–R5 (prompts in PLAN.md)

- **R2 security:** no CSP/security headers anywhere; invoicing Edge Functions use `Access-Control-Allow-Origin: *` (OCR already allowlists origins — copy that pattern); OCR daily rate limit fails **open** on `library_ocr_usage` read error; storage SELECT policy (`20260428200000`) still on `app_is_viewer_writer` while table SELECTs moved to `app_has_module_read` (`20260502160000`); `publishers_select` gates only on `auth.uid()`; `getClaims()` migration.
- **R3 UX safety:** `/login` is an unstyled scaffold with inline `style=` and unlabeled inputs; **no `+error.svelte` in the repo** (403/404 → default SvelteKit page); book delete has **no confirmation** (invoicing uses `window.confirm`, everything else `<ConfirmDialog>`); dashboard lacks a Projects/Tasks tile.
- **R4 invoicing polish:** as decided above; also narrow `formMessage` on `form.kind` on `/invoicing`.
- **R5 CI + backups:** as decided above.
- **Viewer backlog (no session scheduled):** permission-aware nav, viewer onboarding surface, shared `FlashToast` component (three hand-rolled toast implementations today), hotkey cheat-sheet dialog, sticky bulk-selection bar on `/library`, Publishers tab in library settings, bibliography entry point.

## Schema changes

- None this session. R2 will add policy-alignment migrations (storage SELECT, `publishers_select`).

## New components / patterns added

- `.cursor/rules/workflow.mdc` — how Parker works: chat-per-session, task-to-agent routing (explore subagents for audits, read-only review subagents for large diffs, background agents for parallel work), canvas for analytical artifacts, end-of-session gates.
- `.env.example` — prod CLI config placeholder + pointer to the AGENTS.md env table.
- Pattern: **review findings → locked decisions → session prompts in PLAN.md** — audits should end as copy-paste session prompts, not as a report that goes stale.

## Open questions surfaced

- None — the five open decisions from the review were resolved with Parker in-session (see Decided).

## Surprises (read these before the next session)

- The docs system's biggest risk is its own credibility: PLAN.md was a month stale and `always.mdc` contradicted the codebase on naming. Agents read these files as ground truth — the end-of-session carry-forward checklist exists but was skipped for the three ad-hoc sessions (047b/049/050 each left AGENTS/PLAN boxes unchecked).
- Decision `027` was never used — the gap is not a lost file.
- The security audit's storage-policy finding is a **drift** bug, not a design bug: read-only module access was added later (`20260502160000`) and the storage policy was never revisited.
- Repo gate re-verified 2026-07-05: `npm run test` green; `npm run check` still carries only the pre-existing `patch-sveltekit-pwa.ts` type error.

## Carry-forward updates

- [x] components.mdc updated (nav-module-skeleton row, source-picker wording)
- [x] AGENTS.md inventory updated (library/projects/invoicing helpers, migrations, module-structure note)
- [x] new env vars documented (none new; `.env.example` added)
- [x] PLAN.md refreshed (048–050 catch-up, R2–R5 session prompts, Next up)
