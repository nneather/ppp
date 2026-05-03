# PLAN.md — Parker's Platform (ppp)

**Last updated:** 2026-05-03
**How to use this file:**
- Cursor reads it automatically.
- For the Claude.ai "Parker's Platform" project, paste the contents of this file at the start of any session that needs current state.
- At the end of every session in either tool, update this file before stopping.

---

## Current focus

Pre-trip Library work wrapping. Session 7 (settings polish: people merge, ancient texts CRUD, permissions UI) shipped today, hitting the "sermon-prep-ready" target. Trip-period (late May → early August) is mobile-only work against the ~100 scholarly-core books traveling with Parker — full-library work (Pass 2 spreadsheet, OCR, citations) pauses until return.

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

- [014 — Library migrate env + handoff](docs/decisions/014-library-migrate-env-handoff.md) (2026-05-03) — Path B README/AGENTS env table; review queue kbd hints desktop-only; Path B framed as Supabase Dashboard **source → destination** Postgres URIs (no Docker Desktop assumed).
- [013 — Library Session 7b settings polish](docs/decisions/013-library-session-7b-settings-polish.md) (2026-05-02) — series + ancient-texts CRUD + merge, translator data migration, permissions UI + RLS.
- [012 — Library Session 7 people merge](docs/decisions/012-library-session-7-people-settings-merge.md) (2026-05-02) — `library_merge_people` RPC; merge audit entries non-revertible.

---

## Session handoff (2026-05-03) — Path B migrate + trip QA

**Library Path B (source → destination)** — `.env.local` must define `LIBRARY_SRC_DATABASE_URL` and `LIBRARY_DST_DATABASE_URL` (see [scripts/library-migrate-local-to-prod/README.md](scripts/library-migrate-local-to-prod/README.md)). Use Supabase Dashboard → **Connect → Direct** for **both** ends: the project or **branch** that holds the corpus (SRC) and the target project, usually prod (DST). Run `npm run library:migrate:dry`, then `LIBRARY_MIGRATE_CONFIRM=yes npm run library:migrate:apply` when the destination has **zero** active `books` (or add `--allow-non-empty-dst` via the full `npx dotenv … tsx` command). Scripture **bucket objects** are not copied by the script.

**Phone smoke (owner):** `/library` filters at scale, `/library/search-passage` (e.g. Phil 2:5), `/library/review` drill, `/library/add` barcode path — tracker Session 3–6 acceptance.

**Viewer smoke (owner):** seed viewer + `user_permissions`; confirm merge/ancient/permissions 403s per [013](docs/decisions/013-library-session-7b-settings-polish.md).

---

## Next up

1. **Complete Path B apply** — set SRC/DST to Dashboard Postgres URIs → `npm run library:migrate:dry` → `LIBRARY_MIGRATE_CONFIRM=yes npm run library:migrate:apply` when destination preconditions met (see README).
2. **Trip-period mobile workflow validation** — confirm review queue + reading-status updates + scripture-reference entry feel friction-free on phone before 2026-05-21.
3. **Invoicing go-live blocker:** purchase domain → verify in Resend → update `send-invoice` `from` address → smoke test on a real client.
4. **Carry-forward from Session 7:** hands-on viewer smoke test (acceptance item still ☐) — viewer cannot merge people, cannot CRUD ancient_texts, cannot reach `/settings/permissions`.
5. **Pre-Session-8 prep (queue for August):**
   - Resolve Open Q4 — bibliography export format.
   - Load Turabian skill (`SKILL.md` + `formats.md`) into build context.
   - Author v2 corrected scholarly-core spreadsheet by early August (Open Q8) so Pass 2 can run before Session 9.
6. **Pre-Session-9 prep (queue for August):** decide OCR provider (Open Q7) — Tesseract vs external API (Vision / Textract / Anthropic).
7. **Invoicing maintenance:** rotate Supabase JWT secret + Resend API key when a deploy window opens (runbook in [docs/Supabase_deployment_and_go_live.md](docs/Supabase_deployment_and_go_live.md)).

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
