-- Four German shelf copies were catalogued with English-edition ISBNs / imprints
-- ([192] skipped them as OL eng). Owner: all four are German; correct language and
-- clear wrong English match keys. Sebald year=1992 → Eichborn 1st German ISBN.

-- ---------------------------------------------------------------------------
-- Die Ausgewanderten (Sebald) — Eichborn 1992 (Die andere Bibliothek)
-- ---------------------------------------------------------------------------
UPDATE public.books
SET
	language = 'german',
	isbn = '9783821840932',
	publisher = 'Eichborn',
	publisher_location = 'Frankfurt am Main',
	publisher_id = NULL
WHERE id = '21a9972f-997f-4b44-8612-097cc5768d3b'
  AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Emil und die Detektive — publisher Atrium already correct; ISBN was Abrams eng
-- ---------------------------------------------------------------------------
UPDATE public.books
SET
	language = 'german',
	isbn = NULL
WHERE id = 'cedb5206-2177-4038-9cd3-a4fe0dc6eade'
  AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Kritik der reinen Vernunft — Britannica / Wildside ISBN was English
-- ---------------------------------------------------------------------------
UPDATE public.books
SET
	language = 'german',
	title = 'Kritik der reinen Vernunft',
	isbn = NULL,
	publisher = NULL,
	publisher_location = NULL,
	publisher_id = NULL
WHERE id = '962b27f7-d52b-4780-9283-a7f48ad4fda3'
  AND deleted_at IS NULL;

UPDATE public.people
SET first_name = 'Immanuel'
WHERE id = '96f2159b-83db-48de-b70b-e6727e52f9f0'
  AND deleted_at IS NULL
  AND first_name = 'Emmanuel'
  AND last_name = 'Kant';

-- ---------------------------------------------------------------------------
-- Die Bibel — Book Club Associates + Keller "Bible as History" ISBN were wrong
-- ---------------------------------------------------------------------------
UPDATE public.books
SET
	language = 'german',
	isbn = NULL,
	publisher = 'Deutsche Bibelgesellschaft',
	publisher_location = NULL,
	publisher_id = NULL,
	needs_review_note = NULL
WHERE id = '0b457eca-a140-45d3-8abf-ee4ae6f713e9'
  AND deleted_at IS NULL;
