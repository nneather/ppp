-- =============================================================================
-- Library publishers — canonical imprints, aliases, default location, parent groups.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.publishers (
	id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	canonical_name   TEXT NOT NULL,
	parent_id        UUID REFERENCES public.publishers (id),
	default_location TEXT,
	aliases          TEXT[] NOT NULL DEFAULT '{}',
	notes            TEXT,
	deleted_at       TIMESTAMPTZ,
	merged_into_id   UUID REFERENCES public.publishers (id),
	created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_by       UUID REFERENCES public.profiles (id)
);

CREATE INDEX IF NOT EXISTS idx_publishers_parent_id
	ON public.publishers (parent_id)
	WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_publishers_merged_into_id
	ON public.publishers (merged_into_id)
	WHERE merged_into_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS publishers_canonical_name_live_uq
	ON public.publishers (canonical_name)
	WHERE deleted_at IS NULL;

COMMENT ON TABLE public.publishers IS
	'Canonical publisher imprints for citations; aliases match OL/raw strings; parent_id groups imprints (IVP Academic → IVP).';

COMMENT ON COLUMN public.publishers.merged_into_id IS
	'When set with deleted_at, row was removed by owner-only merge; audit revert is suppressed.';

ALTER TABLE public.books
	ADD COLUMN IF NOT EXISTS publisher_id UUID REFERENCES public.publishers (id),
	ADD COLUMN IF NOT EXISTS reprint_publisher_id UUID REFERENCES public.publishers (id);

CREATE INDEX IF NOT EXISTS idx_books_publisher_id
	ON public.books (publisher_id)
	WHERE publisher_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_books_reprint_publisher_id
	ON public.books (reprint_publisher_id)
	WHERE reprint_publisher_id IS NOT NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_publishers_updated_at ON public.publishers;
CREATE TRIGGER trg_publishers_updated_at
	BEFORE UPDATE ON public.publishers
	FOR EACH ROW
	EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_publishers ON public.publishers;
CREATE TRIGGER trg_audit_publishers
	AFTER INSERT OR UPDATE OR DELETE ON public.publishers
	FOR EACH ROW
	EXECUTE FUNCTION public.write_audit_log();

ALTER TABLE public.publishers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS publishers_select ON public.publishers;
CREATE POLICY publishers_select ON public.publishers
	FOR SELECT USING (
		auth.uid() IS NOT NULL
		AND (
			public.app_is_owner()
			OR deleted_at IS NULL
		)
	);

DROP POLICY IF EXISTS publishers_owner_all ON public.publishers;
CREATE POLICY publishers_owner_all ON public.publishers
	FOR ALL
	USING (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

DROP POLICY IF EXISTS publishers_viewer_insert ON public.publishers;
CREATE POLICY publishers_viewer_insert ON public.publishers
	FOR INSERT
	WITH CHECK (public.app_is_viewer_writer('library'));

DROP POLICY IF EXISTS publishers_viewer_update ON public.publishers;
CREATE POLICY publishers_viewer_update ON public.publishers
	FOR UPDATE
	USING (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));
