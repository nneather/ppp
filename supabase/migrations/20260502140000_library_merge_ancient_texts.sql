-- =============================================================================
-- Session 7b — ancient_texts soft-delete + merge, non-revertible audit for merge
-- coverage repoints, library_merge_ancient_texts RPC (owner-only).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ancient_texts — soft-delete + merge target (mirrors people Session 7)
-- ---------------------------------------------------------------------------
ALTER TABLE public.ancient_texts
	ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.ancient_texts
	ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES public.ancient_texts (id);

CREATE INDEX IF NOT EXISTS idx_ancient_texts_merged_into_id
	ON public.ancient_texts (merged_into_id)
	WHERE merged_into_id IS NOT NULL;

COMMENT ON COLUMN public.ancient_texts.merged_into_id IS
	'When set with deleted_at, row was removed by owner-only merge into this ancient_text; audit revert is suppressed.';

-- Replace global UNIQUE(canonical_name) with partial unique so merged-away names
-- do not block re-creating a canonical row.
ALTER TABLE public.ancient_texts
	DROP CONSTRAINT IF EXISTS ancient_texts_canonical_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS ancient_texts_canonical_name_live_uq
	ON public.ancient_texts (canonical_name)
	WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. write_audit_log — merge soft-delete on ancient_texts; merge repoints on
--    book_ancient_coverage (transaction-local GUC set by merge RPC).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
	v_record_id  UUID;
	v_old_data   JSONB;
	v_new_data   JSONB;
	v_subject    JSONB;
	v_revertible BOOLEAN;
	v_merge_cov  TEXT;
BEGIN
	IF TG_OP = 'INSERT' THEN
		v_new_data   := to_jsonb(NEW);
		v_old_data   := NULL;
		v_subject    := v_new_data;
		v_revertible := true;
	ELSIF TG_OP = 'UPDATE' THEN
		v_old_data   := to_jsonb(OLD);
		v_new_data   := to_jsonb(NEW);
		v_subject    := v_new_data;
		v_revertible := true;
		IF TG_TABLE_NAME = 'invoices' THEN
			IF NEW.status IN ('sent','paid')
			   AND OLD.status IS DISTINCT FROM NEW.status THEN
				v_revertible := false;
			END IF;
		END IF;
		IF TG_TABLE_NAME = 'people' THEN
			IF OLD.deleted_at IS NULL
			   AND NEW.deleted_at IS NOT NULL
			   AND NEW.merged_into_id IS NOT NULL THEN
				v_revertible := false;
			END IF;
		END IF;
		IF TG_TABLE_NAME = 'ancient_texts' THEN
			IF OLD.deleted_at IS NULL
			   AND NEW.deleted_at IS NOT NULL
			   AND NEW.merged_into_id IS NOT NULL THEN
				v_revertible := false;
			END IF;
		END IF;
		IF TG_TABLE_NAME = 'book_ancient_coverage' THEN
			v_merge_cov := COALESCE(current_setting('app.library_merge_ancient', true), '');
			IF OLD.ancient_text_id IS DISTINCT FROM NEW.ancient_text_id
			   AND v_merge_cov = 'true' THEN
				v_revertible := false;
			END IF;
		END IF;
	ELSIF TG_OP = 'DELETE' THEN
		v_old_data   := to_jsonb(OLD);
		v_new_data   := NULL;
		v_subject    := v_old_data;
		v_revertible := false;
	END IF;

	v_record_id := COALESCE(
		(v_subject->>'id')::UUID,
		(v_subject->>'book_id')::UUID,
		(v_subject->>'essay_id')::UUID
	);

	IF v_record_id IS NULL THEN
		RETURN COALESCE(NEW, OLD);
	END IF;

	INSERT INTO public.audit_log (
		table_name, record_id, operation,
		old_data, new_data, changed_by, changed_at, revertible
	) VALUES (
		TG_TABLE_NAME, v_record_id, TG_OP,
		v_old_data, v_new_data, auth.uid(), now(), v_revertible
	);

	IF TG_OP = 'DELETE' THEN
		RETURN OLD;
	ELSE
		RETURN NEW;
	END IF;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. library_merge_ancient_texts — repoint coverage + soft-delete merged-away
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.library_merge_ancient_texts(p_canonical uuid, p_merged_away uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
	v_canonical_deleted timestamptz;
	v_merged_deleted    timestamptz;
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM public.profiles p
		WHERE p.id = auth.uid() AND p.role = 'owner'
	) THEN
		RAISE EXCEPTION 'merge requires owner role'
			USING ERRCODE = '42501';
	END IF;

	IF p_canonical IS NULL OR p_merged_away IS NULL THEN
		RAISE EXCEPTION 'canonical and merged_away ids are required'
			USING ERRCODE = '23502';
	END IF;

	IF p_canonical = p_merged_away THEN
		RAISE EXCEPTION 'cannot merge an ancient text into itself'
			USING ERRCODE = '23514';
	END IF;

	SELECT deleted_at INTO v_canonical_deleted
	FROM public.ancient_texts WHERE id = p_canonical;

	IF NOT FOUND OR v_canonical_deleted IS NOT NULL THEN
		RAISE EXCEPTION 'canonical ancient text not found or deleted'
			USING ERRCODE = 'P0002';
	END IF;

	SELECT deleted_at INTO v_merged_deleted
	FROM public.ancient_texts WHERE id = p_merged_away;

	IF NOT FOUND OR v_merged_deleted IS NOT NULL THEN
		RAISE EXCEPTION 'merged-away ancient text not found or deleted'
			USING ERRCODE = 'P0002';
	END IF;

	PERFORM set_config('app.library_merge_ancient', 'true', true);

	-- Drop merged-away coverage rows where canonical already covers the same parent.
	DELETE FROM public.book_ancient_coverage bac
	USING public.book_ancient_coverage bc
	WHERE bac.ancient_text_id = p_merged_away
		AND bc.ancient_text_id = p_canonical
		AND bac.book_id IS NOT DISTINCT FROM bc.book_id
		AND bac.essay_id IS NOT DISTINCT FROM bc.essay_id;

	UPDATE public.book_ancient_coverage
	SET ancient_text_id = p_canonical
	WHERE ancient_text_id = p_merged_away;

	-- Remove duplicate canonical rows for the same polymorphic parent (if any).
	DELETE FROM public.book_ancient_coverage a
	USING public.book_ancient_coverage b
	WHERE a.id > b.id
		AND a.ancient_text_id = p_canonical
		AND b.ancient_text_id = p_canonical
		AND a.book_id IS NOT DISTINCT FROM b.book_id
		AND a.essay_id IS NOT DISTINCT FROM b.essay_id;

	PERFORM set_config('app.library_merge_ancient', 'false', true);

	UPDATE public.ancient_texts
	SET
		merged_into_id = p_canonical,
		deleted_at = now()
	WHERE id = p_merged_away;
END;
$function$;

REVOKE ALL ON FUNCTION public.library_merge_ancient_texts(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.library_merge_ancient_texts(uuid, uuid) TO authenticated;

-- Tighten SELECT: hide soft-deleted rows from non-owners (viewers still need live list).
DROP POLICY IF EXISTS ancient_texts_select ON public.ancient_texts;
CREATE POLICY ancient_texts_select ON public.ancient_texts
	FOR SELECT USING (
		auth.uid() IS NOT NULL
		AND (
			public.app_is_owner()
			OR deleted_at IS NULL
		)
	);
