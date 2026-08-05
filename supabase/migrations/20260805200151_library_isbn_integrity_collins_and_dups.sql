-- ISBN integrity follow-up to OL cross-check (owner: OL mismatches keep library).
-- 1) Collins Genesis 1-4: stored ISBN had bad check digit; P&R barcode is 9780875526195
--    (9781596380363 is Clowney — do not use).
-- 2) Exact duplicate ISBN+title pairs → keep older row, copy_count=2, soft-delete newer.
-- Deferred: Lost Tales 1/2 and Foundation/Second Foundation shared-ISBN pairs (shelf barcode).

-- ---------------------------------------------------------------------------
-- Collins Genesis 1-4 — correct P&R ISBN
-- ---------------------------------------------------------------------------
UPDATE public.books
SET isbn = '9780875526195'
WHERE id = 'b00d9b63-ef8a-4cd8-b192-1cae4a021519'
  AND deleted_at IS NULL
  AND isbn = '9781596380360';

-- ---------------------------------------------------------------------------
-- Duplicate rows: keep earliest created_at, copy_count=2, soft-delete sibling
-- ---------------------------------------------------------------------------
UPDATE public.books
SET copy_count = 2
WHERE id IN (
	'b5138a28-dfcb-4a52-add9-d6bc9d921259', -- Valley of Vision
	'12dda1e9-55da-415e-9d1d-d74f217fd61d', -- Holy Spirit (Bevere)
	'6981bd11-9539-4af2-ab4a-778faf18edc8', -- My Utmost
	'83cfba95-fd42-41c4-821c-62f66fa6f59f', -- Fellowship
	'e4f01694-acd6-4294-b2d8-a999e21d9e2f'  -- Return of the King
)
  AND deleted_at IS NULL;

UPDATE public.books
SET deleted_at = now()
WHERE id IN (
	'af803a15-c6db-498f-9e37-16f87fb01ac8', -- Valley of Vision (newer)
	'a2dfecac-6042-4bad-bd82-ff9a36916e69', -- Holy Spirit (newer)
	'71eef1d9-53b6-4c3b-b941-aaa60f2b1262', -- My Utmost (newer)
	'42174024-10d7-4844-9f37-628d4eec27bc', -- Fellowship (newer)
	'83346d7f-3c3d-4e7a-ac5f-216b51234197'  -- Return of the King (newer)
)
  AND deleted_at IS NULL;
