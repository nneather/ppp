-- NRSV Apocrypha vocab (18 books). Protestant canon sort_order 1–66 is unchanged.
-- Constraint name confirmed in pg_constraint: bible_books_testament_check.
-- bible_books is a documented exception: no RLS, grants, soft delete, or audit trigger.

ALTER TABLE public.bible_books DROP CONSTRAINT IF EXISTS bible_books_testament_check;

ALTER TABLE public.bible_books
	ADD CONSTRAINT bible_books_testament_check
	CHECK (testament IN ('OT', 'NT', 'AP'));

INSERT INTO public.bible_books (name, testament, sort_order) VALUES
	('Tobit', 'AP', 67),
	('Judith', 'AP', 68),
	('Additions to Esther', 'AP', 69),
	('Wisdom of Solomon', 'AP', 70),
	('Sirach', 'AP', 71),
	('Baruch', 'AP', 72),
	('Letter of Jeremiah', 'AP', 73),
	('Prayer of Azariah', 'AP', 74),
	('Susanna', 'AP', 75),
	('Bel and the Dragon', 'AP', 76),
	('1 Maccabees', 'AP', 77),
	('2 Maccabees', 'AP', 78),
	('1 Esdras', 'AP', 79),
	('Prayer of Manasseh', 'AP', 80),
	('Psalm 151', 'AP', 81),
	('3 Maccabees', 'AP', 82),
	('2 Esdras', 'AP', 83),
	('4 Maccabees', 'AP', 84)
ON CONFLICT (name) DO NOTHING;
