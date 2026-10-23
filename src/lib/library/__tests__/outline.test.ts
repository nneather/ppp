import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	formatSystematicPointerDisplay,
	formatSystematicVerseLabel,
	formatSystematicVerseSpan,
	groupSystematicHits,
	groupSystematicPointersByVerse,
	buildOutlineTree,
	pageNumberFromText,
	parseOutlineTsv,
	parseOutlineTsvLine,
	resolveOutlineForPointer,
	resolveOutlineLabel,
	outlineSpansAcrossVolumes,
	type OutlineSectionInput,
	type SystematicHitInput
} from '../outline';
import {
	expandPrintedSectionRange,
	normalizeSectionPageFields
} from '../section-pointer';

describe('pageNumberFromText', () => {
	it('parses plain pages and ranges', () => {
		expect(pageNumberFromText('620')).toBe(620);
		expect(pageNumberFromText('620–23')).toBe(620);
		expect(pageNumberFromText('106n21')).toBe(106);
		expect(pageNumberFromText('pp. 249ff')).toBe(249);
	});

	it('returns null for empty / non-numeric', () => {
		expect(pageNumberFromText(null)).toBeNull();
		expect(pageNumberFromText('')).toBeNull();
		expect(pageNumberFromText('n/a')).toBeNull();
	});
});

describe('resolveOutlineLabel', () => {
	const sections: OutlineSectionInput[] = [
		{
			id: 'broad',
			book_id: 'b1',
			parent_id: null,
			sort_order: 1,
			locator: 'XV',
			label: 'Faith and Justification',
			page_start: 500,
			page_end: 700
		},
		{
			id: 'tight',
			book_id: 'b1',
			parent_id: 'broad',
			sort_order: 2,
			locator: 'XV.17',
			label: 'Full Assurance',
			page_start: 610,
			page_end: 630
		}
	];

	it('picks the deepest enclosing node', () => {
		const r = resolveOutlineLabel(sections, 620);
		expect(r?.id).toBe('tight');
		expect(r?.label).toBe('Full Assurance');
	});

	it('returns null when page is outside all ranges', () => {
		expect(resolveOutlineLabel(sections, 10)).toBeNull();
	});
});

describe('section locator join', () => {
	const calvin: OutlineSectionInput[] = [
		{
			id: 'faith',
			book_id: 'cal',
			parent_id: null,
			sort_order: 1,
			locator: 'III.2',
			label: 'Faith',
			page_start: 543,
			page_end: 591
		},
		{
			id: 'sec12',
			book_id: 'cal',
			parent_id: 'faith',
			sort_order: 2,
			locator: 'III.2.12',
			label: 'Word and Spirit',
			page_start: 560,
			page_end: 562
		}
	];

	it('expands a printed section range and leaves page ranges alone', () => {
		expect(expandPrintedSectionRange('III.2.12–14')).toEqual({
			pageStart: 'III.2.12',
			pageEnd: 'III.2.14'
		});
		expect(expandPrintedSectionRange('III.2.12-14')).toEqual({
			pageStart: 'III.2.12',
			pageEnd: 'III.2.14'
		});
		expect(expandPrintedSectionRange('620–23')).toBeNull();
		expect(normalizeSectionPageFields('III.2.41', '42')).toEqual({
			pageStart: 'III.2.41',
			pageEnd: 'III.2.42'
		});
	});

	it('joins a single section to the exact outline locator', () => {
		const hit = resolveOutlineForPointer(calvin, 'III.2.12', null);
		expect(hit?.id).toBe('sec12');
		expect(hit?.label).toBe('Word and Spirit');
	});

	it('joins a section range to the chapter that covers it', () => {
		const hit = resolveOutlineForPointer(calvin, 'III.2.12', 'III.2.14');
		expect(hit?.id).toBe('faith');
		expect(hit?.label).toBe('Faith');
		const packed = resolveOutlineForPointer(calvin, 'III.2.12–14', null);
		expect(packed?.id).toBe('faith');
	});

	it('still joins page indexes on the page range', () => {
		const sections: OutlineSectionInput[] = [
			{
				id: 'tight',
				book_id: 'b1',
				parent_id: null,
				sort_order: 1,
				locator: 'XV.17',
				label: 'Full Assurance',
				page_start: 610,
				page_end: 630
			}
		];
		expect(resolveOutlineForPointer(sections, '620', null)?.label).toBe('Full Assurance');
		expect(resolveOutlineForPointer(sections, 'III.2.12', null)).toBeNull();
	});
});

describe('formatSystematicPointerDisplay', () => {
	it('formats volume:page with heading', () => {
		expect(
			formatSystematicPointerDisplay({
				volume: '2',
				pageStart: '620',
				pageEnd: null,
				locator: 'XV.17',
				label: 'Full Assurance'
			})
		).toBe('2:620 (XV.17 Full Assurance)');
	});

	it('formats a section range with the outline label and no volume prefix', () => {
		expect(
			formatSystematicPointerDisplay({
				volume: '2',
				pageStart: 'III.2.12',
				pageEnd: 'III.2.14',
				locator: 'III.2',
				label: 'Faith'
			})
		).toBe('III.2.12–14 (Faith)');
	});

	it('formats page-only when no volume', () => {
		expect(
			formatSystematicPointerDisplay({
				volume: null,
				pageStart: '136',
				pageEnd: '140',
				locator: null,
				label: 'Repentance'
			})
		).toBe('p. 136–140 (Repentance)');
	});
});

function systematicHit(
	partial: Partial<SystematicHitInput> & Pick<SystematicHitInput, 'refId' | 'bookId'>
): SystematicHitInput {
	return {
		bookTitle: null,
		volumeNumber: null,
		seriesId: null,
		seriesName: null,
		authorLabel: null,
		pageStart: null,
		pageEnd: null,
		outline: null,
		bibleBook: 'Ecclesiastes',
		chapterStart: 7,
		verseStart: null,
		chapterEnd: null,
		verseEnd: null,
		...partial
	};
}

describe('formatSystematicVerseLabel', () => {
	it('formats a single verse, a same-chapter range, a chapter, and a cross-chapter range', () => {
		expect(
			formatSystematicVerseLabel({
				bibleBook: 'Ecclesiastes',
				chapterStart: 7,
				verseStart: 14,
				chapterEnd: null,
				verseEnd: null
			})
		).toBe('7:14');
		expect(
			formatSystematicVerseLabel({
				bibleBook: 'Ecclesiastes',
				chapterStart: 7,
				verseStart: 1,
				chapterEnd: 7,
				verseEnd: 6
			})
		).toBe('7:1–6');
		expect(
			formatSystematicVerseLabel({
				bibleBook: 'Ecclesiastes',
				chapterStart: 7,
				verseStart: null,
				chapterEnd: null,
				verseEnd: null
			})
		).toBe('7');
		expect(
			formatSystematicVerseLabel({
				bibleBook: 'Ecclesiastes',
				chapterStart: 7,
				verseStart: 29,
				chapterEnd: 8,
				verseEnd: 1
			})
		).toBe('7:29–8:1');
	});
});

describe('formatSystematicVerseSpan', () => {
	it('spans the earliest start through the latest end', () => {
		expect(
			formatSystematicVerseSpan([
				{
					bibleBook: 'Ecclesiastes',
					chapterStart: 7,
					verseStart: 14,
					chapterEnd: null,
					verseEnd: null
				},
				{
					bibleBook: 'Ecclesiastes',
					chapterStart: 7,
					verseStart: 1,
					chapterEnd: null,
					verseEnd: null
				},
				{
					bibleBook: 'Ecclesiastes',
					chapterStart: 7,
					verseStart: 29,
					chapterEnd: null,
					verseEnd: null
				}
			])
		).toBe('7:1–29');
	});
});

describe('groupSystematicHits', () => {
	it('groups by series and sorts by verse, then volume, then page', () => {
		const blocks = groupSystematicHits([
			systematicHit({
				refId: 'r2',
				bookId: 'tur-2',
				bookTitle: 'Institutes of Elenctic Theology',
				volumeNumber: 'II',
				seriesId: 'ser-tur',
				seriesName: 'Institutes of Elenctic Theology (Turretin)',
				authorLabel: 'Francis Turretin',
				pageStart: '620',
				pageEnd: null,
				verseStart: 14,
				outline: {
					id: 'o1',
					locator: 'XV.17',
					label: 'Full Assurance',
					page_start: 610,
					page_end: 630
				}
			}),
			systematicHit({
				refId: 'r1',
				bookId: 'tur-2',
				bookTitle: 'Institutes of Elenctic Theology',
				volumeNumber: 'III',
				seriesId: 'ser-tur',
				seriesName: 'Institutes of Elenctic Theology (Turretin)',
				authorLabel: 'Francis Turretin',
				pageStart: '100',
				verseStart: 1
			})
		]);

		expect(blocks).toHaveLength(1);
		expect(blocks[0]!.seriesName).toContain('Turretin');
		expect(blocks[0]!.verseSpan).toBe('7:1–14');
		expect(blocks[0]!.pointers[0]!.verseLabel).toBe('7:1');
		expect(blocks[0]!.pointers[0]!.pageStart).toBe('100');
		expect(blocks[0]!.pointers[1]!.display).toBe('II:620 (XV.17 Full Assurance)');
		expect(blocks[0]!.pointerCount).toBe(2);
		expect(blocks[0]!.deferred).toBe(false);
	});

	it('omits pointers but keeps the span and count when the passage is large', () => {
		const blocks = groupSystematicHits(
			[
				systematicHit({
					refId: 'a',
					bookId: 'tur',
					seriesId: 'ser',
					seriesName: 'Turretin',
					verseStart: 1
				}),
				systematicHit({
					refId: 'b',
					bookId: 'tur',
					seriesId: 'ser',
					seriesName: 'Turretin',
					verseStart: 29
				})
			],
			{ omitPointers: true }
		);
		expect(blocks[0]!.pointers).toEqual([]);
		expect(blocks[0]!.pointerCount).toBe(2);
		expect(blocks[0]!.deferred).toBe(true);
		expect(blocks[0]!.verseSpan).toBe('7:1–29');
	});
});

describe('groupSystematicPointersByVerse', () => {
	it('orders chapter, single verse, range, then later verse', () => {
		const blocks = groupSystematicHits([
			systematicHit({
				refId: 'late',
				bookId: 'tur',
				seriesId: 'tur',
				seriesName: 'Turretin',
				verseStart: 14
			}),
			systematicHit({
				refId: 'range',
				bookId: 'cal',
				seriesId: 'cal',
				seriesName: 'Calvin',
				verseStart: 1,
				chapterEnd: 7,
				verseEnd: 6
			}),
			systematicHit({
				refId: 'chapter',
				bookId: 'bav',
				seriesId: 'bav',
				seriesName: 'Bavinck'
			}),
			systematicHit({
				refId: 'one',
				bookId: 'hod',
				seriesId: 'hod',
				seriesName: 'Hodge',
				verseStart: 1
			})
		]);

		expect(groupSystematicPointersByVerse(blocks).map((group) => group.verseLabel)).toEqual([
			'7',
			'7:1',
			'7:1–6',
			'7:14'
		]);
	});

	it('orders one verse Calvin, Bavinck, van Mastricht, Turretin, Leiden, then volume and page', () => {
		const verse = { verseStart: 14 };
		const blocks = groupSystematicHits([
			systematicHit({
				refId: 'tur-ii-late',
				bookId: 'tur-2',
				seriesId: 'tur',
				seriesName: 'Institutes of Elenctic Theology (Turretin)',
				authorLabel: 'Francis Turretin',
				volumeNumber: 'II',
				pageStart: '134',
				...verse
			}),
			systematicHit({
				refId: 'lei',
				bookId: 'lei',
				seriesId: 'lei',
				seriesName: 'Synopsis of a Purer Theology',
				authorLabel: 'Johannes Polyander',
				volumeNumber: '1',
				pageStart: '40',
				...verse
			}),
			systematicHit({
				refId: 'tur-ii-early',
				bookId: 'tur-2',
				seriesId: 'tur',
				seriesName: 'Institutes of Elenctic Theology (Turretin)',
				authorLabel: 'Francis Turretin',
				volumeNumber: 'II',
				pageStart: '50',
				...verse
			}),
			systematicHit({
				refId: 'mas',
				bookId: 'mas',
				seriesId: 'mas',
				seriesName: 'Theoretical-Practical Theology (Van Mastricht)',
				authorLabel: 'Petrus van Mastricht',
				volumeNumber: '2',
				pageStart: '249',
				...verse
			}),
			systematicHit({
				refId: 'hod',
				bookId: 'hod',
				seriesId: 'hod',
				seriesName: 'Systematic Theology (Hodge)',
				authorLabel: 'Charles Hodge',
				volumeNumber: '2',
				pageStart: '10',
				...verse
			}),
			systematicHit({
				refId: 'bav',
				bookId: 'bav',
				seriesId: 'bav',
				seriesName: 'Reformed Dogmatics (Bavinck)',
				authorLabel: 'Herman Bavinck',
				volumeNumber: '4',
				pageStart: '136',
				...verse
			}),
			systematicHit({
				refId: 'tur-i',
				bookId: 'tur-1',
				seriesId: 'tur',
				seriesName: 'Institutes of Elenctic Theology (Turretin)',
				authorLabel: 'Francis Turretin',
				volumeNumber: 'I',
				pageStart: '233',
				...verse
			}),
			systematicHit({
				refId: 'cal',
				bookId: 'cal',
				seriesId: 'cal',
				seriesName: 'Institutes of the Christian Religion (McNeill/Battles)',
				authorLabel: 'John Calvin',
				volumeNumber: '1',
				pageStart: 'III.2.12',
				...verse
			})
		]);

		const rows = groupSystematicPointersByVerse(blocks).find(
			(group) => group.verseLabel === '7:14'
		)!.rows;
		expect(rows.map((row) => row.refId)).toEqual([
			'cal',
			'bav',
			'mas',
			'tur-i',
			'tur-ii-early',
			'tur-ii-late',
			'lei',
			'hod'
		]);
		expect(
			rows.filter((row) => row.seriesName.includes('Turretin')).map((row) => row.display)
		).toEqual(['I:233', 'II:50', 'II:134']);
	});
});

describe('section-pointer edge copy', () => {
	it('matches the app module byte for byte', () => {
		const app = readFileSync(resolve('src/lib/library/section-pointer.ts'), 'utf8');
		const edge = readFileSync(
			resolve('supabase/functions/ocr_scripture_refs/section-pointer.ts'),
			'utf8'
		);
		expect(edge).toBe(app);
	});
});

describe('outlineSpansAcrossVolumes', () => {
	it('merges a book heading that continues on the next volume', () => {
		expect(
			outlineSpansAcrossVolumes([
				{ locator: 'III', volume: '1', pageStart: 535, pageEnd: 849 },
				{ locator: 'III', volume: '2', pageStart: 850, pageEnd: 1008 },
				{ locator: 'III.20', volume: '2', pageStart: 850, pageEnd: 919 },
				{ locator: 'IV', volume: '2', pageStart: 1009, pageEnd: 1524 },
				{ locator: 'I', volume: '1', pageStart: 33, pageEnd: 238 }
			])
		).toEqual([
			{
				locator: 'III',
				pageStart: 535,
				pageEnd: 1008,
				volumesLabel: 'vols. 1–2'
			}
		]);
	});
});

describe('buildOutlineTree', () => {
	const topic: OutlineSectionInput = {
		id: 'topic',
		book_id: 'b1',
		parent_id: null,
		sort_order: 1,
		locator: 'I',
		label: 'Theology',
		page_start: 1,
		page_end: 54
	};
	const heading: OutlineSectionInput = {
		id: 'heading',
		book_id: 'b1',
		parent_id: 'topic',
		sort_order: 2,
		locator: null,
		label: 'The Object of Theology',
		page_start: 1,
		page_end: 16
	};
	const question: OutlineSectionInput = {
		id: 'question',
		book_id: 'b1',
		parent_id: 'heading',
		sort_order: 3,
		locator: 'I.1',
		label: 'Whether theology is a science',
		page_start: 1,
		page_end: 3
	};

	it('nests a topic, heading, and question', () => {
		const [root] = buildOutlineTree([question, topic, heading]);
		expect(root?.locator).toBe('I');
		expect(root?.children.map((child) => child.id)).toEqual(['heading']);
		expect(root?.children[0]?.children.map((child) => child.locator)).toEqual(['I.1']);
	});

	it('keeps a flat outline as roots', () => {
		const flat = buildOutlineTree([
			{ ...topic, id: 'a', sort_order: 2 },
			{ ...topic, id: 'b', sort_order: 1, locator: 'II', label: 'Scripture' }
		]);
		expect(flat.map((node) => node.id)).toEqual(['b', 'a']);
		expect(flat.every((node) => node.children.length === 0)).toBe(true);
	});

	it('promotes a row whose parent is missing', () => {
		const [root] = buildOutlineTree([{ ...question, parent_id: 'gone' }]);
		expect(root?.id).toBe('question');
		expect(root?.children).toEqual([]);
	});

	it('nests a Calvin chapter under its book heading', () => {
		const book: OutlineSectionInput = {
			...topic,
			id: 'book-i',
			locator: 'I',
			label: 'The Knowledge of God the Creator',
			page_start: 33,
			page_end: 238
		};
		const chapter: OutlineSectionInput = {
			...question,
			id: 'ch',
			parent_id: null,
			locator: 'I.1',
			label: 'The Knowledge of God and That of Ourselves Are Connected',
			page_start: 35,
			page_end: 38
		};
		const preface: OutlineSectionInput = {
			...topic,
			id: 'preface',
			sort_order: 0,
			locator: null,
			label: 'Prefatory Address',
			page_start: 9,
			page_end: 32
		};
		const tree = buildOutlineTree([chapter, book, preface]);
		expect(tree.map((node) => node.id)).toEqual(['preface', 'book-i']);
		expect(tree[1]?.children.map((child) => child.locator)).toEqual(['I.1']);
	});

	it('does not pull a parented question up to the book heading', () => {
		const [root] = buildOutlineTree([question, heading, topic]);
		expect(root?.children.map((child) => child.id)).toEqual(['heading']);
	});

	it('keeps II.1 out of book I', () => {
		const book: OutlineSectionInput = { ...topic, id: 'book-i' };
		const other: OutlineSectionInput = {
			...question,
			id: 'two',
			parent_id: null,
			locator: 'II.1',
			label: 'The Fall'
		};
		const tree = buildOutlineTree([book, other]);
		expect(tree.map((node) => node.locator)).toEqual(['I', 'II.1']);
	});
});

describe('parseOutlineTsv', () => {
	it('parses locator\\tlabel\\tpages', () => {
		expect(parseOutlineTsvLine('XV.17\tFull Assurance\t610-630')).toEqual({
			locator: 'XV.17',
			label: 'Full Assurance',
			pageStart: 610,
			pageEnd: 630
		});
	});

	it('parses label\\tpages when no locator', () => {
		expect(parseOutlineTsvLine('Repentance\t136')).toEqual({
			locator: null,
			label: 'Repentance',
			pageStart: 136,
			pageEnd: 136
		});
	});

	it('counts skipped bad lines', () => {
		const { rows, skipped } = parseOutlineTsv(
			'XV.17\tFull Assurance\t610-630\nbad line\n\nRepentance\t136'
		);
		expect(rows).toHaveLength(2);
		expect(skipped).toBe(1);
	});
});
