-- Batch 5: genre split Apostolic Fathers / Ancient Biblical Sources / Ancient Sources
-- + owner-resolved boundaries + confident bulk accepts.

-- 1) Open CHECK to allow new genre labels (keep old combined temporarily).
ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_genre_check;

ALTER TABLE public.books
	ADD CONSTRAINT books_genre_check CHECK (
		genre IS NULL
			OR genre IN (
				'Acts and Paul',
				'Ancient Biblical Sources',
				'Ancient Sources',
				'Apologetics',
				'Apostolic Fathers',
				'Apostolic Fathers and Ancient Sources',
				'Applied Theology',
				'Bibles',
				'Biblical Reference',
				'Biblical Theology',
				'Biography',
				'Business',
				'Chinese Language Tools',
				'Christian Living',
				'Christology',
				'Church History',
				'Commentary',
				'Culture',
				'Devotional',
				'Drama',
				'Ecclesiology',
				'Ethics',
				'General',
				'General Epistles',
				'German Language Tools',
				'Gospels and Jesus',
				'Greek Language Tools',
				'Hebrew Language Tools',
				'Historical Theology',
				'History',
				'Hobbies',
				'Homiletics',
				'Hymnals and Liturgy',
				'Language',
				'Latin Language Tools',
				'Leadership',
				'Literary Criticism',
				'Literature',
				'Music',
				'New Testament',
				'Old Testament',
				'Old Testament Historical Books',
				'Other',
				'Other Religions',
				'Pastoral Ministry',
				'Pentateuch',
				'Philosophy',
				'Pneumatology',
				'Poetry',
				'Politics and Policy',
				'Prophets',
				'Psalms and Wisdom Literature',
				'Reference',
				'Science',
				'Self-Help',
				'Sports',
				'Systematic Theology',
				'Theology'
			)
	) NOT VALID;

ALTER TABLE public.books VALIDATE CONSTRAINT books_genre_check;

-- 2) Remap live rows off the combined genre.
UPDATE public.books
SET genre = CASE title
	WHEN 'The Apostolic Fathers: Greek Texts and English Translations' THEN 'Apostolic Fathers'
	WHEN 'Corpus Christologicum' THEN 'Ancient Sources'
	WHEN 'The Life of the Blessed Emperor Constantine' THEN 'Ancient Sources'
	WHEN 'The Complete Works' THEN 'Ancient Sources' -- Pseudo-Dionysius if already tagged
	ELSE 'Ancient Biblical Sources'
END,
updated_at = now()
WHERE deleted_at IS NULL
	AND genre = 'Apostolic Fathers and Ancient Sources';

-- 3) Drop the retired combined label from CHECK.
ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_genre_check;

ALTER TABLE public.books
	ADD CONSTRAINT books_genre_check CHECK (
		genre IS NULL
			OR genre IN (
				'Acts and Paul',
				'Ancient Biblical Sources',
				'Ancient Sources',
				'Apologetics',
				'Apostolic Fathers',
				'Applied Theology',
				'Bibles',
				'Biblical Reference',
				'Biblical Theology',
				'Biography',
				'Business',
				'Chinese Language Tools',
				'Christian Living',
				'Christology',
				'Church History',
				'Commentary',
				'Culture',
				'Devotional',
				'Drama',
				'Ecclesiology',
				'Ethics',
				'General',
				'General Epistles',
				'German Language Tools',
				'Gospels and Jesus',
				'Greek Language Tools',
				'Hebrew Language Tools',
				'Historical Theology',
				'History',
				'Hobbies',
				'Homiletics',
				'Hymnals and Liturgy',
				'Language',
				'Latin Language Tools',
				'Leadership',
				'Literary Criticism',
				'Literature',
				'Music',
				'New Testament',
				'Old Testament',
				'Old Testament Historical Books',
				'Other',
				'Other Religions',
				'Pastoral Ministry',
				'Pentateuch',
				'Philosophy',
				'Pneumatology',
				'Poetry',
				'Politics and Policy',
				'Prophets',
				'Psalms and Wisdom Literature',
				'Reference',
				'Science',
				'Self-Help',
				'Sports',
				'Systematic Theology',
				'Theology'
			)
	) NOT VALID;

ALTER TABLE public.books VALIDATE CONSTRAINT books_genre_check;

-- 4) Batch 5 owner resolutions + bulk accepts.
WITH resolved AS (
	UPDATE public.books b
	SET
		genre = v.genre,
		needs_review = false,
		needs_review_note = NULL,
		updated_at = now()
	FROM (
		VALUES
			-- Q1 Kontrabaß
			('f080efe7-1a31-47be-9239-c6a2778f415a'::uuid, 'Literature'),
			-- Q2 Allison Sojourners
			('90b9d7b9-2bd4-4795-ae08-192a59942ee4'::uuid, 'Ecclesiology'),
			-- Q3 Newbigin Household
			('db77ca1a-962f-450c-991b-7411e13b9ac8'::uuid, 'Ecclesiology'),
			-- Q4 Lewis Four Loves / Weight of Glory
			('a75f4fdb-434c-4c85-ae01-213cb5839a65'::uuid, 'Applied Theology'),
			('4c79a640-a62e-40cd-bf7e-f66a4a016e11'::uuid, 'Applied Theology'),
			-- Q5 Bevere Holy Spirit ×2
			('a2dfecac-6042-4bad-bd82-ff9a36916e69'::uuid, 'Pneumatology'),
			('12dda1e9-55da-415e-9d1d-d74f217fd61d'::uuid, 'Pneumatology'),
			-- Q6 Plantinga
			('a3094706-a2ac-4a0b-9564-00ddae2680d3'::uuid, 'Systematic Theology'),
			-- Q7 Reed Liberty
			('38653c82-5efa-4255-b09b-4a6837ed72f7'::uuid, 'Politics and Policy'),
			-- Q8 Abolition of Man
			('89ca6906-a6b0-49f1-903d-2dd649188c5b'::uuid, 'Philosophy'),
			-- Q9 Alter Art of Biblical Poetry
			('35bb86cc-f123-44de-9b15-d8340f4cab36'::uuid, 'Psalms and Wisdom Literature'),
			-- Q10 deSilva Apocrypha
			('4cbe0b96-9543-430f-aa10-0ca69d03e24b'::uuid, 'Ancient Biblical Sources'),
			-- Q11 Ark Fever
			('47b4ba6e-1c88-4520-b401-ffbc36d3f982'::uuid, 'Literature'),
			-- Q12 Von Rad
			('f538d4ba-b2eb-4187-adca-601297aec436'::uuid, 'Biblical Theology'),
			('d34f2645-ec3e-40d3-b0ed-1f2b601f8873'::uuid, 'Psalms and Wisdom Literature'),
			-- Q13 Naselli
			('b994a481-b5d2-47d4-802f-949eea4de6bc'::uuid, 'Homiletics'),
			-- Q14 Doriani Getting the Message (both proposal lanes)
			('65bcb84d-26ba-404f-8516-e1d5b45fda2e'::uuid, 'Homiletics'),
			('64bb92f1-63de-4bc2-ab52-060164fc62f9'::uuid, 'Homiletics'),
			-- Q15 DeYoung Heidelberg
			('9c5f2f07-377e-4304-8072-4e3a51ecd504'::uuid, 'Historical Theology'),
			-- Q16 WCF ×2
			('bbd4b942-0d5f-4c9f-9792-29b0a91da7d2'::uuid, 'Systematic Theology'),
			('bd349dca-5940-47b9-9ec4-80cc45fce5cc'::uuid, 'Systematic Theology'),
			-- Q17 Makary Price We Pay
			('5e75b819-29f5-4514-a6db-416c7476027a'::uuid, 'Business'),
			-- Q18 McCloskey Economical Writing
			('2c7cac39-1de6-468b-8dc2-a0f1f3d07df1'::uuid, 'Reference'),
			-- Q19 Pseudo-Dionysius
			('5e8661d6-265b-4bf3-8885-ab0de9f5a595'::uuid, 'Ancient Sources'),
			-- Q20 Yarbrough Clash of Visions
			('30fd6723-0866-4048-b6ae-f61006ae52ef'::uuid, 'Biblical Theology'),
			-- Split: pending AF cluster
			('01102392-6081-4eac-b25e-5e1da05a0a4e'::uuid, 'Apostolic Fathers'),
			('c0080e81-6e50-4663-8734-db1ea441855b'::uuid, 'Ancient Biblical Sources'),
			('c1dff6bc-546d-48e2-bdad-99e2ff93dde2'::uuid, 'Ancient Biblical Sources'),
			('622a1e00-a991-4a51-a8ba-e1cda69473dc'::uuid, 'Ancient Biblical Sources'),
			('976fb696-ee99-4d17-b819-a4a7d9a27cf0'::uuid, 'Ancient Biblical Sources'),
			('bdab4316-a922-49d9-862d-0ec4ab42444d'::uuid, 'Ancient Biblical Sources'),
			('fd6e0a89-1757-4613-b7b6-e2fed57d6724'::uuid, 'Ancient Sources'),
			-- Bulk: German Language Tools (not Kontrabaß)
			('1bdd7f34-0510-488e-8fd4-5b99317f2a87'::uuid, 'German Language Tools'),
			('3f38f2de-de34-459d-8444-383532531841'::uuid, 'German Language Tools'),
			('efd99049-29f8-49d8-a25e-48caf5ea3280'::uuid, 'German Language Tools'),
			('516c7de7-71e3-46f6-840f-4bbcd84faddc'::uuid, 'German Language Tools'),
			-- Bulk: Latin Language Tools
			('d5bab5da-94b1-4161-bb5d-0f8719bff887'::uuid, 'Latin Language Tools'),
			('b0c149cc-f4a3-4c16-96c6-7f9c1d95bfc6'::uuid, 'Latin Language Tools'),
			('f32cd5e0-3f2a-4ab6-9553-2b84eb849ceb'::uuid, 'Latin Language Tools'),
			('d84423b2-68a8-4e44-ae2d-5df7c0d1ae0e'::uuid, 'Latin Language Tools'),
			-- Bulk: Hymnals and Liturgy
			('588c6e8e-5798-466d-8435-91302ef3db53'::uuid, 'Hymnals and Liturgy'),
			('45793b5c-b64d-4920-82b5-590c6711d69c'::uuid, 'Hymnals and Liturgy'),
			('9bd0d770-9180-49a5-8d63-d4e59b1cd142'::uuid, 'Hymnals and Liturgy'),
			('c82b5204-6810-44b1-a1b9-3f1028c81500'::uuid, 'Hymnals and Liturgy'),
			-- Bulk: Other Religions
			('574d07e5-db4c-48e7-a379-18fdebc73665'::uuid, 'Other Religions'),
			('9932241c-bd0b-4b3a-acf2-3e18d66563e5'::uuid, 'Other Religions'),
			('fefc788d-42b8-4be9-83a4-349fab0941dc'::uuid, 'Other Religions'),
			('bc16ab43-6a38-423b-838b-db567cdbae03'::uuid, 'Other Religions'),
			-- Bulk: Gospels and Jesus
			('254526c1-ae69-4338-8426-3d8f842fcc38'::uuid, 'Gospels and Jesus'),
			('c304ceee-694f-493c-a1f8-de503c8d78a5'::uuid, 'Gospels and Jesus'),
			('f5121966-8bf5-4aa5-a3e2-8a01b70d7a59'::uuid, 'Gospels and Jesus'),
			-- Bulk: Homiletics
			('b01966dd-649e-46eb-837c-26d2583faa05'::uuid, 'Homiletics'),
			('70704d51-9e91-4587-945f-0f68a43103ed'::uuid, 'Homiletics'),
			('9157d9b3-3d8a-47f1-af3e-162803061a52'::uuid, 'Homiletics'),
			-- Bulk: Science (not Makary)
			('2322ffa4-f2fb-45e6-bf21-ce5de98613f6'::uuid, 'Science'),
			('3cb71456-99c2-4b9d-87ec-17674c5d89d4'::uuid, 'Science'),
			-- Remaining clear OT as proposed
			('61152f8d-8819-4aa5-a129-4e52b29a82cb'::uuid, 'Old Testament'),
			('dd85e923-43c1-4ad4-8327-42fe703c98e4'::uuid, 'Old Testament'),
			('c2a761e6-16c3-4705-935c-dd15f03052af'::uuid, 'Old Testament'),
			('71563b28-d0a1-45cf-a56d-496db3ca1049'::uuid, 'Old Testament'),
			-- Remaining Historical Theology as proposed
			('fb465474-1d13-4ceb-992f-188245ca2748'::uuid, 'Historical Theology'),
			('effd93d4-eec5-46c4-9251-d0d00cff3a6e'::uuid, 'Historical Theology'),
			('8bb9ce02-ca50-4418-804f-3e1dcdbe7492'::uuid, 'Historical Theology'),
			('c433f023-f7de-4497-a149-7b5cbb934c75'::uuid, 'Historical Theology'),
			-- Remaining Ethics as proposed
			('96bb7d67-30c0-4c32-9087-5f4ca8954786'::uuid, 'Ethics'),
			('fac48b57-d087-4754-998c-7f5d10538c4d'::uuid, 'Ethics'),
			-- Remaining Systematic (McFarland)
			('234abcb5-4b05-44c1-a472-6b563a1fe0c7'::uuid, 'Systematic Theology'),
			-- Remaining Theology as proposed
			('ef7f3c8f-1cfc-4346-a196-7949e76c6197'::uuid, 'Theology'),
			('afff6faa-edb9-419f-b61b-ff34400d9b17'::uuid, 'Theology'),
			('584d4254-0db6-4526-93a9-81aa9524a182'::uuid, 'Theology'),
			('aebd67e6-12ad-49de-9a45-8cd052cb954c'::uuid, 'Theology'),
			-- Remaining Biblical Reference / Commentary / Language / Reference
			('f2e9ae65-954d-4295-9067-a5217cea8ab4'::uuid, 'Biblical Reference'),
			('64ecc214-2447-4182-a6f0-6f5d52b8a165'::uuid, 'Commentary'),
			('dd1de067-7399-47a0-b383-9c4b94151431'::uuid, 'Language'),
			('843989a3-9e0c-48d6-b53f-ee7fc70c550b'::uuid, 'Reference')
	) AS v(id, genre)
	WHERE b.id = v.id
		AND b.deleted_at IS NULL
	RETURNING b.id
)
UPDATE public.book_metadata_proposals p
SET status = 'accepted', reviewed_at = now(), updated_at = now()
WHERE p.book_id IN (SELECT id FROM resolved)
	AND p.deleted_at IS NULL
	AND p.status = 'pending';

-- Rewrite leftover pending proposals that still suggest the retired combined genre.
UPDATE public.book_metadata_proposals
SET
	fields = jsonb_set(fields, '{genre,proposed}', '"Ancient Biblical Sources"'),
	updated_at = now()
WHERE deleted_at IS NULL
	AND status = 'pending'
	AND fields->'genre'->>'proposed' = 'Apostolic Fathers and Ancient Sources';
