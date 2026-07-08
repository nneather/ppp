-- Rows still using legacy short genre labels (audit before renaming).
-- Run in Supabase SQL editor or: psql "$LIBRARY_DST_DATABASE_URL" -f supabase/scripts/library_genre_stale_candidates.sql
--
-- 'Pastoral' was resolved by the 2026-07-07 taxonomy audit (decision 069):
-- merged into 'Pastoral Ministry' via migration 20260707220000. 'General' was
-- reviewed and kept — real content (general secular nonfiction) doesn't match
-- either candidate rename target from decision 018, so it stays its own genre.

SELECT id, title, genre, needs_review, needs_review_note
FROM public.books
WHERE deleted_at IS NULL
	AND genre IN ('General')
ORDER BY genre, title;
