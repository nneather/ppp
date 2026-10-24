-- =============================================================================
-- studies-audio Storage bucket
-- Filed: 2026-10-24 (studies notes, session 3 — voice into the capture line)
--
-- Private clips for transcribe_study_note. The function deletes the object
-- after it reads it. There is no attachments table and no signed-URL read
-- in the app.
--
-- Path: ${userId}/${uuid}.{webm|mp4|ogg}
-- Cap: 2 MiB. The client also stops the recorder at 60 seconds.
--
-- RLS: owner only, and only into the owner's own prefix. Viewers do not
-- write studies. Service role (the Edge Function) bypasses these policies
-- to download and delete.
--
-- HOW TO APPLY:
--   npm run supabase:db:push:dry → review → npm run supabase:db:push
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
	'studies-audio',
	'studies-audio',
	false,
	2097152,
	ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS studies_audio_select ON storage.objects;
CREATE POLICY studies_audio_select ON storage.objects
	FOR SELECT
	USING (
		bucket_id = 'studies-audio'
		AND public.app_is_owner()
		AND (storage.foldername(name))[1] = auth.uid()::text
	);

DROP POLICY IF EXISTS studies_audio_insert ON storage.objects;
CREATE POLICY studies_audio_insert ON storage.objects
	FOR INSERT
	WITH CHECK (
		bucket_id = 'studies-audio'
		AND public.app_is_owner()
		AND (storage.foldername(name))[1] = auth.uid()::text
	);

DROP POLICY IF EXISTS studies_audio_delete ON storage.objects;
CREATE POLICY studies_audio_delete ON storage.objects
	FOR DELETE
	USING (
		bucket_id = 'studies-audio'
		AND public.app_is_owner()
		AND (storage.foldername(name))[1] = auth.uid()::text
	);
