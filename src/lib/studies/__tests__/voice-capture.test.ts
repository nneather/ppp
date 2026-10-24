import { describe, expect, it } from 'vitest';
import {
	audioPathOwnedBy,
	mergeTranscript,
	pickRecorderFormat,
	recordingRejectReason,
	sanitizeVoiceKeywords,
	studyAudioPath
} from '../voice-capture';

const USER = 'a14833c9-459e-4667-aef3-dae698734f6d';

describe('pickRecorderFormat', () => {
	it('prefers webm opus, then falls through to mp4', () => {
		expect(pickRecorderFormat(() => true)?.ext).toBe('webm');
		expect(pickRecorderFormat((mime) => mime === 'audio/mp4')?.ext).toBe('mp4');
		expect(pickRecorderFormat(() => false)).toBeNull();
	});
});

describe('studyAudioPath', () => {
	it('builds a self-prefixed object path', () => {
		const path = studyAudioPath(USER, 'webm');
		expect(audioPathOwnedBy(path, USER)).toBe(true);
		expect(audioPathOwnedBy(path, '00000000-0000-4000-8000-000000000000')).toBe(false);
	});

	it('rejects traversal and a foreign prefix', () => {
		expect(audioPathOwnedBy(`${USER}/../secret.webm`, USER)).toBe(false);
		expect(audioPathOwnedBy(`other/${USER}.webm`, USER)).toBe(false);
		expect(audioPathOwnedBy(`${USER}/not-a-uuid.webm`, USER)).toBe(false);
		expect(audioPathOwnedBy(`${USER}/${USER}.mp3`, USER)).toBe(false);
	});
});

describe('sanitizeVoiceKeywords', () => {
	it('keeps unique short names and drops markup', () => {
		expect(sanitizeVoiceKeywords([' Towner ', 'Towner', '1 Timothy', '<script>', 'a\nb'])).toEqual([
			'Towner',
			'1 Timothy'
		]);
	});
});

describe('mergeTranscript', () => {
	it('replaces an empty line and appends to a prefix', () => {
		expect(mergeTranscript('', '  women teach  ')).toBe('women teach');
		expect(mergeTranscript('Towner 215 —', 'women teach')).toBe('Towner 215 — women teach');
		expect(mergeTranscript('Towner 215 —', '   ')).toBe('Towner 215 —');
	});
});

describe('recordingRejectReason', () => {
	it('rejects a tap and an oversized clip', () => {
		expect(recordingRejectReason({ bytes: 5000, elapsedMs: 100 })).toBe('That was too short.');
		expect(recordingRejectReason({ bytes: 50, elapsedMs: 2000 })).toBe('That was too short.');
		expect(recordingRejectReason({ bytes: 3_000_000, elapsedMs: 2000 })).toBe(
			'That recording is too long.'
		);
		expect(recordingRejectReason({ bytes: 8000, elapsedMs: 2000 })).toBeNull();
	});
});
