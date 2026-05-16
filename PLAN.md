# PLAN.md — Parker's Platform (ppp)

**Last updated:** 2026-05-16 — Library **mobile polish**: `<PageHeader>` + `pb-tabbar` / `bottom-tabbar` utilities; `/library` + `/library/books/[id]` headers, reading-status hoist, copy-for-drafts collapse on phone, scripture row touch targets, toast alignment. Decision **[023](docs/decisions/023-library-mobile-polish.md)**. (Earlier same day: taxonomy **[022](docs/decisions/022-library-category-removal.md)**.)
**How to use this file:**
- Cursor reads it automatically.
- For the Claude.ai "Parker's Platform" project, paste the contents of this file at the start of any session that needs current state.
- At the end of every session in either tool, update this file before stopping.

---

## Current focus

**Library — mobile polish (2026-05-16):** see **[023](docs/decisions/023-library-mobile-polish.md)** — `<PageHeader>` on `/library` + `/library/books/[id]`; `pb-tabbar` / `bottom-tabbar` utilities; mobile overflow sheets; reading-status hoist + collapsed copy panel on book detail; larger scripture-row hit targets.

**Library — taxonomy cleanup landed (2026-05-16):** see decision **[022](docs/decisions/022-library-category-removal.md)** — Category → Genre backfilled, `categories` / `book_categories` / `books.primary_category_id` dropped. Genre is now the sole content-type taxonomy; `books.shelving_location` (TEXT) remains the physical-location escape hatch.

**Library — Session 9 (trip-period continuation):** **[021](docs/decisions/021-library-session-9-ocr-anthropic-wired.md)** — **`ocr_scripture_refs`** Anthropic vision code **deployed 2026-05-16**; set **`ANTHROPIC_API_KEY`** (+ optional **`ANTHROPIC_OCR_MODEL`**) in Supabase secrets per [supabase/README.md](supabase/README.md) before first prod invoke; **`/library/review`** lists scripture refs with `needs_review`. **Owner next:** secrets if needed + **5-image smoke**.

**Trip QA (owner, pre–2026-05-21):** ✅ Step A owner phone smoke complete 2026-05-16; tracker rows ticked. Viewer smoke ([docs/library-trip-qa-runbook.md](docs/library-trip-qa-runbook.md) §B) remains deferred until a collaborator seed.

**Ops workflow:** Migrations and Edge deploys target the **single hosted** project (`npm run supabase:db:push`, `npm run supabase:deploy-functions`); **do not** use local Docker / `supabase start` for this repo — spelled out in AGENTS session template + always-on rules.

**Trip-period (late May → early August):** **Build continues** where it does not need an arbitrary physical book from the full ~1,288 (OCR, schema/UI/Edge, mobile polish, Session 8 pure-function Turabian prep). **Shelf-bound work is parked** until August: Session 4 Pass 2 `--apply`, review drill-down for books left in Madison, BDAG / Calvin CC vols 2–3 / Bruce NICNT Acts / Hodge 1 Cor / Douglas *NBD* shelf-checks.

Nearest hard dates:
- **2026-05-15** — semester ends
- **2026-05-21** — move to Madison; trip-period workflow begins (limited-shelf, mobile-first)
- **2026-08** — return; shelf-bound QA + Pass 2 window
- **2026-09** — fall-semester-ready citations

---

## Active modules

| Module | Tracker | State |
|---|---|---|
| Invoicing | [docs/POS_Invoicing_Build_Tracker.md](docs/POS_Invoicing_Build_Tracker.md) | ✅ Code complete (Sessions 1–6). **Resend:** verified `npneathery.com`; `send-invoice` sends as Parker Neathery / `invoicing@`, replies to `parker@`. PDF letterhead **settled** (no `SENDER_*` change). **First real-client send:** **2026-05-11** (owner). **Key rotation:** owner reminder **September 2026** ([runbook](docs/Supabase_deployment_and_go_live.md)). |
| Library | [docs/POS_Library_Build_Tracker.md](docs/POS_Library_Build_Tracker.md) | 🟢 Pre-trip arc through Session 7 shipped. **Session 9 OCR** — Anthropic integration + review list (**021**); deploy + owner smoke pending. **Trip policy:** build allowed on the road; shelf-bound Pass 2 + spot-checks → August. Sequence **7 → 9 → 8** unchanged. |

Operating guide: [AGENTS.md](AGENTS.md). Cursor rules: [.cursor/rules/](.cursor/rules/). Full decision archive: [docs/decisions/](docs/decisions/).

---

## Recent decisions (last 3 — full archive in `docs/decisions/`)

- [023 — Library mobile polish (PageHeader + tab bar utilities)](docs/decisions/023-library-mobile-polish.md) (2026-05-16) — `/library` + book detail mobile headers; `pb-tabbar` / `bottom-tabbar`; reading status + copy panel + scripture row UX.
- [022 — Library category removal + genre-only taxonomy](docs/decisions/022-library-category-removal.md) (2026-05-16) — Category → Genre backfill; dropped `categories` / `book_categories` / `books.primary_category_id`; Q11 closed, Q12 resolved.
- [021 — Library Session 9 OCR Anthropic + review list + trip policy](docs/decisions/021-library-session-9-ocr-anthropic-wired.md) (2026-05-16) — `ocr_scripture_refs` vision provider; `/library/review` scripture refs section; tracker trip-period amendment.

---

## Session handoff

**Library Path B (source → destination)** — **Apply completed by owner** (2026-05-04). Reference flow: [scripts/library-migrate-local-to-prod/README.md](scripts/library-migrate-local-to-prod/README.md). Scripture **`library-scripture-images` bucket objects** are still not copied by Path B; re-upload or sync objects if thumbnails matter.

**Trip QA runbook:** [docs/library-trip-qa-runbook.md](docs/library-trip-qa-runbook.md) — owner executes phone smoke + viewer smoke, then ticks tracker acceptance rows.

**Supabase workflow (repo convention):** Hosted `db push` / `deploy-functions` only — [supabase/README.md](supabase/README.md); also [AGENTS.md](AGENTS.md) Scripts + session template + [.cursor/rules/always.mdc](.cursor/rules/always.mdc).

**Repo gate:** `npm run check` last verified **2026-05-16** (Library mobile polish 023).

**Phone smoke (owner):** `/library` filters at scale, `/library/search-passage` (e.g. Phil 2:5), `/library/review` drill, `/library/add` barcode path — tracker Session 3–6 acceptance (steps in runbook §A).

**Viewer smoke (owner):** seed viewer + `user_permissions`; confirm merge/ancient/permissions 403s per [013](docs/decisions/013-library-session-7b-settings-polish.md) (runbook §B).

---

## Next up

1. **Backfill review pass** — work the ~N "Genre backfilled from category — confirm or refine." rows surfaced by 022 via `/library/review` whenever convenient; refining lands directly in the genre column.
2. **Session 9 — prod OCR:** ensure `supabase secrets set ANTHROPIC_API_KEY=…` (if not already) → **5-image smoke** (see [021](docs/decisions/021-library-session-9-ocr-anthropic-wired.md)); tick tracker Session 9 smoke row. ~~`npm run supabase:deploy-functions`~~ **done 2026-05-16.**
3. **Session 8 (Turabian):** Open Q4 **resolved** (HTML + plain-text clipboard, no file export); ~~Turabian skill in context~~ **done (Claude.ai, 2026-05-06)**; pure-function module may proceed during trip; full scholarly-core QA may wait until shelf is home. Turabian-first `/library/review` co-ships per [.cursor/plans/review_queue_gamification_39c2a467.plan.md](.cursor/plans/review_queue_gamification_39c2a467.plan.md).
4. **Shelf-bound queue (August):** deferred shelf-check items (Calvin CC, Bruce, Hodge, NBD); Q8 **resolved** (DB is source of truth — no Pass 2).
5. **Carry-forward — viewer smoke:** [runbook](docs/library-trip-qa-runbook.md) §B — merge/ancient/permissions 403s; tick Session 7 viewer acceptance + deferred Session 1–6 viewer rows + Session 9 OCR viewer row when done.
6. **Trip-period Q5 evaluation:** observe whether essay-level citations cause real friction during sermon prep / paper drafting; promote essays UI up the post-trip queue if yes.
7. **Invoicing maintenance:** rotate Supabase JWT secret + Resend API key when a deploy window opens ([docs/Supabase_deployment_and_go_live.md](docs/Supabase_deployment_and_go_live.md)).

---

## Design backlog (not scheduled)

- **Given away** — disposition separate from `reading_status` vs. flag + date vs. extending `borrowed_to` semantics.
- **Research-used, not owned** — track sources consulted without a purchased copy (`ownership_kind` / new entity vs. extending `books` / essays).
- **Multiple owned copies** — `copy_count` vs. child `book_copies` rows (per-copy shelf / gift intent).
- **Publisher defaults** — optional `publishers` table + default location; short-term client-side publisher→location hints on the book form (see misc library plan).

---

## Cross-module open questions

Only items that could block a future session. Full lists live in each tracker's Open Questions table.

- **Invoicing:** ~~domain + Resend verification~~ done; ~~`SENDER_*`~~ letterhead accepted; first real-client send **2026-05-11**; key rotation **September** (owner calendar).
- **Library Q4:** ~~bibliography export format~~ **resolved 2026-05-16** — HTML + plain-text clipboard, no file export.
- **Library Q5:** essay-level citations — trip-period observational task; promote if friction surfaces.
- **Library Q7:** ~~OCR provider choice~~ — resolved (015); **Anthropic integration** shipped in code (**021**); prod deploy + owner smoke pending.
- **Library Q8:** ~~v2 spreadsheet → Pass 2~~ **resolved 2026-05-16** — DB is source of truth; importer retired.
- **Library pre-session checklist:** all items resolved / absorbed 2026-05-16 (DB as source of truth + shelf-now access).

---

## Working agreement

- One-page rolling dashboard. Anything more than ~5 lines belongs in a tracker or decision record, not here.
- Every meaningful change ends with: update this file → commit → push.
- New session = new `docs/decisions/NNN-<slug>.md` filed; "Recent decisions" above gets the new entry, oldest drops off.
