-- Daily OCR invocation soft cap (Edge Function service-role only; no client policies).

CREATE TABLE IF NOT EXISTS public.library_ocr_usage (
	user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
	usage_date date NOT NULL DEFAULT ((timezone ('utc', now()))::date),
	call_count integer NOT NULL DEFAULT 0 CHECK (call_count >= 0),
	PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.library_ocr_usage ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.library_ocr_usage IS
	'Per-user daily OCR call counts; written only by ocr_scripture_refs Edge (service role).';
