# PLAN.md — Parker's Platform (ppp)

**Last updated:** 2026-05-05 — PLAN refresh; hosted-only Supabase workflow encoded in [AGENTS.md](AGENTS.md), [.cursor/rules/always.mdc](.cursor/rules/always.mdc), [.cursor/rules/db-changes.mdc](.cursor/rules/db-changes.mdc) (see [supabase/README.md](supabase/README.md)). Session 9 OCR spike (015) unchanged as primary library build thread.
**How to use this file:**
- Cursor reads it automatically.
- For the Claude.ai "Parker's Platform" project, paste the contents of this file at the start of any session that needs current state.
- At the end of every session in either tool, update this file before stopping.

---

## Current focus

**Library — Session 9 (post-spike):** decision **[015](docs/decisions/015-library-session-9-ocr-kickoff.md)** shipped stub **`ocr_scripture_refs`**, **`extractScriptureRefs`** action, batch **Extract from image**, **`confidence_score`** on batch save. **Next build steps:** `npm run supabase:deploy-functions` (deploy OCR function when ready), then wire Anthropic/provider per 015; smoke-test page photos.

**Trip QA (owner, pre–2026-05-21):** [docs/library-trip-qa-runbook.md](docs/library-trip-qa-runbook.md) §A phone + §B viewer — tick tracker hands-on rows when done.

**Ops workflow:** Migrations and Edge deploys target the **single hosted** project (`npm run supabase:db:push`, `npm run supabase:deploy-functions`); **do not** use local Docker / `supabase start` for this repo — spelled out in AGENTS session template + always-on rules.

Trip-period (late May → early August): mobile shelf workflow; Pass 2 spreadsheet + Turabian pause until return (OCR continuation can ship whenever deploy window allows).

Nearest hard dates:
- **2026-05-15** — semester ends
- **2026-05-21** — move to Madison; trip-period workflow begins (limited-shelf, mobile-only)
- **2026-08** — return; post-trip arc starts (Session 9 OCR → Session 8 Turabian)
- **2026-09** — fall-semester-ready citations

---

## Active modules

| Module | Tracker | State |
|---|---|---|
| Invoicing | [docs/POS_Invoicing_Build_Tracker.md](docs/POS_Invoicing_Build_Tracker.md) | ✅ Code complete (Sessions 1–6). **Not yet billing real clients** — blocked on domain purchase + Resend domain verification. See [Sender onboarding](docs/POS_Invoicing_Build_Tracker.md#sender-onboarding-resend--before-billing-real-clients). |
| Library | [docs/POS_Library_Build_Tracker.md](docs/POS_Library_Build_Tracker.md) | 🟢 Pre-trip arc complete through Session 7. **Session 9 OCR** spike shipped (015); continuation = deploy function + provider wiring. Post-trip order remains finish Session 9 → **Session 8** Turabian. |

Operating guide: [AGENTS.md](AGENTS.md). Cursor rules: [.cursor/rules/](.cursor/rules/). Full decision archive: [docs/decisions/](docs/decisions/).

---

## Recent decisions (last 3 — full archive in `docs/decisions/`)

- [015 — Library Session 9 OCR kickoff](docs/decisions/015-library-session-9-ocr-kickoff.md) (2026-05-04) — Open Q7 closed (Anthropic MVP default); Edge stub `ocr_scripture_refs`; extract action + batch UI hook; `confidence_score` in batch JSON.
- [014 — Library migrate env + handoff](docs/decisions/014-library-migrate-env-handoff.md) (2026-05-03) — Path B README/AGENTS; review queue kbd hints desktop-only; Supabase **source → destination** URIs; **Path B apply completed 2026-05-04** (see decision follow-up).
- [013 — Library Session 7b settings polish](docs/decisions/013-library-session-7b-settings-polish.md) (2026-05-02) — series + ancient-texts CRUD + merge, translator data migration, permissions UI + RLS.

---

## Session handoff

**Library Path B (source → destination)** — **Apply completed by owner** (2026-05-04). Reference flow: [scripts/library-migrate-local-to-prod/README.md](scripts/library-migrate-local-to-prod/README.md). Scripture **`library-scripture-images` bucket objects** are still not copied by Path B; re-upload or sync objects if thumbnails matter.

**Trip QA runbook:** [docs/library-trip-qa-runbook.md](docs/library-trip-qa-runbook.md) — owner executes phone smoke + viewer smoke, then ticks tracker acceptance rows.

**Supabase workflow (repo convention):** Hosted `db push` / `deploy-functions` only — [supabase/README.md](supabase/README.md); also [AGENTS.md](AGENTS.md) Scripts + session template + [.cursor/rules/always.mdc](.cursor/rules/always.mdc).

**Repo gate:** `npm run check` last verified 2026-05-04 (Session 9 spike + follow-on docs); re-run after substantive code changes.

**Phone smoke (owner):** `/library` filters at scale, `/library/search-passage` (e.g. Phil 2:5), `/library/review` drill, `/library/add` barcode path — tracker Session 3–6 acceptance (steps in runbook §A).

**Viewer smoke (owner):** seed viewer + `user_permissions`; confirm merge/ancient/permissions 403s per [013](docs/decisions/013-library-session-7b-settings-polish.md) (runbook §B).

---

## Next up

1. **Trip-period mobile workflow validation** — [docs/library-trip-qa-runbook.md](docs/library-trip-qa-runbook.md) §A on a real phone before **2026-05-21**; tick tracker Session 3–6 / 5.5 hands-on rows when done.
2. **Session 9 (OCR) continuation (build):** `npm run supabase:deploy-functions` → deploy **`ocr_scripture_refs`**; wire Anthropic (or chosen provider) per [015](docs/decisions/015-library-session-9-ocr-kickoff.md); smoke-test ~5 page images; extend tracker Session 9 acceptance as completed.
3. **Carry-forward — viewer smoke:** [runbook](docs/library-trip-qa-runbook.md) §B — merge/ancient/permissions 403s; tick Session 7 viewer acceptance + deferred Session 1–6 viewer rows when done.
4. **Invoicing go-live blocker:** domain → Resend verify → `send-invoice` `from` → real-client smoke.
5. **Pre-Session-8 prep (August queue):** Open Q4 bibliography format; Turabian skill in context; v2 spreadsheet by early August (Open Q8) before Pass 2.
6. **Invoicing maintenance:** rotate Supabase JWT secret + Resend API key when a deploy window opens ([docs/Supabase_deployment_and_go_live.md](docs/Supabase_deployment_and_go_live.md)).

---

## Cross-module open questions

Only items that could block a future session. Full lists live in each tracker's Open Questions table.

- **Invoicing:** domain + Resend verification before real-client billing.
- **Library Q4:** bibliography export format — blocks Session 8 start.
- **Library Q7:** ~~OCR provider choice~~ — resolved (015); provider **integration** remains Session 9 continuation work.
- **Library Q8:** v2 corrected scholarly-core spreadsheet — must land before Pass 2 (post-trip).
- **Library pre-session checklist:** scholarly core review in Claude; deferred shelf-check items (Calvin CC vols 2–3, Bruce NICNT Acts edition, Hodge 1 Cor reprint, Douglas *NBD* edition); BDAG migration row; `enrich_library.py` run.

---

## Working agreement

- One-page rolling dashboard. Anything more than ~5 lines belongs in a tracker or decision record, not here.
- Every meaningful change ends with: update this file → commit → push.
- New session = new `docs/decisions/NNN-<slug>.md` filed; "Recent decisions" above gets the new entry, oldest drops off.
