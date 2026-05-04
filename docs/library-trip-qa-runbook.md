# Library trip-period QA + Session 7 viewer closure — runbook

**Purpose:** Close tracker acceptance that requires a **real phone** and a **viewer** login (not reproducible in CI). Follow in order; record **device model + OS** for owner smoke.

**References:** [PLAN.md](../PLAN.md) session handoff, [014 — migrate handoff](decisions/014-library-migrate-env-handoff.md), [013 — Session 7b RLS](decisions/013-library-session-7b-settings-polish.md), [POS_Library_Session_0.md](POS_Library_Session_0.md) §4 (viewer seed).

---

## Preconditions

1. **Viewer user** — Auth user with `profiles.role = 'viewer'` and `user_permissions` for `library` (e.g. `access_level = 'write'`) per Session 0 §4.
2. **Two sessions** — Owner on primary phone; viewer in another profile/incognito/device on the same deployed app URL.

---

## A. Owner — phone (Sessions 3–6 + 5.5)

| Step | Route / action | Pass criteria |
|------|------------------|---------------|
| 1 | `/library` | Open mobile filter sheet; combine genre, series (multi-combobox), author, `needs_review`; list stays responsive; "Showing N of M" correct; URL filters survive back/forward. |
| 2 | `/library/search-passage` | Philippians, ch 2, v 5 — results include scripture hits **and** rows with **Coverage** badge where `book_bible_coverage` exists. If zero coverage rows, add one Philippians coverage row in Studio or book detail, then re-test. |
| 3 | `/library/review` | Save+next, Skip, Delete (confirm) behave as designed; optional slice pills (`subject_blank`, `match_type`). |
| 4 | **Session 5.5 bar** | Without leaving `/library/review`, complete **50+** cards in **~5 minutes** (buttons sufficient; desktop hotkeys optional). |
| 5 | `/library/add` → `/library/books/new` | Barcode or manual ISBN → Open Library prefill → confirm → save (Session 6 path). |

---

## B. Viewer — Session 7 owner-only gates

Sign in as **viewer** (library write).

| Step | URL | Expected |
|------|-----|----------|
| 1 | `/settings/permissions` | **403** — only owner may manage permissions (`+page.server.ts` uses `error(403, …)`). |
| 2 | `/settings/library/people/merge` | **Redirect** to `/settings/library/people` (non-owner). |
| 3 | `/settings/library/people` | No merge affordances for non-owner (`{#if data.isOwner}`). Merge POST is `fail(403, …)` in `mergePeopleSettingsAction` if forged. |
| 4 | `/settings/library/ancient-texts` | No create/edit/merge/delete for non-owner; actions return `fail(403, …)` in `ancient-texts-settings-actions.ts`. |
| 5 | `/library` (or book detail) | Library still usable per `user_permissions` (e.g. reading status / writes allowed by RLS). |

---

## C. Path B + scripture thumbnails (014)

- **Row sync:** Recorded complete in PLAN / decision 014 — no migrate rerun unless SRC/DST intentionally diverge again.
- **Storage:** Path B does **not** copy `library-scripture-images` objects. If thumbnails are missing after sync, re-upload or copy bucket objects manually.

---

## D. After manual QA

1. Tick the matching acceptance rows in [POS_Library_Build_Tracker.md](POS_Library_Build_Tracker.md) (Sessions 3, 4, 5, 5.5, 6, 7 viewer row; Session 1 viewer row if run).
2. Add one-line verification note (date, device, viewer email redacted).
3. Run **`npm run check`** before commit (repo gate).

New `docs/decisions/*` only if a non-obvious behavior change or surprise surfaced during QA.
