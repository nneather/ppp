-- =============================================================================
-- Series seed — abbreviations required by library_review_combined.csv import
-- Idempotent: skip live row when abbreviation matches (case-insensitive).
-- =============================================================================

INSERT INTO public.series (name, abbreviation, created_at, updated_at)
SELECT 'Reformed Dogmatics (Bavinck)', 'RD', now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND upper(nullif(trim(s.abbreviation), '')) = 'RD'
);

INSERT INTO public.series (name, abbreviation, created_at, updated_at)
SELECT 'Works of John Bunyan', 'WJB', now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND upper(nullif(trim(s.abbreviation), '')) = 'WJB'
);

INSERT INTO public.series (name, abbreviation, created_at, updated_at)
SELECT 'Institutes of the Christian Religion (McNeill/Battles)', 'INST', now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND upper(nullif(trim(s.abbreviation), '')) = 'INST'
);

INSERT INTO public.series (name, abbreviation, created_at, updated_at)
SELECT 'Old Testament Pseudepigrapha (Charlesworth ed)', 'OTP', now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND upper(nullif(trim(s.abbreviation), '')) = 'OTP'
);

INSERT INTO public.series (name, abbreviation, created_at, updated_at)
SELECT 'Goethes sämtliche Werke', 'GW', now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND upper(nullif(trim(s.abbreviation), '')) = 'GW'
);

INSERT INTO public.series (name, abbreviation, created_at, updated_at)
SELECT 'Hebrew and Aramaic Lexicon of the Old Testament', 'HALOT', now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND upper(nullif(trim(s.abbreviation), '')) = 'HALOT'
);

INSERT INTO public.series (name, abbreviation, created_at, updated_at)
SELECT 'Expositions of Holy Scripture (MacLaren)', 'EHS', now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND upper(nullif(trim(s.abbreviation), '')) = 'EHS'
);

INSERT INTO public.series (name, abbreviation, created_at, updated_at)
SELECT 'Theoretical-Practical Theology (Van Mastricht)', 'TPT', now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND upper(nullif(trim(s.abbreviation), '')) = 'TPT'
);

INSERT INTO public.series (name, abbreviation, created_at, updated_at)
SELECT 'Harvard Classics', 'HC', now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND upper(nullif(trim(s.abbreviation), '')) = 'HC'
);

INSERT INTO public.series (name, abbreviation, created_at, updated_at)
SELECT 'Annotated Shakespeare', 'AS', now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND upper(nullif(trim(s.abbreviation), '')) = 'AS'
);

INSERT INTO public.series (name, abbreviation, created_at, updated_at)
SELECT 'Truths We Confess (Sproul)', 'TWC', now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND upper(nullif(trim(s.abbreviation), '')) = 'TWC'
);

INSERT INTO public.series (name, abbreviation, created_at, updated_at)
SELECT 'Institutes of Elenctic Theology (Turretin)', 'IET', now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND upper(nullif(trim(s.abbreviation), '')) = 'IET'
);

INSERT INTO public.series (name, abbreviation, created_at, updated_at)
SELECT 'Exegetical Guide to the Greek New Testament', 'EGGNT', now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND upper(nullif(trim(s.abbreviation), '')) = 'EGGNT'
);

INSERT INTO public.series (name, abbreviation, created_at, updated_at)
SELECT 'Christian Origins and the Question of God (Wright)', 'COQG', now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND upper(nullif(trim(s.abbreviation), '')) = 'COQG'
);

INSERT INTO public.series (name, abbreviation, created_at, updated_at)
SELECT 'New Studies in Dogmatics', 'NSD', now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND upper(nullif(trim(s.abbreviation), '')) = 'NSD'
);

INSERT INTO public.series (name, abbreviation, created_at, updated_at)
SELECT 'Theologians on the Christian Life', 'TOTCL', now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND upper(nullif(trim(s.abbreviation), '')) = 'TOTCL'
);
