# Library add-books — reference

Companion to [SKILL.md](SKILL.md). Read when writing the migration or resolving series/publisher edge cases.

## Owner `created_by`

```text
a14833c9-459e-4667-aef3-dae698734f6d
```

## Migration skeleton (idempotent)

```sql
-- library_<slug>: batch shelf add (research + owner confirm)
-- Idempotent by natural keys. Hosted push only.

INSERT INTO public.series (name, abbreviation, created_by)
SELECT v.name, v.abbreviation, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Example Series Name', 'EXS')
) AS v(name, abbreviation)
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND s.abbreviation = v.abbreviation
);

INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('First', 'M', 'Last'),
	('J. B.', NULL, 'Lightfoot')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

INSERT INTO public.books (
	title, publisher, publisher_location, year, original_year, isbn,
	volume_number, series_id, genre, work_type, language,
	reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, v.publisher_location, v.year, v.original_year, v.isbn,
	v.volume_number, s.id, 'Commentary', 'monograph', 'english',
	'reference', false, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Title', 'Publisher', 'City, ST', 1990, NULL::int, '978…', '7', 'NAC')
) AS v(title, publisher, publisher_location, year, original_year, isbn, volume_number, series_abbr)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id = s.id
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', v.sort_order
FROM (VALUES
	('Title', 'NAC', 'First', 'M', 'Last', 0)
) AS v(title, series_abbr, first_name, middle_name, last_name, sort_order)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
JOIN public.people p ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id
);

INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Title', 'NAC', '1 Samuel'),
	('Title', 'NAC', '2 Samuel')
) AS v(title, series_abbr, bible_book)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);
```

`book_bible_coverage` has **no** `deleted_at`. `author_display` is trigger-maintained — do not set manually.

## Publisher strings (common)

Match existing free-text on sibling series rows; `publisher_id` often null for older AB/NAC.

| Imprint | Typical `publisher` | Location |
|---|---|---|
| NAC / B&H era | `Broadman & Holman Publishers` or `B&H Publishing Group` | `Nashville, TN` |
| NICNT | `Eerdmans` | `Grand Rapids, MI` |
| IVP / IVPNTC | `InterVarsity Press` or `IVP Academic` | `Downers Grove, IL` |
| Anchor (Doubleday era) | `Doubleday` | `Garden City, NY` |
| Zondervan | `Zondervan` | `Grand Rapids, MI` |
| Black's original | `A. & C. Black` | `London` |

Do **not** invent new `publishers` registry rows mid-batch unless Parker asks — optional follow-up.

## Coverage rules (commentaries)

From [088](../../docs/decisions/088-commentary-bible-coverage-cleanup.md):

- Multi-book titles → every book in the range (`1 Samuel` + `2 Samuel`; `1 John`–`3 John`; Haggai + Zechariah).
- Whole-testament reference works → usually **not** Commentary coverage (genre Biblical Reference).
- Deuterocanonical AB vols → skip Protestant coverage unless asked.
- Intro that spans more books than the volume title (e.g. Quinn Pastorals intro) → **ask**; default to title books only.

Exact names: `src/lib/library/bible-book-names.ts` / `bible_books.name`.

## Confirmation message template

```markdown
## Proposed records
| # | Title | Author(s) | Series/vol | Publisher | Year | ISBN | Coverage |
|---|---|---|---|---|---|---|---|
| 1 | … | … | … | … | … | … | … |

## Already in library
- *Title* — action: fill volume / skip

## Questions
1. …
2. …
```

## Verify after push

```sql
SELECT b.title, b.author_display, s.abbreviation, b.volume_number,
       b.publisher, b.year, b.original_year, b.isbn, b.needs_review,
       (SELECT array_agg(c.bible_book ORDER BY c.bible_book)
        FROM book_bible_coverage c WHERE c.book_id = b.id) AS coverage
FROM books b
JOIN series s ON s.id = b.series_id
WHERE b.deleted_at IS NULL AND s.abbreviation IN (…) AND b.title IN (…);
```

## Decision log

Use AGENTS.md template. Surprises section: series collisions, ISBN checksum fails, existing dupes, people denorm quirks.

Commit style: `library: NNN-<slug> — <outcome>`
