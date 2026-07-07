import { describe, expect, it } from 'vitest';
import { buildBibliographyDocx } from '../bibliography-docx';
import { formatBibliographyEntries } from '$lib/library/turabian';
import { WAVE2_FIXTURES } from '$lib/library/turabian/__tests__/fixtures';

describe('buildBibliographyDocx', () => {
	it('packs fixture entries into a non-empty zip (docx) buffer', async () => {
		const books = WAVE2_FIXTURES.filter((r) => r.id === 2 || r.id === 13).map((r) => r.book);
		const entries = formatBibliographyEntries(books);
		expect(entries).toHaveLength(2);

		const buffer = await buildBibliographyDocx(entries);
		expect(buffer.length).toBeGreaterThan(0);
		// Zip local-file-header magic: "PK\x03\x04".
		expect(buffer[0]).toBe(0x50);
		expect(buffer[1]).toBe(0x4b);
		expect(buffer[2]).toBe(0x03);
		expect(buffer[3]).toBe(0x04);
	});
});
