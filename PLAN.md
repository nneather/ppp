# PLAN.md — Parker's Platform (ppp)

**Last updated:** 2026-05-19 — **Library PM review** ([033](docs/decisions/033-library-pm-review-may-2026.md)): mobile polish, citation short-form + `s.v.`, OCR Edge hardening, `ship-library` script.
**How to use this file:**
- Cursor reads it automatically.
- For the Claude.ai "Parker's Platform" project, paste the contents of this file at the start of any session that needs current state.
- At the end of every session in either tool, update this file before stopping.

---

## Current focus

**Library — PM review shipped (2026-05-19):** see **[033](docs/decisions/033-library-pm-review-may-2026.md)** — mobile save bar + list chrome; Turabian short-form / structured names / `s.v.` wedge; OCR authz + daily cap; `npm run ship-library:apply` before prod schema drift.

**Owner next:** phone smoke on scripture batch save bar + list ⋯ menu ([runbook](docs/library-trip-qa-runbook.md) §A); confirm Edge secrets `SITE_URL` (and `ANTHROPIC_API_KEY`) on hosted project if OCR CORS fails.

Nearest hard dates:
- **2026-05-21** — move to Madison; trip-period workflow (mobile-first)
- **2026-08** — return; shelf-bound QA + Wave 2 megacomponent split
- **2026-09** — fall-semester-ready citations

---

## Active modules

| Module | Tracker | State |
|---|---|---|
| Invoicing | [docs/POS_Invoicing_Build_Tracker.md](docs/POS_Invoicing_Build_Tracker.md) | ✅ Code complete (Sessions 1–6). |
| Library | [docs/POS_Library_Build_Tracker.md](docs/POS_Library_Build_Tracker.md) | 🟢 **033** mobile + citations + process. **Wave 2 (Aug):** owner smokes, Turabian 20-row QA, megacomponent split, essays Q5. |

Operating guide: [AGENTS.md](AGENTS.md). Cursor rules: [.cursor/rules/](.cursor/rules/). Full decision archive: [docs/decisions/](docs/decisions/).

---

## Recent decisions (last 3 — full archive in `docs/decisions/`)

- [033 — Library PM review (May 2026)](docs/decisions/033-library-pm-review-may-2026.md) (2026-05-19) — mobile chrome, citation short-form + `s.v.`, OCR hardening, `ship-library`, process skills/hooks.
- [032 — Edited works + citation accuracy](docs/decisions/032-edited-works-and-citation-accuracy.md) (2026-05-19) — `work_type`; Turabian dispatch fixes; 24 citation tests.
- [031 — Library Session 8 Turabian + review queue](docs/decisions/031-library-session-8-turabian.md) (2026-05-18) — `turabian/` module; bibliography builder; Turabian-first `/library/review`.

---

## Session handoff

**Trip QA runbook:** [docs/library-trip-qa-runbook.md](docs/library-trip-qa-runbook.md)

**Supabase workflow:** Hosted `db push` / `deploy-functions` only — [supabase/README.md](supabase/README.md). Prefer **`npm run ship-library:apply`** for library schema + types + tests + functions.

**Repo gate:** `npm run check` + `npm run test` verified **2026-05-19** (033).

---

## Next up

1. Owner: phone smoke + OCR PDF matrix (030) — schema/functions shipped 2026-05-19 (`work_type`, `library_ocr_usage`, `ocr_scripture_refs`).
2. August Wave 2 (tracker): Turabian 20-row QA, megacomponent extraction, essays UI decision (Q5).
3. Invoicing: first real-client send cadence (owner-driven).
