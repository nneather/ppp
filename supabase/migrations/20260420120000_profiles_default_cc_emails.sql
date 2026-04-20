-- Per-user default CC list for invoice emails (editable in DB; UI can be added later).
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS default_cc_emails text[] NOT NULL DEFAULT '{}';

UPDATE public.profiles
SET default_cc_emails = ARRAY['parker.neathery@gmail.com']::text[]
WHERE lower(trim(email)) = lower('parker.neathery@gmail.com');
