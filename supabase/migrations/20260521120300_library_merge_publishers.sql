-- =============================================================================
-- library_merge_publishers — repoint books + child imprints; non-revertible merge audit.
-- =============================================================================

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
		IF TG_TABLE_NAME = 'publishers' THEN
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

CREATE OR REPLACE FUNCTION public.library_merge_publishers(p_canonical uuid, p_merged_away uuid)
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
		RAISE EXCEPTION 'cannot merge a publisher into itself'
			USING ERRCODE = '23514';
	END IF;

	SELECT deleted_at INTO v_canonical_deleted
	FROM public.publishers WHERE id = p_canonical;

	IF NOT FOUND OR v_canonical_deleted IS NOT NULL THEN
		RAISE EXCEPTION 'canonical publisher not found or deleted'
			USING ERRCODE = 'P0002';
	END IF;

	SELECT deleted_at INTO v_merged_deleted
	FROM public.publishers WHERE id = p_merged_away;

	IF NOT FOUND OR v_merged_deleted IS NOT NULL THEN
		RAISE EXCEPTION 'merged-away publisher not found or deleted'
			USING ERRCODE = 'P0002';
	END IF;

	UPDATE public.books
	SET publisher_id = p_canonical
	WHERE publisher_id = p_merged_away;

	UPDATE public.books
	SET reprint_publisher_id = p_canonical
	WHERE reprint_publisher_id = p_merged_away;

	UPDATE public.publishers
	SET parent_id = p_canonical
	WHERE parent_id = p_merged_away
		AND deleted_at IS NULL;

	UPDATE public.publishers
	SET
		merged_into_id = p_canonical,
		deleted_at = now()
	WHERE id = p_merged_away;
END;
$function$;

REVOKE ALL ON FUNCTION public.library_merge_publishers(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.library_merge_publishers(uuid, uuid) TO authenticated;
