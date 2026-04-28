-- =============================================================================
-- Diagnostic: why is the Authors column blank in /library?
-- Filed: 2026-04-28 (Session 1.5c)
--
-- Three queries that pinpoint which of the three failure modes is in play:
--   1. Junction rows weren't created (smoke seed silently aborted in Studio).
--   2. Junction rows exist but reference people whose `deleted_at IS NOT NULL`,
--      and `loadPeople` filters them out → authors_label = null in the loader.
--   3. Junction rows exist with valid people, but loader / UI is dropping them
--      somewhere unexpected (rarer; would need server-side logging to chase).
--
-- Paste each block into the Studio SQL editor (Database → SQL Editor → New
-- query → paste → Run). Read the row counts / sample rows against the inline
-- expectations and report back the deltas.
--
-- HOW TO APPLY: read-only diagnostic; safe to run anytime, no side effects.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Q1: Are the books, people, and junctions there at all?
-- ---------------------------------------------------------------------------
SELECT
	(SELECT COUNT(*) FROM public.books WHERE deleted_at IS NULL)  AS book_count,
	(SELECT COUNT(*) FROM public.people)                            AS people_count,
	(SELECT COUNT(*) FROM public.people WHERE deleted_at IS NULL)   AS people_active_count,
	(SELECT COUNT(*) FROM public.book_authors)                      AS junction_count;
-- Expected after running supabase/seed/library_smoke_data.sql:
--   book_count = 15 (or close — depends on what you've added/deleted in the UI)
--   people_count = 13 (Bauckham + Wright + Childs + Wallace + Calvin + Battles
--                      + McNeill + Carson + Schreiner + Bock + Moo + Hurtado + Beale)
--   people_active_count = people_count   (no people should have deleted_at set yet)
--   junction_count >= 18 (15 main authors + Calvin's editor + translator + the
--                         second author on Carson + Moo NT Intro)
--
-- Diagnostics:
--   - junction_count = 0 → smoke seed didn't actually insert junctions; re-paste
--     the file in Studio and watch for any error (failed transaction will
--     silently roll back the whole thing).
--   - people_active_count < people_count → some people have deleted_at populated;
--     loadPeople filters them out. See Q2 to identify which ones; fix below.


-- ---------------------------------------------------------------------------
-- Q2: Per-book listing — who's attached to what, and is the person active?
-- ---------------------------------------------------------------------------
SELECT
	b.title,
	p.first_name,
	p.last_name,
	p.deleted_at AS person_deleted_at,
	ba.role,
	ba.sort_order
FROM public.book_authors ba
JOIN public.books  b ON b.id = ba.book_id
JOIN public.people p ON p.id = ba.person_id
WHERE b.deleted_at IS NULL
ORDER BY b.title, ba.sort_order;
-- Expected: ~18 rows showing each book + author/editor/translator combo,
-- with person_deleted_at = NULL for every row.
--
-- Diagnostics:
--   - 0 rows → no junctions exist; jump back to Q1 expectation.
--   - person_deleted_at column has values → loadPeople drops those rows.
--     Fix: UPDATE public.people SET deleted_at = NULL WHERE deleted_at IS NOT NULL;
--     (only if you didn't intentionally soft-delete anyone — confirm first.)


-- ---------------------------------------------------------------------------
-- Q3: Orphan check — junctions that point at missing or soft-deleted people
-- ---------------------------------------------------------------------------
SELECT
	b.title,
	ba.person_id,
	p.first_name,
	p.last_name,
	p.deleted_at
FROM public.book_authors ba
JOIN public.books b ON b.id = ba.book_id
LEFT JOIN public.people p ON p.id = ba.person_id
WHERE b.deleted_at IS NULL
	AND (p.id IS NULL OR p.deleted_at IS NOT NULL);
-- Expected: 0 rows.
--
-- Diagnostics:
--   - Any rows here → the junction's person_id either references a row that
--     no longer exists (FK should prevent this; would mean direct DB tampering)
--     or references a soft-deleted person. Either way, loadPeople won't surface
--     them, so authors_label is null.
--   - Fix the soft-deleted-person case as in Q2.

-- =============================================================================
-- After running, report back:
--   - the four counts from Q1
--   - approx number of rows in Q2 + whether person_deleted_at was ever populated
--   - row count from Q3 (should be 0)
-- =============================================================================
