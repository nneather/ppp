import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { buildBibliographyDocx } from '../bibliography-docx';
import { formatBibliographyEntries } from '$lib/library/turabian';
import { WAVE2_FIXTURES } from '$lib/library/turabian/__tests__/fixtures';

function zipText(buffer: Uint8Array, name: string): string {
	const b = Buffer.from(buffer);
	let offset = 0;
	while (offset + 30 <= b.length && b.readUInt32LE(offset) === 0x04034b50) {
		const method = b.readUInt16LE(offset + 8);
		const compSize = b.readUInt32LE(offset + 18);
		const nameLen = b.readUInt16LE(offset + 26);
		const extraLen = b.readUInt16LE(offset + 28);
		const fileName = b.subarray(offset + 30, offset + 30 + nameLen).toString('utf8');
		const dataStart = offset + 30 + nameLen + extraLen;
		const data = b.subarray(dataStart, dataStart + compSize);
		if (fileName === name) {
			const raw = method === 0 ? data : inflateRawSync(data);
			return raw.toString('utf8');
		}
		offset = dataStart + compSize;
	}
	throw new Error(`missing zip entry ${name}`);
}

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

	it('writes a bold section heading when sections are passed', async () => {
		const books = WAVE2_FIXTURES.filter((r) => r.id === 2).map((r) => r.book);
		const entries = formatBibliographyEntries(books);
		const buffer = await buildBibliographyDocx([], {
			sections: [{ heading: 'Systematic Theology', entries }]
		});
		const xml = zipText(buffer, 'word/document.xml');
		expect(xml).toContain('Systematic Theology');
		expect(xml).toContain('Bibliography');
	});
});
