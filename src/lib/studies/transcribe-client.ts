import type { SupabaseClient } from '@supabase/supabase-js';
import { readEdgeErrorBody } from '$lib/library/ocr-invoke-client';
import {
	audioPathOwnedBy,
	STUDIES_AUDIO_BUCKET,
	studyAudioPath,
	type AudioExt
} from '$lib/studies/voice-capture';

export type TranscribeStudyAudioResult =
	| { ok: true; text: string }
	| { ok: false; message: string };

function textFromPayload(data: unknown): string | null {
	if (!data || typeof data !== 'object' || !('text' in data)) return null;
	const text = (data as { text: unknown }).text;
	if (typeof text !== 'string') return null;
	const trimmed = text.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function errorFromPayload(data: unknown): string | null {
	if (!data || typeof data !== 'object' || !('error' in data)) return null;
	const error = (data as { error: unknown }).error;
	return typeof error === 'string' && error.length > 0 ? error : null;
}

/**
 * Upload one clip, ask `transcribe_study_note` for text, and delete the
 * object if the function never confirms it removed the file.
 */
export async function transcribeStudyAudio(args: {
	supabase: SupabaseClient;
	userId: string;
	blob: Blob;
	ext: AudioExt;
	uploadMime: string;
	keywords: string[];
}): Promise<TranscribeStudyAudioResult> {
	let path: string;
	try {
		path = studyAudioPath(args.userId, args.ext);
	} catch {
		return { ok: false, message: 'Sign in again, then record.' };
	}
	if (!audioPathOwnedBy(path, args.userId)) {
		return { ok: false, message: 'Sign in again, then record.' };
	}

	const { error: uploadError } = await args.supabase.storage
		.from(STUDIES_AUDIO_BUCKET)
		.upload(path, args.blob, { contentType: args.uploadMime, upsert: false });
	if (uploadError) {
		return { ok: false, message: 'Could not upload the recording.' };
	}

	const { data, error } = await args.supabase.functions.invoke('transcribe_study_note', {
		body: { object_path: path, keywords: args.keywords }
	});
	const payloadError = errorFromPayload(data);
	if (!error && !payloadError) {
		const text = textFromPayload(data);
		if (text) return { ok: true, text };
		return { ok: false, message: 'No speech recognized.' };
	}

	await args.supabase.storage.from(STUDIES_AUDIO_BUCKET).remove([path]);
	if (payloadError) return { ok: false, message: payloadError };
	const detail = await readEdgeErrorBody(error);
	return { ok: false, message: detail.message ?? 'Transcription failed. Try again.' };
}
