-- Follow-up to 20261024185000. Parker confirmed the physical copies.
-- Walsh, 1 Kings: 1996 Liturgical Press hardcover (not the 2021 paperback).
-- Wright, Exodus: 2021 Zondervan Academic hardcover (not the ebook ISBN).
-- Sarna Genesis stays 2001. Provan stays 1995 Hendrickson. Lovell stays 2025.

UPDATE public.books
SET
	year = 1996,
	isbn = '9780814650448',
	publisher = 'Liturgical Press',
	publisher_location = 'Collegeville, Minn.'
WHERE id = 'c52d5b1a-4c29-47cb-a46f-3059c330686d'
	AND deleted_at IS NULL;

UPDATE public.books
SET
	year = 2021,
	isbn = '9780310490692',
	publisher = 'Zondervan Academic'
WHERE id = '8fe47941-7968-4e4f-ad74-7317a63ed24a'
	AND deleted_at IS NULL;
