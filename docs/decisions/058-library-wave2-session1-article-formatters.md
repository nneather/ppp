# 058 — Library Wave 2 Session 1 — article-level formatters

**Date:** 2026-07-06
**Module:** library
**Tracker session:** Wave 2 Session 1

## Built

- **`formatEssayFootnote` dispatch** — unsigned `s.v.` (BDAG via `series_abbreviation`), signed dictionary (ABD), abbreviated multi-volume article (TDNT `ABBR vol:page`), chapter-in-edited-volume (Piper pattern).
- **`formatEssayBibliography`** — signed essays/chapters only; unsigned reference-work articles return empty bib.
- **Short footnote fix** — capitalized last name + leading-article strip on main title (`stripLeadingArticleDisplay` in `title-sort.ts`).
- **`formatEditorsInlineBibliography`** — lowercase `edited by …` for essay bib entries.
- **20/20 Wave 2 fixtures green** — rows 16–20 flipped from `it.fails` to pass-loop coverage in `format.test.ts`.
- **Essay seed SQL** — [`supabase/seed/library_essays_seed.sql`](../supabase/seed/library_essays_seed.sql): 5 essays (BDAG ἀγάπη, ABD Canon/Abraham/Covenant, TDNT λέγω) + BDAG series carrier + `work_type = reference_work` on parent volumes.

## Decided

- **Decision log number 058** — session template referenced `057-*` but [057](057-pwa-consistency.md) was already filed; used next free number.
- **BDAG abbreviation carrier** — `series.abbreviation = 'BDAG'` on parent book (not pseudo-author from volume authors); seed creates series row and links BDAG parent.
- **TDNT abbreviated form** — shipped in Session 1 (row 18); not deferred to Session 2.
- **Glory of the Atonement** — not in prod library; row 19 fixture-only until parent book exists; seed skips chapter essay (no parent match).

## Schema changes

- None. Seed DML only (`library_essays_seed.sql`).

## New components / patterns added

- `src/lib/library/turabian/article.ts` — `formatEssayBibliography` + essay footnote dispatch branches.
- `src/lib/library/title-sort.ts` — `stripLeadingArticleDisplay` (case-preserving; used by short footnotes).
- `src/lib/library/turabian/names.ts` — `formatEditorsInlineBibliography`.
- `supabase/seed/library_essays_seed.sql` — idempotent essay QA seed.

## Open questions surfaced

- **Session 2 loaders** — hydrate `EssayCitationInput.authors` + parent `series_abbreviation` from `series` join for book-detail copy buttons.
- **Seed apply** — Supabase MCP `execute_sql` is read-only on linked project; owner applies seed via Dashboard SQL editor (pre-check confirmed ABD vol 1, TDNT vol 4, BDAG parent exist).

## Surprises (read these before the next session)

- **Prod book titles** use `The Anchor Bible Dictionary` (with article); fixtures use `Anchor Bible Dictionary` — loaders must use stored title, not fixture shorthand.
- **`formatAuthorsBibliography` + middle initial** — names ending in `A.` need single-period join before quoted essay title (`Sanders, James A. "Canon."` not `Sanders, James A..`).
- **MCP read-only** — essay seed + `audit_log` INSERT verification deferred to owner paste-in after deploy.

## Carry-forward updates

- [ ] components.mdc updated — N/A (no new UI components)
- [x] AGENTS.md inventory updated
- [ ] new env vars documented — N/A
- [x] tracker Wave 2 Session 1 marked done
- [x] PLAN.md refreshed
