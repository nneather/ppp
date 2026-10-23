import { describe, expect, it } from 'vitest';
import { loadUsingSystematicRefs, saveUsingSystematicRefs } from '../systematics-using';
import { loadDismissedSystematicRefs, saveDismissedSystematicRefs } from '../systematics-dismiss';

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

describe('using systematic refs', () => {
	it('round-trips one study and leaves dismiss alone', () => {
		const storage = memoryStorage();
		saveUsingSystematicRefs('sermon-1', ['r1'], storage);
		saveDismissedSystematicRefs('sermon-1', ['r9'], storage);
		expect([...loadUsingSystematicRefs('sermon-1', storage)]).toEqual(['r1']);
		expect([...loadDismissedSystematicRefs('sermon-1', storage)]).toEqual(['r9']);
		expect(loadUsingSystematicRefs('sermon-2', storage).size).toBe(0);
	});

	it('ignores junk', () => {
		const storage = memoryStorage({
			'ppp.studies.systematicsUsing.sermon-1': JSON.stringify(['a', 1, '', 'b'])
		});
		expect([...loadUsingSystematicRefs('sermon-1', storage)]).toEqual(['a', 'b']);
	});
});
