-- =============================================================================
-- compute_verse_abs() — chapter-only / chapter-range semantics fix
-- Filed: 2026-04-29 (Session 2 follow-up)
--
-- Surfaced by `supabase/diagnostics/library_compute_verse_abs_update_path.sql`
-- Step 4: a row with chapter_start=2, chapter_end=NULL, no verses produced
-- verse_end_abs=999999 (open-ended through end-of-book) instead of the intended
-- 2999 (chapter 2 only).
--
-- Decision (Session 2 follow-up): chapter_start with no chapter_end / no verses
-- means "that chapter only". Open-ended-from-chapter is intentionally
-- unsupported until/unless we add a separate scope_kind column.
--
-- Semantic table the new function implements:
--   whole-book      : chapter_start IS NULL                                          → 0..999999
--   chapter only    : chapter_start, NOT verse_start, NOT chapter_end                → cs*1000 .. cs*1000+999
--   chapter range   : chapter_start, NOT verse_start, chapter_end, NOT verse_end     → cs*1000 .. ce*1000+999
--   verse only      : chapter_start + verse_start, NOT chapter_end                   → cs*1000+vs .. cs*1000+vs
--   verse range     : chapter_start + verse_start + chapter_end + verse_end          → cs*1000+vs .. ce*1000+ve
--   asymmetric mix  : (e.g. cs+vs but only ce, no ve) we treat as range to end       → cs*1000+vs .. ce*1000+999
--                     (preserves prior behavior; symmetric inputs are the norm)
--
-- Backfill: after replacing the function, run a no-op UPDATE on a trigger
-- column (chapter_start = chapter_start) to fire the BEFORE UPDATE trigger
-- on every live row, recomputing verse_start_abs / verse_end_abs in place.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.compute_verse_abs()
RETURNS TRIGGER AS $$
BEGIN
	-- verse_start_abs: lower bound of the absolute verse range.
	NEW.verse_start_abs := CASE
		WHEN NEW.chapter_start IS NOT NULL AND NEW.verse_start IS NOT NULL
		THEN (NEW.chapter_start * 1000) + NEW.verse_start
		WHEN NEW.chapter_start IS NOT NULL
		THEN NEW.chapter_start * 1000
		ELSE 0
	END;

	-- verse_end_abs: upper bound, with chapter-only / chapter-range semantics fixed.
	NEW.verse_end_abs := CASE
		-- explicit verse-end (whether chapter_end matches or differs)
		WHEN NEW.chapter_end IS NOT NULL AND NEW.verse_end IS NOT NULL
		THEN (NEW.chapter_end * 1000) + NEW.verse_end

		-- chapter_end set without verse_end → through end of that chapter
		WHEN NEW.chapter_end IS NOT NULL
		THEN (NEW.chapter_end * 1000) + 999

		-- single explicit verse, no chapter_end → degenerate range (just that verse)
		WHEN NEW.chapter_start IS NOT NULL AND NEW.verse_start IS NOT NULL
		THEN (NEW.chapter_start * 1000) + NEW.verse_start

		-- chapter_start only, no verse_start, no chapter_end → that chapter only
		-- (was previously 999999; THIS is the bug fix)
		WHEN NEW.chapter_start IS NOT NULL
		THEN (NEW.chapter_start * 1000) + 999

		-- whole-book sentinel
		ELSE 999999
	END;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Backfill: recompute verse_*_abs on every existing row by firing the trigger.
-- A no-op SET on a trigger column (chapter_start) is enough; the BEFORE UPDATE
-- trigger fires regardless and writes the new abs values.
-- Filtered to deleted_at IS NULL by convention (same shape as the loaders).
-- ---------------------------------------------------------------------------
UPDATE public.scripture_references
SET chapter_start = chapter_start
WHERE deleted_at IS NULL;

COMMENT ON FUNCTION public.compute_verse_abs() IS
	'Computes verse_start_abs / verse_end_abs from chapter/verse columns. Chapter-only (no chapter_end) means that chapter only — see 20260429180000 for the fix history.';
