-- =============================================================================
-- pg_trgm + GIN indexes for keyword search across books + people
-- Filed: 2026-04-29 (Session 3 — Faceted Filters + Passage Search UI)
--
-- Backs the keyword search (`?q=…`) on `/library` (Session 3) and the
-- post-Session-4 1,288-row library load. The acceptance bar is "<500ms filter
-- response" (tracker line 162); GIN trigram indexes are the lever that makes
-- ILIKE '%q%' substring search hit indexes instead of seq-scanning every row.
--
-- Three indexes:
--   - books.title       — primary keyword target
--   - books.subtitle    — secondary keyword target
--   - people.last_name  — author keyword target (used via book_authors join in
--                         the filtered list loader)
--
-- All three use `gin_trgm_ops` so PostgREST/Supabase `.ilike('%q%')` filters
-- (which compile to `ILIKE '%q%'`) hit the index. Operator class choice is
-- substring-match-friendly; B-tree wouldn't help here.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_books_title_trgm
	ON public.books USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_books_subtitle_trgm
	ON public.books USING gin (subtitle gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_people_last_name_trgm
	ON public.people USING gin (last_name gin_trgm_ops);
