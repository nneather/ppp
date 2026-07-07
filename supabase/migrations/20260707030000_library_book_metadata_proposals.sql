-- book_metadata_proposals — AI research pass proposals for needs_review books
-- (decision 068). A script (scripts/library-review-research/) looks up Open
-- Library + classifies genre via Anthropic and INSERTs one PENDING proposal
-- per book. The owner accepts/rejects on the /library/review card. Accepting
-- applies fields through the normal reviewSaveAction book UPDATE — this table
-- NEVER clears books.needs_review by itself (064 Q3: owner confirms, always).
--
-- fields JSONB shape (per-field):
--   { "year": { "current": null, "proposed": 1987, "source": "openlibrary", "note": "…" },
--     "genre": { "current": null, "proposed": "Literature", "source": "ai-genre", "note": "…" } }

CREATE TABLE IF NOT EXISTS public.book_metadata_proposals (
	id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	book_id     UUID NOT NULL REFERENCES public.books(id),
	source      TEXT NOT NULL DEFAULT 'mixed'
		CHECK (source IN ('openlibrary', 'ai-genre', 'mixed')),
	fields      JSONB NOT NULL DEFAULT '{}'::jsonb,
	status      TEXT NOT NULL DEFAULT 'pending'
		CHECK (status IN ('pending', 'accepted', 'rejected')),
	reviewed_at TIMESTAMPTZ,
	deleted_at  TIMESTAMPTZ,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_by  UUID REFERENCES public.profiles(id)
);

-- One live pending proposal per book; also serves the hot pending lookup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_book_metadata_proposals_pending
	ON public.book_metadata_proposals (book_id)
	WHERE status = 'pending' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_book_metadata_proposals_book_id
	ON public.book_metadata_proposals (book_id);

-- updated_at + audit triggers (baseline helpers)
DROP TRIGGER IF EXISTS trg_book_metadata_proposals_updated_at ON public.book_metadata_proposals;
CREATE TRIGGER trg_book_metadata_proposals_updated_at
	BEFORE UPDATE ON public.book_metadata_proposals
	FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_book_metadata_proposals ON public.book_metadata_proposals;
CREATE TRIGGER trg_audit_book_metadata_proposals
	AFTER INSERT OR UPDATE OR DELETE ON public.book_metadata_proposals
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

-- RLS — fail closed; helpers only (see 20260413150000)
ALTER TABLE public.book_metadata_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS book_metadata_proposals_owner_all ON public.book_metadata_proposals;
CREATE POLICY book_metadata_proposals_owner_all ON public.book_metadata_proposals
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

DROP POLICY IF EXISTS book_metadata_proposals_select ON public.book_metadata_proposals;
CREATE POLICY book_metadata_proposals_select ON public.book_metadata_proposals
	FOR SELECT USING (public.app_has_module_read('library'));

-- Viewer-write module: separate INSERT / UPDATE policies (FOR ALL blocks
-- some bits-ui read paths — db-changes.mdc).
DROP POLICY IF EXISTS book_metadata_proposals_viewer_insert ON public.book_metadata_proposals;
CREATE POLICY book_metadata_proposals_viewer_insert ON public.book_metadata_proposals
	FOR INSERT WITH CHECK (public.app_is_viewer_writer('library'));

DROP POLICY IF EXISTS book_metadata_proposals_viewer_update ON public.book_metadata_proposals;
CREATE POLICY book_metadata_proposals_viewer_update ON public.book_metadata_proposals
	FOR UPDATE
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

-- PostgREST API grants (explicit grants model — see 039 / 20260528120000)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_metadata_proposals TO authenticated, service_role;
GRANT SELECT ON public.book_metadata_proposals TO anon;
