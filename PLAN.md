# PLAN.md — Parker's Platform (ppp)

**Last updated:** 2026-05-04
**How to use this file:**
- Cursor reads it automatically.
- For the Claude.ai "Parker's Platform" project, paste the contents of this file at the start of any session that needs current state.
- At the end of every session in either tool, update this file before stopping.

---

## Current focus

Pre-trip Library: Session 7 (settings polish) shipped 2026-05-02. Trip QA runbook ready — [docs/library-trip-qa-runbook.md](docs/library-trip-qa-runbook.md) — owner completes phone + viewer smoke; tracker hands-on rows tick when verified. Trip-period (late May → early August) is mobile-only work against the traveling shelf — Pass 2 spreadsheet, OCR, citations pause until return.

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
| Library | [docs/POS_Library_Build_Tracker.md](docs/POS_Library_Build_Tracker.md) | 🟢 Pre-trip arc complete through Session 7 (2026-05-02). Trip-period mobile work next. Post-trip: Session 9 → Session 8. |

Operating guide: [AGENTS.md](AGENTS.md). Cursor rules: [.cursor/rules/](.cursor/rules/). Full decision archive: [docs/decisions/](docs/decisions/).

---

## Recent decisions (last 3 — full archive in `docs/decisions/`)

- [014 — Library migrate env + handoff](docs/decisions/014-library-migrate-env-handoff.md) (2026-05-03) — Path B README/AGENTS; review queue kbd hints desktop-only; Supabase **source → destination** URIs; **Path B apply completed 2026-05-04** (see decision follow-up).
- [013 — Library Session 7b settings polish](docs/decisions/013-library-session-7b-settings-polish.md) (2026-05-02) — series + ancient-texts CRUD + merge, translator data migration, permissions UI + RLS.
- [012 — Library Session 7 people merge](docs/decisions/012-library-session-7-people-settings-merge.md) (2026-05-02) — `library_merge_people` RPC; merge audit entries non-revertible.

---

## Session handoff (2026-05-04) — Path B migrate + trip QA

**Library Path B (source → destination)** — **Apply completed by owner** (synced elsewhere, 2026-05-04). Reference flow remains in [scripts/library-migrate-local-to-prod/README.md](scripts/library-migrate-local-to-prod/README.md). Scripture **`library-scripture-images` bucket objects** are still not copied by Path B; re-upload or sync objects if thumbnails matter.

**Trip QA runbook:** [docs/library-trip-qa-runbook.md](docs/library-trip-qa-runbook.md) — owner executes phone smoke + viewer smoke, then ticks tracker acceptance rows.

**Repo gate:** `npm run check` passed (2026-05-04).

**Phone smoke (owner):** `/library` filters at scale, `/library/search-passage` (e.g. Phil 2:5), `/library/review` drill, `/library/add` barcode path — tracker Session 3–6 acceptance (steps in runbook §A).

**Viewer smoke (owner):** seed viewer + `user_permissions`; confirm merge/ancient/permissions 403s per [013](docs/decisions/013-library-session-7b-settings-polish.md) (runbook §B).

---

## Next up

1. **Trip-period mobile workflow validation** — execute [docs/library-trip-qa-runbook.md](docs/library-trip-qa-runbook.md) §A on a real phone before 2026-05-21; tick tracker Session 3–6 / 5.5 hands-on rows when done.
2. **Invoicing go-live blocker:** purchase domain → verify in Resend → update `send-invoice` `from` address → smoke test on a real client.
3. **Carry-forward from Session 7:** run [runbook](docs/library-trip-qa-runbook.md) §B (viewer) — cannot merge people, cannot CRUD/merge `ancient_texts` in settings, `/settings/permissions` returns 403; tick Session 7 viewer acceptance + deferred Session 1–6 viewer rows when done.
4. **Pre-Session-8 prep (queue for August):**
   - Resolve Open Q4 — bibliography export format.
   - Load Turabian skill (`SKILL.md` + `formats.md`) into build context.
   - Author v2 corrected scholarly-core spreadsheet by early August (Open Q8) so Pass 2 can run before Session 9.
5. **Pre-Session-9 prep (queue for August):** decide OCR provider (Open Q7) — Tesseract vs external API (Vision / Textract / Anthropic).
6. **Invoicing maintenance:** rotate Supabase JWT secret + Resend API key when a deploy window opens (runbook in [docs/Supabase_deployment_and_go_live.md](docs/Supabase_deployment_and_go_live.md)).

---

## Cross-module open questions

Only items that could block a future session. Full lists live in each tracker's Open Questions table.

- **Invoicing:** domain + Resend verification before real-client billing.
- **Library Q4:** bibliography export format — blocks Session 8 start.
- **Library Q7:** OCR provider choice — blocks Session 9 start.
- **Library Q8:** v2 corrected scholarly-core spreadsheet — must land before Pass 2 / Session 9.
- **Library pre-session checklist:** scholarly core review in Claude; deferred shelf-check items (Calvin CC vols 2–3, Bruce NICNT Acts edition, Hodge 1 Cor reprint, Douglas *NBD* edition); BDAG migration row; `enrich_library.py` run.

---

## Working agreement

- One-page rolling dashboard. Anything more than ~5 lines belongs in a tracker or decision record, not here.
- Every meaningful change ends with: update this file → commit → push.
- New session = new `docs/decisions/NNN-<slug>.md` filed; "Recent decisions" above gets the new entry, oldest drops off.
