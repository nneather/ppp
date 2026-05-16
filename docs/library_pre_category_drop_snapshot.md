# Library category drop — pre-removal snapshot

**Captured:** 2026-05-16
**Purpose:** Audit + reversibility checkpoint before [decision 022 — library category removal](decisions/022-library-category-removal.md) drops `categories`, `book_categories`, and `books.primary_category_id`.

## Headline counts (live rows; `deleted_at IS NULL`)

| Metric | Count |
|---|---:|
| Total live books | 1,350 |
| Books with `primary_category_id` set | 284 |
| Books with `genre IS NULL` | 708 |
| Books with `genre IS NULL` AND `primary_category_id` set | **0** |
| `book_categories` junction rows | 285 |
| Books with `shelving_location` set | 0 |

The single decisive number is the zero. Every book that ever got a category also has a more-specific genre, so dropping `primary_category_id` loses **no classification signal**.

## Category distribution

Only 2 of the 7 seeded categories are actually used.

| Category | Books via `primary_category_id` | Books via `book_categories` junction |
|---|---:|---:|
| Biblical Studies | 257 | 260 |
| Languages & Reference | 27 | 24 |
| Theology | 0 | 0 |
| Church History | 0 | 0 |
| Pastoral & Practical | 0 | 0 |
| General / Trade | 0 | 0 |
| Personal | 0 | 0 |

The 5 zero-usage categories carry no information — they were seed values that the workflow never exercised. (The minor count drift between `primary_category_id` and the junction reflects books that have a primary but no junction row, or vice versa; both are dropped together.)

## Category × Genre cross-tab (live rows)

Categories that carry data:

| Category | Genre | Count |
|---|---|---:|
| Biblical Studies | Bibles | 26 |
| Biblical Studies | Biblical Reference | 60 |
| Biblical Studies | Commentary | 170 |
| Biblical Studies | Reference | 1 |
| Languages & Reference | Biblical Reference | 3 |
| Languages & Reference | Greek Language Tools | 13 |
| Languages & Reference | Hebrew Language Tools | 11 |

Books with no category, broken out by genre (top entries):

| Genre | Count |
|---|---:|
| _(null genre)_ | 708 |
| Literature | 70 |
| Historical Theology | 30 |
| Christian Living | 27 |
| Systematic Theology | 26 |
| Commentary | 19 |
| History | 18 |
| Homiletics | 16 |
| Other | 15 |
| Biblical Theology | 14 |
| Poetry | 14 |
| _(40 more rows under 10)_ | … |

## Locked Category → Genre mapping (defense-in-depth)

Per the plan, the backfill migration runs the following UPDATEs, but every match clause produces zero rows on this dataset. The migration ships as a no-op safety net.

- Theology → `Theology`
- Biblical Studies → `Biblical Reference` (only fires when `genre IS NULL`; all Biblical Studies rows already have a more-specific genre, so 0 rows match)
- Church History → `Church History`
- Pastoral & Practical → `Pastoral`
- Languages & Reference → `Reference` (same — 0 rows match)
- General / Trade → `General`
- Personal → `General`

## Reversibility

If the schema drop needs to be reversed before destroying `audit_log` history, every category attachment can be reconstructed from `audit_log` (the `categories`, `book_categories`, and `books` UPDATE/INSERT rows referencing `primary_category_id` are append-only and unaffected by the drop). The audit log retains the historical data even after the tables disappear.
