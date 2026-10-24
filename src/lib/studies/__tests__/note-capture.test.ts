import { describe, expect, it } from 'vitest';
import { interpretNoteCapture, matchBookName, type CaptureSource } from '../note-capture';

const sources: CaptureSource[] = [
	{ sourceId: 'towner', lastName: 'Towner' },
	{ sourceId: 'mounce-1', lastName: 'Mounce' },
	{ sourceId: 'mounce-2', lastName: 'Mounce' },
	{ sourceId: 'devos', lastName: 'de Vos' }
];

describe('interpretNoteCapture', () => {
	it('parses a last name, page, and body', () => {
		const note = interpretNoteCapture('Towner 215 — the prohibition is situational', {
			sources,
			primaryBibleBook: '1 Timothy'
		});
		expect(note).toMatchObject({
			body: 'the prohibition is situational',
			page: '215',
			namedSource: true,
			source: { kind: 'matched', sourceId: 'towner' },
			anchor: null
		});
	});

	it('uses the sticky source when the line is only a page', () => {
		const note = interpretNoteCapture('215 — syntax is gnomic', {
			sources,
			stickySourceId: 'towner',
			primaryBibleBook: '1 Timothy'
		});
		expect(note?.source).toEqual({ kind: 'matched', sourceId: 'towner' });
		expect(note?.page).toBe('215');
		expect(note?.namedSource).toBe(false);
	});

	it('prefills the page when the sticky source is set and the line has none', () => {
		const note = interpretNoteCapture('still on the imperative', {
			sources,
			stickySourceId: 'towner',
			prefilledPage: '218'
		});
		expect(note).toMatchObject({
			body: 'still on the imperative',
			page: '218',
			source: { kind: 'matched', sourceId: 'towner' }
		});
	});

	it('lets a named source override the sticky one', () => {
		const note = interpretNoteCapture('de Vos 10 — household code', {
			sources,
			stickySourceId: 'towner'
		});
		expect(note?.source).toEqual({ kind: 'matched', sourceId: 'devos' });
		expect(note?.page).toBe('10');
	});

	it('returns both volumes when the last name is shared', () => {
		const note = interpretNoteCapture('Mounce 88 — aorist', { sources });
		expect(note?.source).toEqual({ kind: 'ambiguous', sourceIds: ['mounce-1', 'mounce-2'] });
		expect(note?.page).toBe('88');
		expect(note?.namedSource).toBe(true);
	});

	it('saves a loose note when nothing is sticky', () => {
		const note = interpretNoteCapture('thesis: the prohibition is congregational', { sources });
		expect(note).toMatchObject({
			body: 'thesis: the prohibition is congregational',
			page: null,
			source: { kind: 'none' },
			namedSource: false
		});
	});

	it('anchors a bare chapter:verse against the primary book', () => {
		const note = interpretNoteCapture('Towner 215 @2:12 — authentein', {
			sources,
			primaryBibleBook: '1 Timothy'
		});
		expect(note?.anchor).toEqual({
			passageDisplay: '1 Timothy 2:12',
			bibleBook: '1 Timothy',
			chapter: 2,
			verseStart: 12,
			verseEnd: null
		});
		expect(note?.body).toBe('authentein');
		expect(note?.page).toBe('215');
	});

	it('accepts an explicit book prefix and a verse range', () => {
		const note = interpretNoteCapture('@1 Tim 2:8-15 the unit is the whole paragraph', {
			sources,
			primaryBibleBook: 'Titus'
		});
		expect(note?.anchor?.bibleBook).toBe('1 Timothy');
		expect(note?.anchor?.verseStart).toBe(8);
		expect(note?.anchor?.verseEnd).toBe(15);
		expect(note?.body).toBe('the unit is the whole paragraph');
	});

	it('leaves an unresolved @ in the body', () => {
		const note = interpretNoteCapture('@2:12 no primary book', { sources });
		expect(note?.anchor).toBeNull();
		expect(note?.body).toContain('@2:12');
	});

	it('does not treat a prose dash as a page', () => {
		const note = interpretNoteCapture('the argument - not the background - is the point', {
			sources,
			stickySourceId: 'towner',
			prefilledPage: '220'
		});
		expect(note?.body).toBe('the argument - not the background - is the point');
		expect(note?.page).toBe('220');
	});

	it('rejects an empty body', () => {
		expect(interpretNoteCapture('   ', { sources })).toBeNull();
		expect(interpretNoteCapture('Towner 215 —', { sources })).toBeNull();
	});

	it('matches a unique last-name prefix', () => {
		const note = interpretNoteCapture('Tow 215 — prefix', { sources });
		expect(note?.source).toEqual({ kind: 'matched', sourceId: 'towner' });
	});

	it('matches a later author on the same volume', () => {
		const withMarshall: CaptureSource[] = [...sources, { sourceId: 'towner', lastName: 'Marshall' }];
		const note = interpretNoteCapture('Marshall 215 — the prohibition', { sources: withMarshall });
		expect(note?.source).toEqual({ kind: 'matched', sourceId: 'towner' });
	});
});

describe('matchBookName', () => {
	it('resolves a unique prefix and leaves John alone', () => {
		expect(matchBookName('1 Tim')).toBe('1 Timothy');
		expect(matchBookName('John')).toBe('John');
		expect(matchBookName('Tim')).toBeNull();
	});
});
