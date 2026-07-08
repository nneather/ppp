import { describe, expect, it } from 'vitest';
import { isChunkLoadFailure } from './client-recovery';

describe('isChunkLoadFailure', () => {
	it('detects common chunk load error messages', () => {
		expect(isChunkLoadFailure('Loading chunk 123 failed')).toBe(true);
		expect(isChunkLoadFailure('Failed to fetch dynamically imported module')).toBe(true);
		expect(isChunkLoadFailure('Importing a module script failed')).toBe(true);
	});

	it('detects immutable asset source URLs', () => {
		expect(isChunkLoadFailure('Script error', 'https://example.com/_app/immutable/chunk.js')).toBe(
			true
		);
	});

	it('ignores unrelated errors', () => {
		expect(isChunkLoadFailure('Cannot read properties of undefined')).toBe(false);
		expect(isChunkLoadFailure('NetworkError when attempting to fetch resource')).toBe(false);
	});
});
