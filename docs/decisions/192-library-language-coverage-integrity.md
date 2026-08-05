# 192 — Library language + coverage integrity (pre-STL)

**Date:** 2026-08-05
**Module:** library
**Tracker session:** ad-hoc integrity (away from shelf)

## Built
- Migration `20260805180209_library_language_and_coverage_integrity.sql` (hosted push):
  - **16** owned books `language=english` → `german` (OL `/languages/ger/` and/or unambiguous German imprint / original)
  - **8** `book_bible_coverage` rows for 6 commentaries that were missing Protestant-canon coverage
- Left **ISBN duplicate groups** alone — owner confirmed legitimate multi-copy holdings (not soft-delete candidates)
- Skipped AB deuterocanonicals (*I and II Esdras*, *Judith*, *Wisdom of Ben Sira*) — `bible_books` is Protestant 66 only; no FK target

## Decided
- Conservative language set only: keep `english` when OL lists `/languages/eng/` (Sebald *Emigrants*, *Emil and the Detectives*, Grimm Fairy Tales, Wildside *Critique of Pure Reason*, tredition *Meister-erzählungen*)
- Do **not** mass-flip `German Language Tools` learner textbooks to german (most stay english by convention); exception: *Handbuch zur deutschen Grammatik* where OL reports ger
- ISBN “duplicates” = multi-copy; optional later: consolidate to `copy_count` on one row (out of scope)
- Deuterocanonical commentary coverage deferred until/unless deuterocanonical names are added to `bible_books` (schema change — not this pass)

## Schema changes
- `20260805180209_library_language_and_coverage_integrity.sql` — DML only (no type regen)

## Coverage applied

| Book | Coverage |
|---|---|
| Dillard GAOT *Faith in the Face of Apostasy* | 1 Kings, 2 Kings |
| Duguid GAOT *Living in the Gap…* | Genesis |
| Eswine GAOT *Recovering Eden* | Ecclesiastes |
| Bruce NICNT *Hebrews* | Hebrews |
| Pink *Gleanings from Elisha* | 1 Kings, 2 Kings |
| Guelich *Sermon on the Mount* | Matthew |

## New components / patterns added
- None

## Open questions surfaced
- *Die Bibel* (`0b457eca…`, ISBN `9780688037246`) is catalogued with a German title but OL identifies the edition as Keller **The Bible as History** (English translation). Language correctly left `english`; **title remint** when convenient.
- Direct host `db.<ref>.supabase.co` still ENOTFOUND on this network (IPv6-only); language audit CLI needs Session Pooler (`LIBRARY_AUDIT_DATABASE_URL`) — applied via migration instead.

## Surprises
- `npm run library:language-audit` cannot use Direct URI from this laptop; dotenv also overrides a one-shot `LIBRARY_AUDIT_DATABASE_URL` env because `.env.local` wins with `override: true`
- Commentary-without-coverage dropped from 9 → 3 (all AB deuterocanonical)

## Carry-forward updates
- [x] Decision doc filed
- [x] PLAN.md refreshed
- [ ] components.mdc / AGENTS — n/a (DML only)
- [ ] Optional: wire language-audit to same pooler derive as `library:review-research`
