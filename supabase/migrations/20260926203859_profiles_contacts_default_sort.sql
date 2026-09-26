-- Default /contacts roster grouping ([231]). NULL = name.
-- Value is one or two sort keys, e.g. frequency or frequency,list.
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS contacts_default_sort text;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'profiles_contacts_default_sort_format'
	) THEN
		ALTER TABLE public.profiles
			ADD CONSTRAINT profiles_contacts_default_sort_format
			CHECK (
				contacts_default_sort IS NULL
				OR (
					contacts_default_sort ~ '^(name|frequency|list|giving|relationship|last_meet)(,(name|frequency|list|giving|relationship|last_meet))?$'
					AND (
						contacts_default_sort NOT LIKE '%,%'
						OR split_part(contacts_default_sort, ',', 1)
							<> split_part(contacts_default_sort, ',', 2)
					)
				)
			);
	END IF;
END $$;

COMMENT ON COLUMN public.profiles.contacts_default_sort IS
	'Default /contacts grouping (sort keys). NULL means name. Example: frequency,list.';
