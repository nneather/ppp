-- =============================================================================
-- Diagnostic: compute_verse_abs UPDATE-path assertion
-- Filed: 2026-04-28 (Session 2 — scripture references wiring)
--
-- Tracker_1 Session 2 acceptance line: "compute_verse_abs trigger verified on
-- both INSERT and UPDATE paths". The fixture seed exercises the INSERT path
-- implicitly (rows load + search returns correctly bounded results); this
-- file adds the missing explicit UPDATE-path assertion.
--
-- The trigger lives in 00000000000000_baseline.sql; semantics were corrected in
-- 20260429180000_compute_verse_abs_chapter_only_fix.sql so that "chapter only"
-- means that chapter only (was open-ended-to-end-of-book).
--
-- Semantic table the trigger now implements:
--   whole book (chapter_start IS NULL)         → start=0,            end=999999
--   chapter only (cs only, no ce, no verses)   → start=cs*1000,      end=cs*1000+999
--   chapter range (cs+ce, no verses)           → start=cs*1000,      end=ce*1000+999
--   verse only   (cs+vs, no ce)                → start=cs*1000+vs,   end=cs*1000+vs
--   verse range  (cs+vs+ce+ve)                 → start=cs*1000+vs,   end=ce*1000+ve
--
-- "Open-ended from chapter to end-of-book" is intentionally NOT supported
-- without an explicit scope_kind column; for now use chapter_end = (last
-- chapter of the book) when you want that intent.
--
-- HOW TO APPLY:
--   Paste into Studio SQL editor → Run. The whole script is wrapped in a
--   transaction that ROLLBACKs at the end so no fixture rows persist. On
--   success the final NOTICE prints "compute_verse_abs UPDATE-path: PASS".
--   On failure a RAISE EXCEPTION fires inside one of the DO blocks, the
--   transaction aborts, and the message identifies which step mismatched.
--
-- DEPENDENCIES:
--   - At least one row exists in public.books with deleted_at IS NULL.
--     (Smoke seed satisfies this.)
-- =============================================================================

BEGIN;

DO $$
DECLARE
	v_book_id UUID;
	v_ref_id  UUID;
	v_start   INT;
	v_end     INT;
BEGIN
	-- Pick any live book to anchor the polymorphic FK.
	SELECT id INTO v_book_id
	FROM public.books
	WHERE deleted_at IS NULL
	ORDER BY created_at ASC
	LIMIT 1;

	IF v_book_id IS NULL THEN
		RAISE EXCEPTION 'compute_verse_abs diagnostic: no live books found. Run the smoke seed first.';
	END IF;

	-- -------------------------------------------------------------------------
	-- Step 1: INSERT-path baseline. Phil 2:5–11 → 2005..2011.
	-- -------------------------------------------------------------------------
	INSERT INTO public.scripture_references (
		book_id, bible_book, chapter_start, verse_start, chapter_end, verse_end, page_start
	)
	VALUES (v_book_id, 'Philippians', 2, 5, 2, 11, 'diag-fixture')
	RETURNING id, verse_start_abs, verse_end_abs INTO v_ref_id, v_start, v_end;

	IF v_start <> 2005 OR v_end <> 2011 THEN
		RAISE EXCEPTION
			'Step 1 INSERT-path FAIL: expected (2005, 2011), got (%, %)', v_start, v_end;
	END IF;
	RAISE NOTICE 'Step 1 INSERT-path PASS — verse_start_abs=%, verse_end_abs=%', v_start, v_end;

	-- -------------------------------------------------------------------------
	-- Step 2: UPDATE-path on verse_start. Toggle Phil 2:5 → Phil 2:1.
	-- Expected: verse_start_abs recomputes 2005 → 2001.
	-- -------------------------------------------------------------------------
	UPDATE public.scripture_references
	SET verse_start = 1
	WHERE id = v_ref_id
	RETURNING verse_start_abs, verse_end_abs INTO v_start, v_end;

	IF v_start <> 2001 OR v_end <> 2011 THEN
		RAISE EXCEPTION
			'Step 2 UPDATE verse_start FAIL: expected (2001, 2011), got (%, %)', v_start, v_end;
	END IF;
	RAISE NOTICE 'Step 2 UPDATE verse_start PASS — verse_start_abs=%, verse_end_abs=%', v_start, v_end;

	-- -------------------------------------------------------------------------
	-- Step 3: UPDATE-path on chapter_end + verse_end. Phil 2:1–11 → Phil 2:1–3:5.
	-- Expected: verse_end_abs recomputes 2011 → 3005.
	-- -------------------------------------------------------------------------
	UPDATE public.scripture_references
	SET chapter_end = 3, verse_end = 5
	WHERE id = v_ref_id
	RETURNING verse_start_abs, verse_end_abs INTO v_start, v_end;

	IF v_start <> 2001 OR v_end <> 3005 THEN
		RAISE EXCEPTION
			'Step 3 UPDATE chapter_end+verse_end FAIL: expected (2001, 3005), got (%, %)', v_start, v_end;
	END IF;
	RAISE NOTICE 'Step 3 UPDATE chapter_end+verse_end PASS — verse_start_abs=%, verse_end_abs=%', v_start, v_end;

	-- -------------------------------------------------------------------------
	-- Step 4: UPDATE-path collapse to chapter-only. Clear verse_start/end.
	-- Expected: chapter-only semantics → (2000, 2999). chapter_end = 3 must
	-- also be cleared so we land in the "chapter_start only" branch.
	-- -------------------------------------------------------------------------
	UPDATE public.scripture_references
	SET verse_start = NULL, verse_end = NULL, chapter_end = NULL
	WHERE id = v_ref_id
	RETURNING verse_start_abs, verse_end_abs INTO v_start, v_end;

	IF v_start <> 2000 OR v_end <> 2999 THEN
		RAISE EXCEPTION
			'Step 4 UPDATE collapse-to-chapter FAIL: expected (2000, 2999), got (%, %)', v_start, v_end;
	END IF;
	RAISE NOTICE 'Step 4 UPDATE collapse-to-chapter PASS — verse_start_abs=%, verse_end_abs=%', v_start, v_end;

	-- -------------------------------------------------------------------------
	-- Step 5: UPDATE-path chapter-range. Set chapter_end = 3 with no verses.
	-- Expected: chapter-range semantics → (2000, 3999).
	-- -------------------------------------------------------------------------
	UPDATE public.scripture_references
	SET chapter_end = 3
	WHERE id = v_ref_id
	RETURNING verse_start_abs, verse_end_abs INTO v_start, v_end;

	IF v_start <> 2000 OR v_end <> 3999 THEN
		RAISE EXCEPTION
			'Step 5 UPDATE chapter-range FAIL: expected (2000, 3999), got (%, %)', v_start, v_end;
	END IF;
	RAISE NOTICE 'Step 5 UPDATE chapter-range PASS — verse_start_abs=%, verse_end_abs=%', v_start, v_end;

	-- -------------------------------------------------------------------------
	-- Step 6: UPDATE-path collapse to whole-book. Clear chapter_start + chapter_end.
	-- Expected: whole-book semantics → (0, 999999).
	-- -------------------------------------------------------------------------
	UPDATE public.scripture_references
	SET chapter_start = NULL, chapter_end = NULL
	WHERE id = v_ref_id
	RETURNING verse_start_abs, verse_end_abs INTO v_start, v_end;

	IF v_start <> 0 OR v_end <> 999999 THEN
		RAISE EXCEPTION
			'Step 6 UPDATE collapse-to-whole-book FAIL: expected (0, 999999), got (%, %)', v_start, v_end;
	END IF;
	RAISE NOTICE 'Step 6 UPDATE collapse-to-whole-book PASS — verse_start_abs=%, verse_end_abs=%', v_start, v_end;

	RAISE NOTICE 'compute_verse_abs UPDATE-path: PASS (all 6 steps)';
END;
$$;

-- ROLLBACK so the diagnostic fixture row never persists. The transaction
-- already wrote one row + 4 UPDATE audit_log rows; both unwind cleanly.
ROLLBACK;

-- =============================================================================
-- Expected output on success (Studio "Output" pane):
--   NOTICE:  Step 1 INSERT-path PASS — verse_start_abs=2005, verse_end_abs=2011
--   NOTICE:  Step 2 UPDATE verse_start PASS — verse_start_abs=2001, verse_end_abs=2011
--   NOTICE:  Step 3 UPDATE chapter_end+verse_end PASS — verse_start_abs=2001, verse_end_abs=3005
--   NOTICE:  Step 4 UPDATE collapse-to-chapter PASS — verse_start_abs=2000, verse_end_abs=2999
--   NOTICE:  Step 5 UPDATE chapter-range PASS — verse_start_abs=2000, verse_end_abs=3999
--   NOTICE:  Step 6 UPDATE collapse-to-whole-book PASS — verse_start_abs=0, verse_end_abs=999999
--   NOTICE:  compute_verse_abs UPDATE-path: PASS (all 6 steps)
--   ROLLBACK
-- =============================================================================
