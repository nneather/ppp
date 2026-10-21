import { describe, expect, it } from 'vitest';
import {
	loadDismissedSystematicRefs,
	parseDismissedRefIds,
	saveDismissedSystematicRefs,
	visibleSystematicRefs
} from '../systematics-dismiss';

function memoryStorage(initial: Record<string, string> = {}) {
	const data = { ...initial };
	return {
		data,
		getItem(key: string) {
			return data[key] ?? null;
		},
		setItem(key: string, value: string) {
			data[key] = value;
		}
	};
}

describe('parseDismissedRefIds', () => {
	it('ignores junk and keeps string ids', () => {
		expect(parseDismissedRefIds(null).size).toBe(0);
		expect(parseDismissedRefIds('nope').size).toBe(0);
		expect([...parseDismissedRefIds(JSON.stringify(['a', 1, '', 'b']))]).toEqual(['a', 'b']);
	});
});

describe('load and save', () => {
	it('round-trips a set for one study', () => {
		const storage = memoryStorage();
		saveDismissedSystematicRefs('sermon-1', ['r1', 'r2'], storage);
		expect([...loadDismissedSystematicRefs('sermon-1', storage)].sort()).toEqual(['r1', 'r2']);
		expect(loadDismissedSystematicRefs('sermon-2', storage).size).toBe(0);
	});
});

describe('visibleSystematicRefs', () => {
	const items = [{ refId: 'a' }, { refId: 'b' }, { refId: 'c' }];
	const dismissed = new Set(['b']);

	it('hides dismissed refs until the toggle is on', () => {
		expect(visibleSystematicRefs(items, dismissed, false).map((item) => item.refId)).toEqual([
			'a',
			'c'
		]);
		expect(visibleSystematicRefs(items, dismissed, true)).toEqual(items);
	});
});
