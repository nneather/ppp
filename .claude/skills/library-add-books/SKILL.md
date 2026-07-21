---
name: library-add-books
description: >-
  Research and batch-add physical books to the ppp library (commentaries and
  no-ISBN shelf adds). Use when Parker lists books to upload, asks to research
  then confirm before insert, adds commentaries without ISBN scan, or wants a
  migration that creates books/people/series/bible coverage on hosted Supabase.
---

# Library — add books (research → confirm → DML)

Batch shelf adds for **ppp** when ISBN/OL UI is wrong or slow (commentaries, reprints, multi-volume series). Pattern locked in [092](../../docs/decisions/092-commentary-batch-no-isbn.md).

## Route first

| Situation | Path |
|---|---|
| One book + clear ISBN | Prefer `/library/add` → Open Library prefill |
| Batch (≥2), no ISBN, series/reprint ambiguity, or “research then confirm” | **This skill** |
| Schema/types/OCR Edge | `ship-library-change` instead |

**Never INSERT until Parker answers the confirmation questions.** Research may proceed immediately.

## Efficiency defaults

1. **Dedup SQL first** (before deep bibliographic research) — title/author/series already in prod?
2. **One parallel lookup** for series, people, publishers, bible names (Supabase MCP `execute_sql` on prod `objtrdmmqlndtfddtzan`).
3. **Parallel web research** for remaining titles only.
4. **One confirmation message** — proposed table + numbered questions (A/B/C where possible).
5. **One idempotent migration** after answers — push, verify SELECT, decision log.

## Phase 0 — inventory (prod)

Run once per batch (combine into as few queries as possible):

```sql
-- Duplicates / near-dupes
SELECT b.id, b.title, b.author_display, s.abbreviation, b.year, b.isbn, b.volume_number
FROM books b
LEFT JOIN series s ON s.id = b.series_id
WHERE b.deleted_at IS NULL
  AND (/* title ILIKE / author_display ILIKE per candidate */);

-- Series (by abbr or name)
SELECT id, name, abbreviation FROM series
WHERE deleted_at IS NULL
  AND abbreviation ILIKE ANY(ARRAY[…]) OR name ILIKE ANY(ARRAY[…]);

-- People
SELECT id, first_name, middle_name, last_name FROM people
WHERE deleted_at IS NULL AND last_name ILIKE ANY(ARRAY[…]);

-- Publisher text conventions (often null publisher_id)
SELECT DISTINCT publisher, publisher_location
FROM books WHERE deleted_at IS NULL AND publisher ILIKE ANY(ARRAY[…]) LIMIT 20;
```

**If a row already exists:** prefer UPDATE (e.g. fill `volume_number`) over INSERT. Report that in the confirm table.

### Series collision footguns

| User says | Existing abbr | Do |
|---|---|---|
| IVP NTC / IVPNTC | `NTC` = Hendriksen/Baker *New Testament Commentary* | Create **`IVPNTC`**, never reuse `NTC` |
| Anchor / AB | `AB` exists; `ABD` is Dictionary | Use **`AB`** for commentaries |
| Black's | usually missing | Create **`BNTC`** (*Black's New Testament Commentaries*) |

Full series/ISBN/publisher notes: [reference.md](reference.md).

## Phase 1 — research pack

For each new book, gather:

- Canonical **title** (match series house style when possible)
- **Authors** → `first_name` / `middle_name` / `last_name` (reuse existing people rows by exact name parts)
- **Series** name + abbreviation + `volume_number` (e.g. `25B`, `7`, `20`)
- **Publisher** string + Turabian **location** (match sibling rows in that series)
- **year** / **original_year** / reprint story
- **ISBN** when confident — **checksum-validate** (prefer ISBN-13); leave null if uncertain
- **genre** (usually `Commentary`), **work_type** (`monograph` default), **language**, **reading_status** (`reference` for commentaries)
- **bible coverage** — every Protestant book in the title range ([088](../../docs/decisions/088-commentary-bible-coverage-cleanup.md)); names from `BIBLE_BOOK_NAMES` / `bible_books`

### People naming

- Prefer matching **existing** `(first_name, middle_name, last_name)` exactly — do not “fix” splits mid-batch (`J.` + `Ramsey` denorms to “J. R.”).
- Initials-as-first: `J. N. D.` / `J. B.` / `C. S.` as `first_name`, `middle_name` NULL (unless an existing row differs).
- Single middle initial: often stored without period (`D`, `E`, `L`) — mirror siblings in that batch.

### ISBN

```bash
node -e "
const n=process.argv[1];
function ok13(s){let sum=0;for(let i=0;i<12;i++)sum+=(+s[i])*(i%2?3:1);return (10-sum%10)%10===+s[12];}
function ok10(s){let sum=0;for(let i=0;i<9;i++)sum+=(+s[i])*(10-i);const c=s[9]==='X'?10:+s[9];return (sum+c)%11===0;}
console.log(n.length===13?ok13(n):ok10(n));
" '<isbn-digits>'
```

Reject bad checksums; re-research (catalog typos are common — see Brown `0385056869` not `…861` in 092).

## Phase 2 — confirm with Parker

Send **one** message:

1. Proposed records table (title, authors, series/vol, publisher, year, isbn, coverage).
2. Corrections spotted (e.g. Carol not Carl).
3. Numbered questions — only real forks. Typical:

   - Edition/year (combined vs multi-vol; reprint year vs original)
   - Series create vs attach; abbreviation
   - Publisher imprint (Doubleday vs Yale; A&C Black vs Hendrickson)
   - ISBN fill vs leave null
   - `needs_review` clean confirm vs shelf flag
   - Coverage edge cases (e.g. Titus-only despite Pastorals intro)

Defaults to state unless overridden: genre Commentary, work_type monograph, language english, reading_status reference, `needs_review = false` when clean.

## Phase 3 — write

1. `npx supabase migration new library_<slug>` — if CLI hangs, write `supabase/migrations/YYYYMMDDHHMMSS_library_<slug>.sql` manually (same format).
2. Idempotent DML: `WHERE NOT EXISTS` on natural keys (`title` + `series_id` for books; abbr for series; name parts for people). Template: [reference.md](reference.md).
3. `created_by`: owner uuid `a14833c9-459e-4667-aef3-dae698734f6d` (same as 088/092).
4. `npm run supabase:db:push:dry` → `npm run supabase:db:push` (hosted only — no local Docker).
5. Verify with SELECT (title, author_display, series, year, isbn, coverage arrays).
6. DML-only → skip `gen-types`. File `docs/decisions/NNN-*.md`, refresh PLAN.md Recent decisions + last-updated. Offer commit message.

## Do not

- INSERT before confirmation answers
- Reuse wrong series abbreviations (`NTC` ≠ IVP NTC)
- Hand-write `Database` types
- Put service-role secrets in the client
- Soft-delete existing dupes without asking
- Flag `needs_review` when Parker said clean confirm and fields are complete

## End-of-batch checklist

- [ ] Dupes handled (skip / UPDATE)
- [ ] Series abbr collisions checked
- [ ] ISBN checksums OK or null
- [ ] Coverage attached for Commentary ranges
- [ ] Migration applied + verify SELECT
- [ ] Decision log + PLAN.md
- [ ] Copy-paste commit message for Parker
