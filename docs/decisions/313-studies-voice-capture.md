# 313 — Voice into the capture line

**Date:** 2026-10-24
**Module:** studies
**Tracker session:** follow-on (research workflow, session 3 of 3)

## Built

- Record on the paper and sermon capture line. The transcript replaces an empty line, or appends after text already typed. Enter still saves. Nothing is saved from the recording itself.
- The clip uploads to a private `studies-audio` bucket (`{userId}/{uuid}.webm|mp4|ogg`, 2 MiB). The recorder stops at 60 seconds. `transcribe_study_note` reads it with the service role and deletes it before the response returns, on success and on failure.
- Owner only. A viewer cannot upload, and the function checks `profiles.role` before it downloads. A silent PWA reload waits while the record control is busy.

## Decided

- **Provider:** OpenAI file transcription, model `gpt-transcribe` (`POST /v1/audio/transcriptions`). Anthropic’s Messages API still takes text and images, not audio. `whisper-1` and `gpt-4o-transcribe` shut down on 2027-02-26, so a new integration does not use them. Optional secret `OPENAI_TRANSCRIBE_MODEL` overrides the model id. A short prompt plus the study’s author surnames and primary Bible book go across as hints.
- **Retention:** the audio is deleted after the function reads it. It is not kept until the note is saved, and there is no attachments table. If the invoke never returns, the browser deletes the object too. A clip that is uploaded and then abandoned (the tab dies before the invoke) can remain under the owner’s prefix until he deletes it.
- No daily counter. The caller is the owner, and each clip is one short file. Scripture OCR’s usage table is the pattern if that ever needs a cap.

## Schema changes

- `supabase/migrations/20261024235000_studies_audio_bucket.sql` — private `studies-audio` bucket, owner-only self-prefix select / insert / delete, 2 MiB, audio MIME types. No new table.

## New components / patterns added

- `src/lib/components/study-voice-record.svelte`
- `src/lib/studies/voice-capture.ts`, `transcribe-client.ts`
- `supabase/functions/transcribe_study_note`

## Open questions surfaced

- Studies tables are still outside the weekly R2 dump. The audio bucket is ephemeral and should stay out of that dump.
- `OPENAI_API_KEY` has to be set on the hosted project before Record returns text. The function responds “Transcription is not configured.” until then.

## Surprises (read these before the next session)

- iOS Safari records `audio/mp4`. Other browsers prefer `audio/webm`. The bucket allows both. The upload content-type drops the codecs parameter so it matches the bucket allow-list.
- On the Pastorals paper, Record switched to Stop and disabled the line. Stopping did not create a note. The bucket was empty afterward. A real transcript waits on `OPENAI_API_KEY`.
- The Look-up button on the add-source sheet was still not clicked through in the previous session. This session did not re-test it.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented (`OPENAI_API_KEY`, optional `OPENAI_TRANSCRIBE_MODEL`)
- [x] tracker follow-on voice line marked done
