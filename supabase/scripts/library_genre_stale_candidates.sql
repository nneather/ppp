-- Rows still using legacy short genre labels (audit before renaming).
-- Run in Supabase SQL editor or: psql "$LIBRARY_DST_DATABASE_URL" -f supabase/scripts/library_genre_stale_candidates.sql

SELECT id, title, genre, needs_review, needs_review_note
FROM public.books
WHERE deleted_at IS NULL
	AND genre IN ('General', 'Pastoral')
ORDER BY genre, title;
