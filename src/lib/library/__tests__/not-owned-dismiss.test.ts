import { describe, expect, it } from 'vitest';
import {
	dismissKey,
	parseDismissedKeysJson,
	restoreKey,
	serializeDismissedKeys
} from '../not-owned-dismiss';

describe('not-owned-dismiss', () => {
	it('round-trips keys through serialize + parse', () => {
		const set = new Set(['a', 'b']);
		expect(parseDismissedKeysJson(serializeDismissedKeys(set))).toEqual(set);
	});

	it('parseDismissedKeysJson handles empty and invalid', () => {
		expect(parseDismissedKeysJson(null).size).toBe(0);
		expect(parseDismissedKeysJson('').size).toBe(0);
		expect(parseDismissedKeysJson('not-json').size).toBe(0);
		expect(parseDismissedKeysJson('{}').size).toBe(0);
		expect(parseDismissedKeysJson('[1, "ok", null]')).toEqual(new Set(['ok']));
	});

	it('dismissKey and restoreKey are immutable', () => {
		const base = new Set(['x']);
		const dismissed = dismissKey(base, 'y');
		expect(base.has('y')).toBe(false);
		expect(dismissed.has('y')).toBe(true);
		const restored = restoreKey(dismissed, 'y');
		expect(restored.has('y')).toBe(false);
		expect(dismissed.has('y')).toBe(true);
	});
});
