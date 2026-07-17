-- Confident residual genre clears (review-queue research Batch 1 follow-on).

UPDATE public.books SET genre = 'Literature', needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id IN (
	'787bc883-7bcc-48c6-baff-b2820e77037b', -- Huckleberry Finn
	'7c8387b7-328e-4bc1-a40c-b6af96078c0f', -- Flatland
	'7bfa7783-e196-487a-ba1e-da0e11c2cdc4', -- Loamhedge
	'2b69810d-3452-4ba7-a110-06775858823c', -- Die Bremer Stadtmusikanten
	'a3be323b-54dc-447a-839f-869ba727d7d1', -- See How They Run
	'7bf7d04b-b250-477a-a571-b12a78ece681', -- The Idiot
	'7e17e799-4cd6-4e58-8841-c0426cad0c8b', -- The Scarlet Letter
	'7d79f14f-655c-40c7-adfe-38752fcf4bae'  -- Sherlock Holmes complete novels
)
AND deleted_at IS NULL;

UPDATE public.books
SET
	title = 'High Rhulain',
	genre = 'Literature',
	year = 2005,
	publisher = 'Philomel Books',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = 'c8e7ad98-cc01-42c9-9cf0-483ea15da683'
	AND deleted_at IS NULL;

UPDATE public.books SET genre = 'Literature', language = 'german', needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id = 'e6c78f15-2fb8-4f4d-bee9-5c716acd3748' -- Mein erster Flug
	AND deleted_at IS NULL;

UPDATE public.books SET genre = 'Sports', needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id IN (
	'584a73af-69d6-4bdd-a808-f9b69a909e6e', -- And the Fans Roar
	'c0251c00-7928-462b-b79d-8ddbac4983e9', -- Evolution of the Game
	'78c866ad-da75-4fc3-ae3e-49159e53701f'  -- Football Book of Wisdom
)
AND deleted_at IS NULL;

UPDATE public.books SET genre = 'Science', needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id = '8737e86f-18fd-4464-a79a-48fb5bc3f399' -- Applied Strength of Materials
	AND deleted_at IS NULL;

UPDATE public.books SET genre = 'Other', needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id = '3ccac07c-53ad-4a85-afc2-186a4ff273d3' -- King Family Cookbook
	AND deleted_at IS NULL;

UPDATE public.books SET genre = 'Business', needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id IN (
	'8032ac9b-3e57-42b3-abb0-857e5defbf15', -- If You Want It Done Right…
	'4b8ece4d-473d-4cb6-890b-fdedf311daf4'  -- Strategies for Organizing
)
AND deleted_at IS NULL;

UPDATE public.books SET genre = 'History', needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id = '3279f122-0726-415a-a45e-fe6e3903c07a' -- Imperial War Museum
	AND deleted_at IS NULL;

UPDATE public.books SET genre = 'Biography', needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id IN (
	'c9e5f406-112c-4fa0-80c5-90801b7594c3', -- Newman, Paul
	'611fa04f-ca36-44a5-8317-382144d19643'  -- Coming in on a Wing and a Prayer
)
AND deleted_at IS NULL;

UPDATE public.books SET genre = 'Church History', needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id = '9131c2c6-0a12-4746-8d57-b35d4a4e6378' -- Every Precious Stone (New City Fellowship)
	AND deleted_at IS NULL;

UPDATE public.books SET genre = 'Christian Living', needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id = '39e7f804-26d2-4c9a-95e0-92eaffa1c59f' -- Love and Power (Garriott)
	AND deleted_at IS NULL;

-- Pushkin vols: pre-ISBN note only — clear review
UPDATE public.books SET needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id IN (
	'b3b9b6b8-16ab-4a5b-90d1-78a300515e10',
	'b4df4bfb-d4d5-4275-b708-1f93ffea7210'
)
AND deleted_at IS NULL;
