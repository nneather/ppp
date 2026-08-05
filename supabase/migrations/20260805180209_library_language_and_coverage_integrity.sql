-- Library integrity (pre-STL): language=english → german for clear German editions,
-- plus bible coverage for commentaries missing Protestant-canon coverage.
-- ISBN duplicates left alone (owner: legitimate multi-copy holdings).
-- AB deuterocanonicals (Esdras / Judith / Ben Sira) skipped — no bible_books FK target.

-- ---------------------------------------------------------------------------
-- Language: conservative set (OL /languages/ger/ and/or unambiguous German imprint)
-- ---------------------------------------------------------------------------
UPDATE public.books
SET language = 'german'
WHERE deleted_at IS NULL
  AND language = 'english'
  AND id IN (
	-- OL ger
	'f080efe7-1a31-47be-9239-c6a2778f415a', -- Der Kontrabaß (Diogenes)
	'2143a416-f4d8-4fcf-a9da-633965884c93', -- Der unterschätzte Petrus (Mohr Siebeck)
	'a9e5c429-d180-4020-9308-ef53538bd2e1', -- Der Weg zurück (Kiepenheuer & Witsch)
	'8326711f-dadc-41d3-916c-36ff38d61c5a', -- Deutschland - Ein Wintermärchen (Reclam)
	'3e2eb904-b13e-4e96-9046-2f92d29e017e', -- Die Bekennende Kirche in Baden (Kohlhammer)
	'd316430d-d1c5-442f-a602-a2da6073e56b', -- Die Flaschenpost (Beltz)
	'3f38f2de-de34-459d-8444-383532531841', -- Handbuch zur deutschen Grammatik (OL ger)
	-- No ISBN / strong German original (no conflicting OL eng)
	'b3dd198c-851f-45e0-8bcd-f2f5a3687bd3', -- Der Deutschenhaß
	'2b69810d-3452-4ba7-a110-06775858823c', -- Die Bremer Stadtmusikanten
	'9f3d2975-7a53-4867-8632-1249c1e3ee02', -- Die Verwandlung
	'cb5c59ff-169a-48e0-acc0-f0adfb51faf4', -- Geschischte der deutschen Literatur
	'61154507-6537-4702-9348-82fba638af0c', -- Im diplomatischen Dienst…
	'6e23a2cf-e525-4bf3-b093-a1d8b6fb4c4c', -- Lasset die Kindlein zu mir kommen!
	'516c7de7-71e3-46f6-840f-4bbcd84faddc', -- Lehr- und Übungsbuch der deutschen Grammatic
	'9ba8b0ad-05c7-4558-8799-285f0677f7f6', -- Sämmtliche Dichtungen
	'aebd67e6-12ad-49de-9a45-8cd052cb954c'  -- Wer ist das eigentlich -- Gott? (Suhrkamp)
  );

-- Skipped (OL eng / English translation imprint — keep language=english):
--   Die Ausgewanderten (Harvill The Emigrants)
--   Die Bibel ISBN 9780688037246 (actually Keller The Bible as History — title smell, not language)
--   Emil und die Detektive (Abrams Emil and the Detectives)
--   Kinder- und Hausmärchen (Grosset Grimm Fairy Tales)
--   Kritik der Reinen Vernunft (Wildside Critique of Pure Reason)
--   Meister-erzählungen (OL lists eng)

-- ---------------------------------------------------------------------------
-- Bible coverage (Protestant canon only)
-- ---------------------------------------------------------------------------
INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT v.book_id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('348eefda-b429-4112-add8-823b43a953fb'::uuid, '1 Kings'),   -- GAOT Elijah & Elisha
	('348eefda-b429-4112-add8-823b43a953fb'::uuid, '2 Kings'),
	('d69f75fb-e1b4-4009-9fa4-dc2f94f4888f'::uuid, 'Genesis'),   -- GAOT Living in the Gap
	('8d048808-c3d8-448f-91ad-d57983d9b75c'::uuid, 'Ecclesiastes'), -- GAOT Recovering Eden
	('08d7fcb9-9e98-4073-847c-319b52b0323b'::uuid, 'Hebrews'),  -- NICNT Bruce
	('bbde41ca-093b-4902-bd75-0b1f0dbdb765'::uuid, '1 Kings'),  -- Pink Gleanings from Elisha
	('bbde41ca-093b-4902-bd75-0b1f0dbdb765'::uuid, '2 Kings'),
	('39cc2078-3594-4361-81cc-a4eb3ba78ba8'::uuid, 'Matthew')  -- Guelich Sermon on the Mount
) AS v(book_id, bible_book)
JOIN public.books b ON b.id = v.book_id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = v.book_id AND c.bible_book = v.bible_book
);
