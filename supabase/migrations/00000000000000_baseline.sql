-- =============================================================================
-- ppp — Baseline migration
-- Source: POS_Schema_v1.md + live function bodies (session 2 audit)
-- Generated: 2026-04-13
--
-- Creates all public-schema objects from scratch:
--   tables, indexes, sequences, functions, triggers, RLS policies
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Sequences
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

-- ---------------------------------------------------------------------------
-- 2. Utility functions
-- ---------------------------------------------------------------------------

-- 2a. updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
	NEW.updated_at = now();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2b. Invoice number generator
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT AS $$
	SELECT 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_number_seq')::TEXT, 4, '0');
$$ LANGUAGE sql;

-- 2c. RLS helper: is the current user an owner?
CREATE OR REPLACE FUNCTION public.app_is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.profiles p
		WHERE p.id = auth.uid()
			AND p.role = 'owner'
			AND p.deleted_at IS NULL
	);
$$;

-- 2d. RLS helper: is the current user a viewer with write access on a module?
CREATE OR REPLACE FUNCTION public.app_is_viewer_writer(p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.profiles p
		JOIN public.user_permissions up ON up.user_id = p.id
		WHERE p.id = auth.uid()
			AND p.role = 'viewer'
			AND p.deleted_at IS NULL
			AND up.module = p_module
			AND up.access_level = 'write'
	);
$$;

-- 2e. Audit log writer (fires on all tables)
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
	v_revertible BOOLEAN;
BEGIN
	IF TG_OP = 'INSERT' THEN
		v_record_id  := NEW.id;
		v_new_data   := to_jsonb(NEW);
		v_old_data   := NULL;
		v_revertible := true;

	ELSIF TG_OP = 'UPDATE' THEN
		v_record_id  := NEW.id;
		v_old_data   := to_jsonb(OLD);
		v_new_data   := to_jsonb(NEW);
		v_revertible := true;
		IF TG_TABLE_NAME = 'invoices' THEN
			IF NEW.status IN ('sent', 'paid')
				AND OLD.status IS DISTINCT FROM NEW.status
			THEN
				v_revertible := false;
			END IF;
		END IF;

	ELSIF TG_OP = 'DELETE' THEN
		v_record_id  := OLD.id;
		v_old_data   := to_jsonb(OLD);
		v_new_data   := NULL;
		v_revertible := false;
	END IF;

	INSERT INTO public.audit_log (
		table_name,
		record_id,
		operation,
		old_data,
		new_data,
		changed_by,
		changed_at,
		revertible
	) VALUES (
		TG_TABLE_NAME,
		v_record_id,
		TG_OP,
		v_old_data,
		v_new_data,
		auth.uid(),
		now(),
		v_revertible
	);

	IF TG_OP = 'DELETE' THEN
		RETURN OLD;
	ELSE
		RETURN NEW;
	END IF;
END;
$function$;

-- 2d. Invoice-only: set revertible false on status transition
CREATE OR REPLACE FUNCTION public.set_revertible_false()
RETURNS TRIGGER AS $$
BEGIN
	IF NEW.status IN ('sent', 'paid') AND OLD.status IS DISTINCT FROM NEW.status THEN
		PERFORM set_config('app.force_non_revertible', 'true', true);
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2e. Scripture reference absolute verse computation
CREATE OR REPLACE FUNCTION public.compute_verse_abs()
RETURNS TRIGGER AS $$
BEGIN
	NEW.verse_start_abs := CASE
		WHEN NEW.chapter_start IS NOT NULL AND NEW.verse_start IS NOT NULL
		THEN (NEW.chapter_start * 1000) + NEW.verse_start
		WHEN NEW.chapter_start IS NOT NULL
		THEN NEW.chapter_start * 1000
		ELSE 0
	END;
	NEW.verse_end_abs := CASE
		WHEN NEW.chapter_end IS NOT NULL AND NEW.verse_end IS NOT NULL
		THEN (NEW.chapter_end * 1000) + NEW.verse_end
		WHEN NEW.chapter_end IS NOT NULL
		THEN (NEW.chapter_end * 1000) + 999
		WHEN NEW.chapter_start IS NOT NULL AND NEW.verse_start IS NOT NULL
		THEN (NEW.chapter_start * 1000) + NEW.verse_start
		ELSE 999999
	END;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 3. Tables — Core
-- ---------------------------------------------------------------------------

-- profiles (mirrors auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
	id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
	email      TEXT NOT NULL,
	full_name  TEXT,
	role       TEXT NOT NULL CHECK (role IN ('owner', 'viewer')) DEFAULT 'owner',
	deleted_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_permissions
CREATE TABLE IF NOT EXISTS public.user_permissions (
	id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id      UUID NOT NULL REFERENCES public.profiles(id),
	module       TEXT NOT NULL,
	access_level TEXT NOT NULL CHECK (access_level IN ('none', 'read', 'write')),
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (user_id, module)
);

-- audit_log (append-only)
CREATE TABLE IF NOT EXISTS public.audit_log (
	id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	table_name  TEXT NOT NULL,
	record_id   UUID NOT NULL,
	operation   TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
	old_data    JSONB,
	new_data    JSONB,
	changed_by  UUID REFERENCES public.profiles(id),
	changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
	revertible  BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON public.audit_log (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id  ON public.audit_log (record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON public.audit_log (changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON public.audit_log (changed_at DESC);

-- module_registry
CREATE TABLE IF NOT EXISTS public.module_registry (
	id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	slug       TEXT NOT NULL UNIQUE,
	label      TEXT NOT NULL,
	icon       TEXT,
	sort_order INT NOT NULL DEFAULT 0,
	is_active  BOOLEAN NOT NULL DEFAULT true,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 4. Tables — Invoicing
-- ---------------------------------------------------------------------------

-- clients
CREATE TABLE IF NOT EXISTS public.clients (
	id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name            TEXT NOT NULL,
	email           TEXT,
	billing_contact TEXT,
	deleted_at      TIMESTAMPTZ,
	created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_by      UUID REFERENCES public.profiles(id)
);

-- client_rates
CREATE TABLE IF NOT EXISTS public.client_rates (
	id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	client_id      UUID NOT NULL REFERENCES public.clients(id),
	service_type   TEXT,
	rate           NUMERIC(10,2) NOT NULL,
	effective_from DATE NOT NULL,
	effective_to   DATE,
	deleted_at     TIMESTAMPTZ,
	created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_by     UUID REFERENCES public.profiles(id)
);

-- invoices (created before time_entries so FK works)
CREATE TABLE IF NOT EXISTS public.invoices (
	id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	client_id      UUID NOT NULL REFERENCES public.clients(id),
	invoice_number TEXT NOT NULL UNIQUE,
	period_start   DATE NOT NULL,
	period_end     DATE NOT NULL,
	status         TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'paid')) DEFAULT 'draft',
	subtotal       NUMERIC(10,2),
	total          NUMERIC(10,2),
	notes          TEXT,
	sent_at        TIMESTAMPTZ,
	paid_at        TIMESTAMPTZ,
	deleted_at     TIMESTAMPTZ,
	created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_by     UUID REFERENCES public.profiles(id)
);

-- time_entries
CREATE TABLE IF NOT EXISTS public.time_entries (
	id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	client_id   UUID NOT NULL REFERENCES public.clients(id),
	date        DATE NOT NULL,
	hours       NUMERIC(5,2) NOT NULL,
	rate        NUMERIC(10,2) NOT NULL,
	description TEXT,
	billable    BOOLEAN NOT NULL DEFAULT true,
	invoice_id  UUID REFERENCES public.invoices(id),
	deleted_at  TIMESTAMPTZ,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_by  UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_time_entries_client_invoice
	ON public.time_entries (client_id, invoice_id);

-- invoice_line_items
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
	id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	invoice_id  UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
	description TEXT NOT NULL,
	quantity    NUMERIC(5,2),
	unit_price  NUMERIC(10,2),
	total       NUMERIC(10,2) NOT NULL,
	is_one_off  BOOLEAN NOT NULL DEFAULT false,
	sort_order  INT NOT NULL DEFAULT 0,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_by  UUID REFERENCES public.profiles(id)
);

-- ---------------------------------------------------------------------------
-- 5. Tables — Library
-- ---------------------------------------------------------------------------

-- bible_books (reference)
CREATE TABLE IF NOT EXISTS public.bible_books (
	id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name       TEXT NOT NULL UNIQUE,
	testament  TEXT NOT NULL CHECK (testament IN ('OT', 'NT')),
	sort_order INT NOT NULL
);

-- ancient_texts
CREATE TABLE IF NOT EXISTS public.ancient_texts (
	id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	canonical_name TEXT NOT NULL UNIQUE,
	abbreviations  TEXT[],
	category       TEXT,
	created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_by     UUID REFERENCES public.profiles(id)
);

-- people
CREATE TABLE IF NOT EXISTS public.people (
	id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	first_name TEXT,
	last_name  TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_by UUID REFERENCES public.profiles(id)
);

-- series
CREATE TABLE IF NOT EXISTS public.series (
	id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name         TEXT NOT NULL,
	abbreviation TEXT,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_by   UUID REFERENCES public.profiles(id)
);

-- categories (reference)
CREATE TABLE IF NOT EXISTS public.categories (
	id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name       TEXT NOT NULL UNIQUE,
	slug       TEXT NOT NULL UNIQUE,
	sort_order INT NOT NULL DEFAULT 0
);

-- books
CREATE TABLE IF NOT EXISTS public.books (
	id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	title               TEXT NOT NULL,
	subtitle            TEXT,
	publisher           TEXT,
	publisher_location  TEXT,
	year                INT,
	edition             TEXT,
	total_volumes       INT,
	original_year       INT,
	reprint_publisher   TEXT,
	reprint_location    TEXT,
	reprint_year        INT,
	primary_category_id UUID NOT NULL REFERENCES public.categories(id),
	series_id           UUID REFERENCES public.series(id),
	volume_number       TEXT,
	genre               TEXT NOT NULL,
	language            TEXT NOT NULL CHECK (language IN (
		'english','greek','hebrew','latin','german','chinese','other'
	)) DEFAULT 'english',
	isbn                TEXT,
	barcode             TEXT,
	shelving_location   TEXT,
	reading_status      TEXT NOT NULL CHECK (reading_status IN (
		'unread','in_progress','read','reference','n_a'
	)) DEFAULT 'unread',
	borrowed_to         TEXT,
	personal_notes      TEXT,
	rating              INT CHECK (rating BETWEEN 1 AND 5),
	needs_review        BOOLEAN NOT NULL DEFAULT false,
	deleted_at          TIMESTAMPTZ,
	created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_by          UUID REFERENCES public.profiles(id)
);

-- book_authors (junction)
CREATE TABLE IF NOT EXISTS public.book_authors (
	book_id    UUID NOT NULL REFERENCES public.books(id),
	person_id  UUID NOT NULL REFERENCES public.people(id),
	role       TEXT NOT NULL CHECK (role IN ('author', 'editor', 'translator')),
	sort_order INT NOT NULL DEFAULT 0,
	PRIMARY KEY (book_id, person_id, role)
);

-- book_categories (junction)
CREATE TABLE IF NOT EXISTS public.book_categories (
	book_id     UUID NOT NULL REFERENCES public.books(id),
	category_id UUID NOT NULL REFERENCES public.categories(id),
	PRIMARY KEY (book_id, category_id)
);

-- essays
CREATE TABLE IF NOT EXISTS public.essays (
	id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	essay_title    TEXT NOT NULL,
	parent_book_id UUID NOT NULL REFERENCES public.books(id),
	page_start     INT,
	page_end       INT,
	deleted_at     TIMESTAMPTZ,
	created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_by     UUID REFERENCES public.profiles(id)
);

-- essay_authors (junction)
CREATE TABLE IF NOT EXISTS public.essay_authors (
	essay_id   UUID NOT NULL REFERENCES public.essays(id),
	person_id  UUID NOT NULL REFERENCES public.people(id),
	role       TEXT NOT NULL CHECK (role IN ('author')),
	sort_order INT NOT NULL DEFAULT 0,
	PRIMARY KEY (essay_id, person_id)
);

-- book_bible_coverage
CREATE TABLE IF NOT EXISTS public.book_bible_coverage (
	id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	book_id    UUID REFERENCES public.books(id),
	essay_id   UUID REFERENCES public.essays(id),
	bible_book TEXT NOT NULL REFERENCES public.bible_books(name),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_by UUID REFERENCES public.profiles(id),
	UNIQUE (book_id, bible_book),
	UNIQUE (essay_id, bible_book),
	CHECK (
		(book_id IS NOT NULL AND essay_id IS NULL) OR
		(book_id IS NULL AND essay_id IS NOT NULL)
	)
);

-- book_ancient_coverage
CREATE TABLE IF NOT EXISTS public.book_ancient_coverage (
	id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	book_id         UUID REFERENCES public.books(id),
	essay_id        UUID REFERENCES public.essays(id),
	ancient_text_id UUID NOT NULL REFERENCES public.ancient_texts(id),
	created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_by      UUID REFERENCES public.profiles(id),
	CHECK (
		(book_id IS NOT NULL AND essay_id IS NULL) OR
		(book_id IS NULL AND essay_id IS NOT NULL)
	)
);

-- scripture_references
CREATE TABLE IF NOT EXISTS public.scripture_references (
	id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	book_id          UUID REFERENCES public.books(id),
	essay_id         UUID REFERENCES public.essays(id),
	bible_book       TEXT NOT NULL REFERENCES public.bible_books(name),
	chapter_start    INT,
	verse_start      INT,
	chapter_end      INT,
	verse_end        INT,
	verse_start_abs  INT,
	verse_end_abs    INT,
	page_start       TEXT NOT NULL,
	page_end         TEXT,
	confidence_score NUMERIC(3,2),
	needs_review     BOOLEAN NOT NULL DEFAULT false,
	review_note      TEXT,
	source_image_url TEXT,
	deleted_at       TIMESTAMPTZ,
	created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_by       UUID REFERENCES public.profiles(id),
	CHECK (
		(book_id IS NOT NULL AND essay_id IS NULL) OR
		(book_id IS NULL AND essay_id IS NOT NULL)
	)
);

CREATE INDEX IF NOT EXISTS idx_scripture_refs_overlap
	ON public.scripture_references (bible_book, verse_start_abs, verse_end_abs);

-- book_topics
CREATE TABLE IF NOT EXISTS public.book_topics (
	id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	book_id          UUID REFERENCES public.books(id),
	essay_id         UUID REFERENCES public.essays(id),
	topic            TEXT NOT NULL CHECK (topic = lower(trim(topic))),
	page_start       TEXT NOT NULL,
	page_end         TEXT,
	confidence_score NUMERIC(3,2),
	needs_review     BOOLEAN NOT NULL DEFAULT false,
	review_note      TEXT,
	source_image_url TEXT,
	deleted_at       TIMESTAMPTZ,
	created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_by       UUID REFERENCES public.profiles(id),
	CHECK (
		(book_id IS NOT NULL AND essay_id IS NULL) OR
		(book_id IS NULL AND essay_id IS NOT NULL)
	)
);

-- ---------------------------------------------------------------------------
-- 6. Triggers — updated_at
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_profiles_updated_at
	BEFORE UPDATE ON public.profiles
	FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_user_permissions_updated_at
	BEFORE UPDATE ON public.user_permissions
	FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_clients_updated_at
	BEFORE UPDATE ON public.clients
	FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_client_rates_updated_at
	BEFORE UPDATE ON public.client_rates
	FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_time_entries_updated_at
	BEFORE UPDATE ON public.time_entries
	FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_invoices_updated_at
	BEFORE UPDATE ON public.invoices
	FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_ancient_texts_updated_at
	BEFORE UPDATE ON public.ancient_texts
	FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_people_updated_at
	BEFORE UPDATE ON public.people
	FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_series_updated_at
	BEFORE UPDATE ON public.series
	FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_books_updated_at
	BEFORE UPDATE ON public.books
	FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_essays_updated_at
	BEFORE UPDATE ON public.essays
	FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_scripture_references_updated_at
	BEFORE UPDATE ON public.scripture_references
	FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_book_topics_updated_at
	BEFORE UPDATE ON public.book_topics
	FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Triggers — audit log
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_audit_profiles
	AFTER INSERT OR UPDATE OR DELETE ON public.profiles
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_user_permissions
	AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_clients
	AFTER INSERT OR UPDATE OR DELETE ON public.clients
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_client_rates
	AFTER INSERT OR UPDATE OR DELETE ON public.client_rates
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_time_entries
	AFTER INSERT OR UPDATE OR DELETE ON public.time_entries
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_invoices
	AFTER INSERT OR UPDATE OR DELETE ON public.invoices
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_invoice_line_items
	AFTER INSERT OR UPDATE OR DELETE ON public.invoice_line_items
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_ancient_texts
	AFTER INSERT OR UPDATE OR DELETE ON public.ancient_texts
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_people
	AFTER INSERT OR UPDATE OR DELETE ON public.people
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_series
	AFTER INSERT OR UPDATE OR DELETE ON public.series
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_books
	AFTER INSERT OR UPDATE OR DELETE ON public.books
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_book_authors
	AFTER INSERT OR UPDATE OR DELETE ON public.book_authors
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_book_categories
	AFTER INSERT OR UPDATE OR DELETE ON public.book_categories
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_essays
	AFTER INSERT OR UPDATE OR DELETE ON public.essays
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_essay_authors
	AFTER INSERT OR UPDATE OR DELETE ON public.essay_authors
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_book_bible_coverage
	AFTER INSERT OR UPDATE OR DELETE ON public.book_bible_coverage
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_book_ancient_coverage
	AFTER INSERT OR UPDATE OR DELETE ON public.book_ancient_coverage
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_scripture_references
	AFTER INSERT OR UPDATE OR DELETE ON public.scripture_references
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_book_topics
	AFTER INSERT OR UPDATE OR DELETE ON public.book_topics
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

-- ---------------------------------------------------------------------------
-- 8. Triggers — domain-specific
-- ---------------------------------------------------------------------------

-- Invoice status → revertible = false (belt-and-suspenders with write_audit_log)
CREATE TRIGGER set_revertible_false
	BEFORE UPDATE OF status ON public.invoices
	FOR EACH ROW EXECUTE FUNCTION public.set_revertible_false();

COMMENT ON TRIGGER set_revertible_false ON public.invoices IS
	'Invoice-only: references NEW/OLD.status. Must not be attached to time_entries.';

-- Scripture reference verse abs computation
CREATE TRIGGER trg_compute_verse_abs
	BEFORE INSERT OR UPDATE OF chapter_start, verse_start, chapter_end, verse_end
	ON public.scripture_references
	FOR EACH ROW EXECUTE FUNCTION public.compute_verse_abs();

-- ---------------------------------------------------------------------------
-- 9. Grants
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_is_viewer_writer(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 10. Row Level Security
-- ---------------------------------------------------------------------------

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_owner_all ON public.profiles
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

CREATE POLICY profiles_viewer_select ON public.profiles
	FOR SELECT USING (id = auth.uid());

-- user_permissions
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_permissions_owner_all ON public.user_permissions
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

CREATE POLICY user_permissions_viewer_select ON public.user_permissions
	FOR SELECT USING (user_id = auth.uid());

-- audit_log (owner only)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_owner_all ON public.audit_log
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- module_registry (all authenticated SELECT)
ALTER TABLE public.module_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY module_registry_select ON public.module_registry
	FOR SELECT USING (auth.uid() IS NOT NULL);

-- clients (owner only)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY clients_owner_all ON public.clients
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- client_rates (owner only)
ALTER TABLE public.client_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_rates_owner_all ON public.client_rates
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- time_entries (owner only)
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY time_entries_owner_all ON public.time_entries
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- invoices (owner only)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_owner_all ON public.invoices
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- invoice_line_items (owner only)
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_line_items_owner_all ON public.invoice_line_items
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- bible_books (all authenticated SELECT)
ALTER TABLE public.bible_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY bible_books_select ON public.bible_books
	FOR SELECT USING (auth.uid() IS NOT NULL);

-- ancient_texts (all SELECT; owner INSERT/UPDATE)
ALTER TABLE public.ancient_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY ancient_texts_select ON public.ancient_texts
	FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY ancient_texts_owner_insert ON public.ancient_texts
	FOR INSERT
	WITH CHECK (public.app_is_owner());

CREATE POLICY ancient_texts_owner_update ON public.ancient_texts
	FOR UPDATE
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- people (all SELECT; owner + viewer(write) full)
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

CREATE POLICY people_select ON public.people
	FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY people_owner_all ON public.people
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

CREATE POLICY people_viewer_write ON public.people
	FOR ALL
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

-- series (same as people)
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;

CREATE POLICY series_select ON public.series
	FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY series_owner_all ON public.series
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

CREATE POLICY series_viewer_write ON public.series
	FOR ALL
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

-- categories (all authenticated SELECT)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_select ON public.categories
	FOR SELECT USING (auth.uid() IS NOT NULL);

-- books (owner full; viewer SELECT + INSERT + UPDATE)
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

CREATE POLICY books_owner_all ON public.books
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

CREATE POLICY books_viewer_select ON public.books
	FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY books_viewer_insert ON public.books
	FOR INSERT
	WITH CHECK (public.app_is_viewer_writer('library'));

CREATE POLICY books_viewer_update ON public.books
	FOR UPDATE
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

-- book_authors (owner + viewer(write) full)
ALTER TABLE public.book_authors ENABLE ROW LEVEL SECURITY;

CREATE POLICY book_authors_owner_all ON public.book_authors
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

CREATE POLICY book_authors_viewer_write ON public.book_authors
	FOR ALL
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

-- book_categories (owner + viewer(write) full)
ALTER TABLE public.book_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY book_categories_owner_all ON public.book_categories
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

CREATE POLICY book_categories_viewer_write ON public.book_categories
	FOR ALL
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

-- essays (owner full; viewer SELECT)
ALTER TABLE public.essays ENABLE ROW LEVEL SECURITY;

CREATE POLICY essays_owner_all ON public.essays
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

CREATE POLICY essays_viewer_select ON public.essays
	FOR SELECT USING (auth.uid() IS NOT NULL);

-- essay_authors (owner full; viewer SELECT)
ALTER TABLE public.essay_authors ENABLE ROW LEVEL SECURITY;

CREATE POLICY essay_authors_owner_all ON public.essay_authors
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

CREATE POLICY essay_authors_viewer_select ON public.essay_authors
	FOR SELECT USING (auth.uid() IS NOT NULL);

-- book_bible_coverage (owner + viewer(write) full)
ALTER TABLE public.book_bible_coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY book_bible_coverage_owner_all ON public.book_bible_coverage
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

CREATE POLICY book_bible_coverage_viewer_write ON public.book_bible_coverage
	FOR ALL
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

-- book_ancient_coverage (owner + viewer(write) full)
ALTER TABLE public.book_ancient_coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY book_ancient_coverage_owner_all ON public.book_ancient_coverage
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

CREATE POLICY book_ancient_coverage_viewer_write ON public.book_ancient_coverage
	FOR ALL
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

-- scripture_references (owner full; viewer SELECT + INSERT + UPDATE)
ALTER TABLE public.scripture_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY scripture_references_owner_all ON public.scripture_references
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

CREATE POLICY scripture_references_viewer_select ON public.scripture_references
	FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY scripture_references_viewer_insert ON public.scripture_references
	FOR INSERT
	WITH CHECK (public.app_is_viewer_writer('library'));

CREATE POLICY scripture_references_viewer_update ON public.scripture_references
	FOR UPDATE
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

-- book_topics (owner full; viewer SELECT + INSERT + UPDATE)
ALTER TABLE public.book_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY book_topics_owner_all ON public.book_topics
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

CREATE POLICY book_topics_viewer_select ON public.book_topics
	FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY book_topics_viewer_insert ON public.book_topics
	FOR INSERT
	WITH CHECK (public.app_is_viewer_writer('library'));

CREATE POLICY book_topics_viewer_update ON public.book_topics
	FOR UPDATE
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));
