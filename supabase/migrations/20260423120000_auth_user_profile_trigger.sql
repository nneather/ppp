-- Auto-create public.profiles when a new auth.users row is inserted.
-- Fixes silent RLS failures: app_is_owner() requires a profiles row with role = 'owner'.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
	INSERT INTO public.profiles (id, email, full_name)
	VALUES (
		NEW.id,
		COALESCE(NEW.email, ''),
		NEW.raw_user_meta_data->>'full_name'
	)
	ON CONFLICT (id) DO NOTHING;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
	AFTER INSERT ON auth.users
	FOR EACH ROW
	EXECUTE FUNCTION public.handle_new_user();

-- Idempotent backfill so migrations alone restore a working state.
INSERT INTO public.profiles (id, email)
SELECT u.id, COALESCE(u.email, '')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
