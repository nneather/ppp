/**
 * Voice capture for a study note. The clip is uploaded, transcribed, and
 * deleted. The text lands in the capture line for review.
 *
 * Path shape must match `transcribe_study_note` and the studies-audio RLS
 * self-prefix: `{userId}/{uuid}.{ext}`.
 */

export const STUDIES_AUDIO_BUCKET = 'studies-audio';

/** Storage cap. A 60s note is well under this. */
export const MAX_AUDIO_BYTES = 2_097_152;

export const MAX_AUDIO_MS = 60_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EXT_MIME = {
	webm: 'audio/webm',
	mp4: 'audio/mp4',
	ogg: 'audio/ogg'
} as const;

export type AudioExt = keyof typeof EXT_MIME;

export type RecorderFormat = {
	/** Value passed to MediaRecorder, including codecs when needed. */
	recorderMime: string;
	ext: AudioExt;
	/** Bucket content-type. Codecs parameters are stripped. */
	uploadMime: (typeof EXT_MIME)[AudioExt];
};

/** webm first where the browser supports it; iOS Safari falls through to mp4. */
export const RECORDER_CANDIDATES: readonly RecorderFormat[] = [
	{ recorderMime: 'audio/webm;codecs=opus', ext: 'webm', uploadMime: 'audio/webm' },
	{ recorderMime: 'audio/webm', ext: 'webm', uploadMime: 'audio/webm' },
	{ recorderMime: 'audio/mp4', ext: 'mp4', uploadMime: 'audio/mp4' },
	{ recorderMime: 'audio/ogg;codecs=opus', ext: 'ogg', uploadMime: 'audio/ogg' }
];

export function pickRecorderFormat(
	isSupported: (mime: string) => boolean
): RecorderFormat | null {
	for (const candidate of RECORDER_CANDIDATES) {
		if (isSupported(candidate.recorderMime)) return candidate;
	}
	return null;
}

export function studyAudioPath(userId: string, ext: AudioExt): string {
	if (!UUID_RE.test(userId)) throw new Error('Invalid user id.');
	return `${userId}/${crypto.randomUUID()}.${ext}`;
}

/** True when the path is exactly this user's `{uuid}/{uuid}.{ext}`. */
export function audioPathOwnedBy(objectPath: string, userId: string): boolean {
	if (!UUID_RE.test(userId)) return false;
	if (objectPath.includes('..') || objectPath.includes('\\') || objectPath.startsWith('/')) {
		return false;
	}
	const segments = objectPath.split('/').filter((segment) => segment.length > 0);
	if (segments.length !== 2 || segments[0] !== userId) return false;
	const file = segments[1] ?? '';
	const dot = file.lastIndexOf('.');
	if (dot <= 0) return false;
	const id = file.slice(0, dot);
	const ext = file.slice(dot + 1).toLowerCase();
	if (!UUID_RE.test(id)) return false;
	return Object.prototype.hasOwnProperty.call(EXT_MIME, ext);
}

const KEYWORD_RE = /^[^<>\r\n]{1,40}$/;

/** Last names and a Bible book, capped, with characters the transcriber rejects removed. */
export function sanitizeVoiceKeywords(raw: readonly string[]): string[] {
	const out: string[] = [];
	for (const item of raw) {
		const trimmed = item.trim();
		if (!KEYWORD_RE.test(trimmed)) continue;
		if (out.includes(trimmed)) continue;
		out.push(trimmed);
		if (out.length >= 12) break;
	}
	return out;
}

/**
 * Empty line takes the transcript. A line already typed (a surname and page)
 * keeps that prefix and appends the speech.
 */
export function mergeTranscript(existing: string, transcript: string): string {
	const next = transcript.trim();
	if (!next) return existing;
	const base = existing.trimEnd();
	if (!base) return next;
	return `${base} ${next}`;
}

export function recordingRejectReason(args: {
	bytes: number;
	elapsedMs: number;
}): string | null {
	if (args.elapsedMs < 400 || args.bytes < 200) return 'That was too short.';
	if (args.bytes > MAX_AUDIO_BYTES) return 'That recording is too long.';
	return null;
}
