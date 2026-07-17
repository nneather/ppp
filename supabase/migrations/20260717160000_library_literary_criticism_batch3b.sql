-- Batch 3b: Literary Criticism genre + owner boundary resolutions.

ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_genre_check;

ALTER TABLE public.books
	ADD CONSTRAINT books_genre_check CHECK (
		genre IS NULL
			OR genre IN (
				'Acts and Paul',
				'Apologetics',
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

-- Helper: apply genre + clear review + accept pending proposal
CREATE TEMP TABLE _b3b (book_id uuid PRIMARY KEY, genre text NOT NULL);

INSERT INTO _b3b (book_id, genre) VALUES
	-- Leadership
	('c8982ab4-26fc-4b77-8c7b-0664345e232f', 'Leadership'), -- Primal Leadership
	('a663980d-53d6-42b6-a86a-d0a9699aa889', 'Leadership'), -- Strengths Based Leadership
	('5007de84-a6cd-4e4c-b951-548663810485', 'Leadership'), -- Tribal Leadership
	('f87f89fd-5779-44cc-a40e-fe6ff96b87b2', 'Leadership'), -- One Minute Manager
	-- Politics and Policy
	('5ee4f534-7ceb-4c7e-a81c-0f7a3334d5d5', 'Politics and Policy'), -- Wealth of Nations
	('304fa08a-a1f1-4d2c-92b6-b4b740c25055', 'Politics and Policy'), -- Common Sense
	('b5610825-f1c5-467a-bebb-478b9790d256', 'Politics and Policy'), -- Democracy in America I
	('85cc19fc-d6eb-494f-8d51-be0644e07df4', 'Politics and Policy'), -- Democracy in America II
	-- Business / Self-Help
	('fe774b50-4522-47bd-b331-c649eedb7b21', 'Business'), -- Eat That Frog
	('54921a91-a735-45ca-a134-5436706de29c', 'Self-Help'), -- Getting Things Done
	('59790f60-bbfe-4f00-8dc7-2911fde7f60e', 'Self-Help'), -- How to Win Friends
	-- Biblical / bio / culture
	('921fd07c-179a-44e2-995b-f74541ca7a09', 'Acts and Paul'), -- Bruce Paul
	('dfbe6f73-9297-464d-9c19-3c89dc324607', 'Biography'), -- Bonhoeffer Widerstand
	('e9d422bd-2f0d-46ab-974f-90885b5236a8', 'Biography'), -- The Keener Side
	('6f1cb8a5-3c0b-4b18-b0af-3380f4f76595', 'Biography'), -- Hart Nevin
	('8dd12a74-405e-494f-bb51-23734fb0f3c4', 'Culture'), -- Durant Caesar and Christ
	-- Literary Criticism (Lewis + Culler); Eliot left as Culture/Poetry
	('389e27f1-ca7d-448f-b435-085801599ea6', 'Literary Criticism'), -- Preface to Paradise Lost
	('857d5305-7d03-418d-b6e7-ca2cf1773be7', 'Literary Criticism'), -- Experiment in Criticism
	('87dbb6f5-9c9f-42a9-bb76-7f870ac6c6e4', 'Literary Criticism'), -- Literary Theory (Culler)
	-- Poetry
	('8326711f-dadc-41d3-916c-36ff38d61c5a', 'Poetry'); -- Heine Wintermärchen

UPDATE public.books b
SET
	genre = t.genre,
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
FROM _b3b t
WHERE b.id = t.book_id
	AND b.deleted_at IS NULL;

UPDATE public.book_metadata_proposals p
SET
	status = 'accepted',
	reviewed_at = now(),
	updated_at = now()
WHERE p.book_id IN (SELECT book_id FROM _b3b)
	AND p.deleted_at IS NULL
	AND p.status = 'pending';

-- Soft-delete personal keepsake
UPDATE public.books
SET deleted_at = now(), updated_at = now()
WHERE id = '86e804bd-d92c-488f-aa2b-8da70ad6c792' -- For Parker, Love Mom
	AND deleted_at IS NULL;

UPDATE public.book_metadata_proposals
SET
	status = 'rejected',
	reviewed_at = now(),
	updated_at = now()
WHERE book_id = '86e804bd-d92c-488f-aa2b-8da70ad6c792'
	AND deleted_at IS NULL
	AND status = 'pending';

-- Eliot: keep AI Culture/Poetry (not Literary Criticism)
-- Notes towards Definition of Culture + Idea of a Christian Society → Culture
-- Wasteland → Poetry
UPDATE public.books b
SET
	genre = p.fields->'genre'->>'proposed',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
FROM public.book_metadata_proposals p
WHERE p.book_id = b.id
	AND p.deleted_at IS NULL
	AND p.status = 'pending'
	AND b.deleted_at IS NULL
	AND b.id IN (
		'd3b49414-2766-4b02-931f-4d54de515b1f', -- Notes towards Definition of Culture
		'32f50c30-1c4c-491f-9091-67aec6a0fed0', -- Idea of a Christian Society
		'8358e632-3af6-4512-92c9-c60c9db34bb0'  -- Wasteland
	);

UPDATE public.book_metadata_proposals
SET
	status = 'accepted',
	reviewed_at = now(),
	updated_at = now()
WHERE book_id IN (
	'd3b49414-2766-4b02-931f-4d54de515b1f',
	'32f50c30-1c4c-491f-9091-67aec6a0fed0',
	'8358e632-3af6-4512-92c9-c60c9db34bb0'
)
AND deleted_at IS NULL
AND status = 'pending';
