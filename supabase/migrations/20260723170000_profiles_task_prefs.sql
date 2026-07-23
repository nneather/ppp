-- Fall MYN polish ([126]): default New Task project + named saved views on profiles.
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS default_task_project_id UUID REFERENCES public.projects (id) ON DELETE SET NULL;

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS task_saved_views JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'profiles_task_saved_views_is_array'
	) THEN
		ALTER TABLE public.profiles
			ADD CONSTRAINT profiles_task_saved_views_is_array
			CHECK (jsonb_typeof(task_saved_views) = 'array');
	END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_default_task_project_id_idx
	ON public.profiles (default_task_project_id)
	WHERE default_task_project_id IS NOT NULL;
