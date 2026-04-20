-- Multiple invoice recipient addresses per client (PDF + send flow).
ALTER TABLE public.clients
	ALTER COLUMN email DROP DEFAULT;

ALTER TABLE public.clients
	ALTER COLUMN email TYPE text[] USING (
		CASE
			WHEN email IS NULL OR btrim(email::text) = '' THEN '{}'::text[]
			ELSE ARRAY[email::text]::text[]
		END
	);

UPDATE public.clients
SET email = '{}'
WHERE email IS NULL;

ALTER TABLE public.clients
	ALTER COLUMN email SET DEFAULT '{}';

ALTER TABLE public.clients
	ALTER COLUMN email SET NOT NULL;
