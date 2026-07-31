import { describe, expect, it, vi } from 'vitest';
import {
	getRecoveryAttemptCount,
	isChunkLoadFailure,
	recentlyAttemptedRecovery,
	stripRecoverQueryParam
} from './client-recovery';

describe('isChunkLoadFailure', () => {
	it('detects common chunk load error messages', () => {
		expect(isChunkLoadFailure('Loading chunk 123 failed')).toBe(true);
		expect(isChunkLoadFailure('Failed to fetch dynamically imported module')).toBe(true);
		expect(isChunkLoadFailure('Importing a module script failed')).toBe(true);
	});

	it('detects opaque script errors from immutable assets only', () => {
		expect(isChunkLoadFailure('Script error', 'https://example.com/_app/immutable/chunk.js')).toBe(
			true
		);
		expect(isChunkLoadFailure('', 'https://example.com/_app/immutable/chunk.js')).toBe(true);
	});

	it('ignores unrelated errors even from immutable sources', () => {
		expect(isChunkLoadFailure('Cannot read properties of undefined')).toBe(false);
		expect(isChunkLoadFailure('NetworkError when attempting to fetch resource')).toBe(false);
		expect(
			isChunkLoadFailure(
				'Cannot read properties of undefined',
				'https://example.com/_app/immutable/chunk.js'
			)
		).toBe(false);
	});
});

describe('recentlyAttemptedRecovery', () => {
	it('is false with empty storage', () => {
		const storage = { getItem: () => null };
		expect(recentlyAttemptedRecovery(1_000_000, storage)).toBe(false);
	});

	it('is true inside the cooldown window', () => {
		const storage = { getItem: () => String(1_000_000 - 5_000) };
		expect(recentlyAttemptedRecovery(1_000_000, storage)).toBe(true);
	});

	it('is false after the cooldown window', () => {
		const storage = { getItem: () => String(1_000_000 - 25_000) };
		expect(recentlyAttemptedRecovery(1_000_000, storage)).toBe(false);
	});
});

describe('getRecoveryAttemptCount', () => {
	it('reads a positive integer count', () => {
		const storage = { getItem: (key: string) => (key.includes('count') ? '2' : null) };
		expect(getRecoveryAttemptCount(storage)).toBe(2);
	});

	it('is 0 when missing or invalid', () => {
		expect(getRecoveryAttemptCount({ getItem: () => null })).toBe(0);
		expect(getRecoveryAttemptCount({ getItem: () => 'nope' })).toBe(0);
	});
});

describe('stripRecoverQueryParam', () => {
	it('removes the recover param and calls replaceState', () => {
		const replaceState = vi.fn();
		const next = stripRecoverQueryParam(
			'https://example.com/dashboard?view=1&_ppp_recover=99#x',
			replaceState
		);
		expect(next).toBe('/dashboard?view=1#x');
		expect(replaceState).toHaveBeenCalledWith('/dashboard?view=1#x');
	});

	it('is a no-op without the recover param', () => {
		const replaceState = vi.fn();
		expect(stripRecoverQueryParam('https://example.com/tasks', replaceState)).toBeNull();
		expect(replaceState).not.toHaveBeenCalled();
	});
});
