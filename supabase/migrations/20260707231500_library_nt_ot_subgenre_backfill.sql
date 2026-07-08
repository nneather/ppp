-- =============================================================================
-- Follow-up to 20260707223000: retroactively reclassify the handful of
-- existing plain 'New Testament' / 'Old Testament' books into the new
-- sub-genres where a specific fit is clear (decision 070). Matched by id —
-- these are one-off editorial calls, not a mechanical rule.
--
-- New Testament (3 total): 2 moved to 'Gospels and Jesus' (both about Jesus
-- specifically); 1 left as plain 'New Testament' (Wright's foundational
-- methodology/history volume isn't Gospels-, Epistles-, or Acts-specific).
-- Old Testament (3 total): all 3 moved to 'Old Testament Historical Books'
-- (Israelite history / OT historical-narrative methodology).
-- =============================================================================

UPDATE public.books
SET genre = 'Gospels and Jesus'
WHERE deleted_at IS NULL
	AND id IN (
		'46e2877c-f68d-4175-ae4e-42d2cb1e1a56', -- Jesus and the Eyewitnesses
		'd64fcb6f-44a6-4a0d-a77d-f4096adb1e5b'  -- The Resurrection of the Son of God
	);

UPDATE public.books
SET genre = 'Old Testament Historical Books'
WHERE deleted_at IS NULL
	AND id IN (
		'4f3bb8ef-32ea-459c-8858-32718a21ea09', -- A Biblical History of Israel
		'a71d5b7e-e7f8-4215-b87f-f7b6ca9fcece', -- An Introduction to the Old Testament Historical Books
		'd50b5298-4fb9-411c-b421-1901f26a1cdd'  -- The Art of Biblical History
	);
