# 133 — Baker / Baker Academic publisher link pass

**Date:** 2026-07-23
**Module:** library
**Tracker session:** ad-hoc — follow-up to [131](131-bh-publisher-link-backfill.md) (*Praying with Paul* confirmed Baker Academic)

## Built

- Idempotent DML migration `20260723203150_library_baker_publisher_link_pass.sql` (hosted `db push`):
  - *Praying with Paul* Lifeway → **Baker Academic** / `Grand Rapids, MI`
  - Linked unlinked free-text: Jobes *1 Peter* BECNT → Academic; Calvin *Genesis* + *Harmony of Matthew, Mark, Luke* → Baker Books
  - Moves: Beale *NT Biblical Theology* + Schreiner *Romans* BECNT → Baker Academic (were Baker Books)
  - Mislink repairs: Arnold *Ephesians* ZECNT → **Zondervan** (was Baker Books); Calvin *Psalms 93–150* → Baker Books (FK still Eerdmans after [122](122-calvin-cc-imprint-normalize.md)); NIBC *Psalms* `BakerBooks` typo → **Hendrickson** / Peabody; Litfin *Church Fathers* ISBN `9781587431968` → **Brazos Press**
  - Location backfill: all linked Baker Academic / Baker Books → `Grand Rapids, MI`
  - Alias `BakerBooks` on Baker Books for future matching
- Post-apply: **0** unlinked Baker free-text; **27** Academic + **37** Books, all Grand Rapids

## Decided

- Treat BECNT series membership as decisive for Academic (Romans) even when free-text said Baker Books.
- Do **not** mass-move every `97808010*` Baker Books row to Academic — shared historical ISBN prefixes; only clear cases.
- NIBC Psalms ISBN is Hendrickson, not a Baker typo-to-fix — remint away from Baker family.

## Schema changes

- `20260723203150_library_baker_publisher_link_pass.sql` — DML only

## Open questions surfaced

- *Christ-Centered Preaching* still Baker Books (1994 / `9781441200228`); Covenant fixture expects Baker Academic 2nd ed 2005 — shelf-verify edition before reminting.
- *Exegetical Fallacies* still Baker Books with Paternoster ISBN `9780853646778` — leave until shelf check.
- Other trade-ish Baker Books rows with `08010` ISBNs left as-is (NIBC reprints, older monographs).

## Surprises

- [122](122-calvin-cc-imprint-normalize.md) updated Calvin Psalms free-text to Baker Books but left `publisher_id` on Eerdmans.
- ZECNT Ephesians free-text was already Zondervan while FK pointed at Baker Books.

## Carry-forward updates

- [x] PLAN.md refreshed
- [ ] components.mdc — N/A
- [ ] AGENTS.md — N/A
- [x] `npm run check` — N/A (DML-only)
