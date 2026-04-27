-- =============================================================================
-- write_audit_log() — handle composite-PK tables (book_authors, book_categories,
-- essay_authors). Baseline assumed every audited table had an `id` column; the
-- three library junction tables don't, which 42703s on every junction write.
--
-- Fix: resolve record_id via JSONB extraction with COALESCE fallback.
--   - Tables with `id` (everything else): record_id = NEW.id  (unchanged)
--   - book_authors / book_categories: record_id = NEW.book_id  (parent book)
--   - essay_authors:                   record_id = NEW.essay_id (parent essay)
--
-- This is the desired audit-log filter UX: filtering by a book's UUID surfaces
-- direct edits AND every junction change attached to that book.
--
-- Idempotent — CREATE OR REPLACE FUNCTION.
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
	ELSIF TG_OP = 'DELETE' THEN
		v_old_data   := to_jsonb(OLD);
		v_new_data   := NULL;
		v_subject    := v_old_data;
		v_revertible := false;
	END IF;

	-- Prefer the row's own id; fall back to parent UUIDs for composite-PK
	-- junction tables. NULL covers tables that have neither (none today).
	v_record_id := COALESCE(
		(v_subject->>'id')::UUID,
		(v_subject->>'book_id')::UUID,
		(v_subject->>'essay_id')::UUID
	);

	IF v_record_id IS NULL THEN
		-- Should not happen for any table currently audited; fail open so a
		-- mis-attached trigger doesn't take down a write.
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
