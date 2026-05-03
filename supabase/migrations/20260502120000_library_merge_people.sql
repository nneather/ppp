-- =============================================================================
-- Session 7 — people merge: merged_into_id, non-revertible merge audit,
-- atomic library_merge_people() RPC (owner-only).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. people.merged_into_id — set only when soft-deleting via merge (Session 7).
-- ---------------------------------------------------------------------------
ALTER TABLE public.people
	ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES public.people (id);

CREATE INDEX IF NOT EXISTS idx_people_merged_into_id
	ON public.people (merged_into_id)
	WHERE merged_into_id IS NOT NULL;

COMMENT ON COLUMN public.people.merged_into_id IS
	'When set with deleted_at, row was removed by owner-only merge into this person; audit revert is suppressed.';

-- ---------------------------------------------------------------------------
-- 2. write_audit_log — merge soft-delete on people is not audit-revertible.
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
-- 3. library_merge_people — atomic repoint + soft-delete merged-away row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.library_merge_people(p_canonical uuid, p_merged_away uuid)
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
		RAISE EXCEPTION 'cannot merge a person into themselves'
			USING ERRCODE = '23514';
	END IF;

	SELECT deleted_at INTO v_canonical_deleted
	FROM public.people WHERE id = p_canonical;

	IF NOT FOUND OR v_canonical_deleted IS NOT NULL THEN
		RAISE EXCEPTION 'canonical person not found or deleted'
			USING ERRCODE = 'P0002';
	END IF;

	SELECT deleted_at INTO v_merged_deleted
	FROM public.people WHERE id = p_merged_away;

	IF NOT FOUND OR v_merged_deleted IS NOT NULL THEN
		RAISE EXCEPTION 'merged-away person not found or deleted'
			USING ERRCODE = 'P0002';
	END IF;

	-- book_authors: PK (book_id, person_id, role)
	DELETE FROM public.book_authors ba
	USING public.book_authors bc
	WHERE ba.person_id = p_merged_away
		AND bc.book_id = ba.book_id
		AND bc.role = ba.role
		AND bc.person_id = p_canonical;

	UPDATE public.book_authors
	SET person_id = p_canonical
	WHERE person_id = p_merged_away;

	-- essay_authors: PK (essay_id, person_id)
	DELETE FROM public.essay_authors ea
	USING public.essay_authors ec
	WHERE ea.person_id = p_merged_away
		AND ec.essay_id = ea.essay_id
		AND ec.person_id = p_canonical;

	UPDATE public.essay_authors
	SET person_id = p_canonical
	WHERE person_id = p_merged_away;

	UPDATE public.people
	SET
		merged_into_id = p_canonical,
		deleted_at = now()
	WHERE id = p_merged_away;
END;
$function$;

REVOKE ALL ON FUNCTION public.library_merge_people(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.library_merge_people(uuid, uuid) TO authenticated;
