-- library_calvin_cc_imprint_normalize
-- Owner: only owns the Baker 22-vol CC set. Banner Genesis / Eerdmans Psalms 93-150 /
-- CTS 1845 Harmony were erroneous alternate-imprint rows for vols 1, 6, 16 — not
-- separate physical copies. Normalize to Baker Books 1993 and clear shelf flags
-- (soft-delete would leave holes in the 22-vol set).

UPDATE public.books
SET
	publisher = 'Baker Books',
	year = 1993,
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE deleted_at IS NULL
	AND id IN (
		'68e1fe80-b013-428a-ac03-46c07b58f855', -- CC vol 1 Genesis
		'b82e4d27-8ee8-447a-85bd-7632b08d5476', -- CC vol 6 Psalms 93-150
		'bb8ad6fc-c24f-4828-8f14-94139f5d67ef'  -- CC vol 16 Harmony Gospels
	);
