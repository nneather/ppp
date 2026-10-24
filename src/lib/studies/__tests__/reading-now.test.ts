import { describe, expect, it } from 'vitest';
import { loadReadingNow, readingNowPage, saveReadingNow } from '../reading-now';

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

describe('reading now', () => {
	it('round-trips the sticky source and last page', () => {
		const storage = memoryStorage();
		saveReadingNow('paper-1', { sourceId: 'towner', pages: { towner: '215' } }, storage);
		const loaded = loadReadingNow('paper-1', storage);
		expect(loaded.sourceId).toBe('towner');
		expect(readingNowPage(loaded, 'towner')).toBe('215');
		expect(loadReadingNow('paper-2', storage).sourceId).toBeNull();
	});

	it('ignores junk', () => {
		const storage = memoryStorage({
			'ppp.studies.readingNow.paper-1': JSON.stringify({ sourceId: 1, pages: { a: ' 10 ', b: '' } })
		});
		const loaded = loadReadingNow('paper-1', storage);
		expect(loaded.sourceId).toBeNull();
		expect(loaded.pages).toEqual({ a: '10' });
	});
});
