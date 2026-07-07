import { describe, expect, it } from 'vitest';
import { formatBibliography } from '../format';
import { parseCitationHtmlSegments } from '../html-segments';
import { WAVE2_FIXTURES } from './fixtures';

function fixture(id: number) {
	const row = WAVE2_FIXTURES.find((r) => r.id === id);
	if (!row) throw new Error(`fixture row ${id} missing`);
	return row;
}

describe('parseCitationHtmlSegments', () => {
	it('returns nothing for empty html', () => {
		expect(parseCitationHtmlSegments('')).toEqual([]);
	});

	it('alternates plain/italic and unescapes entities', () => {
		const segments = parseCitationHtmlSegments('A &amp; B, <i>1 &lt; 2</i>, done. <i>Again</i>');
		expect(segments).toEqual([
			{ text: 'A & B, ', italic: false },
			{ text: '1 < 2', italic: true },
			{ text: ', done. ', italic: false },
			{ text: 'Again', italic: true }
		]);
	});

	it('fixture row 2 (multi-author bib): title is the single italic run, & round-trips', () => {
		const row = fixture(2);
		const bib = formatBibliography(row.book);
		const segments = parseCitationHtmlSegments(bib.html);

		// Reassembled plain text must match the plain channel exactly (entity unescape).
		expect(segments.map((s) => s.text).join('')).toBe(bib.plain);
		expect(bib.plain).toBe(row.expectedBibliography);

		const italics = segments.filter((s) => s.italic);
		expect(italics).toHaveLength(1);
		expect(italics[0]?.text).toBe(
			'Churches, Cutures & Leadership: A Practical Theology of Congregations and Ethnicities'
		);
		expect(segments[0]).toEqual({
			text: 'Branson, Mark Lau, and Juan F. Martínez. ',
			italic: false
		});
	});

	it('fixture row 13 (commentary-in-series): series name stays roman, title italic', () => {
		const row = fixture(13);
		const bib = formatBibliography(row.book);
		const segments = parseCitationHtmlSegments(bib.html);

		expect(segments.map((s) => s.text).join('')).toBe(bib.plain);
		expect(bib.plain).toBe(row.expectedBibliography);

		const italics = segments.filter((s) => s.italic);
		expect(italics).toHaveLength(1);
		expect(italics[0]?.text).toBe('1, 2, 3 John');

		const roman = segments.filter((s) => !s.italic).map((s) => s.text).join('');
		expect(roman).toContain('Word Biblical Commentary');
		expect(roman).toContain('Smalley, Stephen S.');
	});
});
