import { describe, expect, it } from 'vitest';
import {
	paragraphsFromDocumentXml,
	parseCalvinCitation,
	parseCalvinParagraphs
} from '../calvin-index-parse.ts';
import {
	planCalvinImport,
	resolveCalvinVolumes,
	type CalvinExistingRef,
	type CalvinVolume
} from '../calvin-index-plan.ts';

const OWNER = '00000000-0000-4000-8000-000000000001';
const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';

function chapters(prefix: string, from: number, to: number): string[] {
	const out: string[] = [];
	for (let n = from; n <= to; n += 1) out.push(`${prefix}.${n}`);
	return out;
}

const volumes: CalvinVolume[] = [
	{
		bookId: V1,
		volumeNumber: '1',
		locators: [...chapters('I', 1, 18), ...chapters('II', 1, 17), ...chapters('III', 1, 19)]
	},
	{
		bookId: V2,
		volumeNumber: '2',
		locators: [...chapters('III', 20, 25), ...chapters('IV', 1, 20)]
	}
];

const books = new Set([
	'Genesis',
	'Psalms',
	'Song of Songs',
	'Sirach',
	'Obadiah',
	'Philemon',
	'Jude',
	'1 Thessalonians',
	'Matthew',
	'Romans',
	'Acts'
]);

function one(book: string, verse: string, locator: string) {
	const parsed = parseCalvinCitation(book, verse, locator);
	expect(parsed.ok, parsed.ok ? '' : parsed.reason).toBe(true);
	if (!parsed.ok) throw new Error(parsed.reason);
	return parsed.rows;
}

describe('parseCalvinCitation', () => {
	it('reads a plain section cite', () => {
		const [row] = one('Genesis', '1:1', '1.14.20');
		expect(row).toMatchObject({
			chapter_start: 1,
			verse_start: 1,
			chapter_end: null,
			page_start: '1.14.20',
			needs_review: false,
			review_note: null
		});
	});

	it('keeps a version tag off the locator and does not flag it', () => {
		const [row] = one('Genesis', '1:2, cf Vg', '1.13.14');
		expect(row!.review_note).toBe('cf Vg');
		expect(row!.needs_review).toBe(false);
	});

	it('peels a glued quotation mark and an open ending', () => {
		expect(one('Genesis', '1:27p', '2.1.1')[0]).toMatchObject({
			verse_start: 27,
			review_note: 'p',
			needs_review: false
		});
		expect(one('Genesis', '12:11ff', '2.10.11')[0]).toMatchObject({
			verse_start: 11,
			review_note: 'ff'
		});
	});

	it('stores a same-chapter range with chapter_end set', () => {
		expect(one('1 Thessalonians', '1:4–5', '3.2.11')[0]).toMatchObject({
			chapter_start: 1,
			verse_start: 4,
			chapter_end: 1,
			verse_end: 5,
			page_start: '3.2.11'
		});
	});

	it('keeps a version tag that sits between the English verse and the Vulgate twin', () => {
		const [row] = one('Psalms', '103:8 Comm/102:8', '3.2.29');
		expect(row).toMatchObject({
			chapter_start: 103,
			verse_start: 8,
			review_note: 'Vg 102:8; Comm',
			needs_review: false
		});
	});

	it('keeps the English psalm and notes the Vulgate twin', () => {
		const [row] = one('Psalms', '4:6/4:7', '1.11.14');
		expect(row).toMatchObject({ chapter_start: 4, verse_start: 6, review_note: 'Vg 4:7' });
	});

	it('splits a same-chapter verse list into one row per verse', () => {
		const rows = one('Genesis', '5:1, 4', '1.14.1');
		expect(rows.map((r) => r.verse_start)).toEqual([1, 4]);
		expect(rows.every((r) => r.page_start === '1.14.1')).toBe(true);
	});

	it('keeps a chapter list as one span', () => {
		expect(one('Genesis', 'chs. 1; 2', '1.14.20')[0]).toMatchObject({
			chapter_start: 1,
			verse_start: null,
			chapter_end: 2
		});
		expect(one('Leviticus', 'chs. 4:1 to 7:16', '3.4.30')[0]).toMatchObject({
			chapter_start: 4,
			verse_start: 1,
			chapter_end: 7,
			verse_end: 16
		});
	});

	it('reads a whole psalm, and a bare verse on a one-chapter book', () => {
		expect(one('Psalms', '21', '4.20.5')[0]).toMatchObject({
			chapter_start: 21,
			verse_start: null
		});
		expect(one('Philemon', '6', '3.2.14')[0]).toMatchObject({
			chapter_start: 1,
			verse_start: 6
		});
		expect(one('Obadiah', 'v. 17, cf Vg', '4.1.3')[0]).toMatchObject({
			chapter_start: 1,
			verse_start: 17,
			review_note: 'cf Vg'
		});
	});

	it('stores paragraph numbers and the Prefatory Address apart from the section', () => {
		expect(one('Exodus', '12:5', '4.16.31, par 17')[0]).toMatchObject({
			page_start: '4.16.31',
			review_note: 'par 17',
			needs_review: false,
			edition: false
		});
		expect(one('Genesis', '47:10', 'l.11.15')[0]!.page_start).toBe('1.11.15');
		expect(one('Genesis', '7:1', 'PA5')[0]).toMatchObject({
			page_start: 'PA 5',
			needs_review: true,
			edition: true
		});
	});

	it('flags the one triple-slash line and keeps half-verses', () => {
		expect(one('Acts', '14:16–17/15–16/p', '1.5.14')[0]!.needs_review).toBe(true);
		expect(one('Genesis', '16:2a', '1.1.1')[0]).toMatchObject({
			verse_start: 2,
			review_note: 'a',
			needs_review: false
		});
	});
});

describe('parseCalvinParagraphs', () => {
	it('maps aliases and does not let the Psalms note become a book', () => {
		const xml = `
      <w:p><w:r><w:t>Canticles</w:t></w:r></w:p>
      <w:p><w:r><w:t>1:1</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>3.20.1</w:t></w:r></w:p>
      <w:p><w:r><w:t>Psalms</w:t></w:r></w:p>
      <w:p><w:r><w:t>Calvin frequently quotes the psalms in a Vulgate form.</w:t></w:r></w:p>
      <w:p><w:r><w:tab/></w:r><w:r><w:t>4:6/4:7</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>1.11.14</w:t></w:r></w:p>
      <w:p><w:r><w:tab/></w:r><w:r><w:t>p.</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>quotation or near-quotation</w:t></w:r></w:p>
    `.replace('1:1</w:t>', '1:1&#x2013;2</w:t>');
		const paras = paragraphsFromDocumentXml(xml);
		const parsed = parseCalvinParagraphs(paras);
		expect(parsed.glossary).toBe(1);
		expect(parsed.failures).toEqual([]);
		expect(parsed.rows[0]).toMatchObject({
			bible_book: 'Song of Songs',
			verse_start: 1,
			verse_end: 2,
			chapter_end: 1
		});
		expect(parsed.rows[1]).toMatchObject({ bible_book: 'Psalms', verse_start: 6 });
	});
});

describe('planCalvinImport', () => {
	it('routes Book III chapter 2 to volume 1 and chapter 20 to volume 2', () => {
		const rows = [
			...one('1 Thessalonians', '1:5', '3.2.15'),
			...one('1 Thessalonians', '3:5', '4.1.6'),
			...one('Genesis', '7:1', 'PA5')
		];
		const plan = planCalvinImport({
			rows,
			volumes,
			existing: [],
			knownBibleBooks: books,
			ownerId: OWNER
		});
		expect(plan.failures).toEqual([]);
		expect(plan.inserts.map((r) => [r.book_id, r.page_start])).toEqual([
			[V1, '3.2.15'],
			[V2, '4.1.6'],
			[V1, 'PA 5']
		]);
		expect(plan.inserts[2]!.needs_review).toBe(true);
	});

	it('refuses a chapter that the outline does not own exactly once', () => {
		const missing = planCalvinImport({
			rows: one('Romans', '8:24', '3.2.41'),
			volumes: [{ ...volumes[1]!, locators: chapters('IV', 1, 20) }],
			existing: [],
			knownBibleBooks: books,
			ownerId: OWNER
		});
		expect(missing.failures[0]!.reason).toBe('outline_chapter_missing');
		expect(missing.inserts).toEqual([]);
		expect(missing.retireIds).toEqual([]);

		const both: CalvinVolume[] = [
			{ bookId: V1, volumeNumber: '1', locators: ['III.2'] },
			{ bookId: V2, volumeNumber: '2', locators: ['III.2'] }
		];
		const doubled = planCalvinImport({
			rows: one('Romans', '8:24', '3.2.41'),
			volumes: both,
			existing: [],
			knownBibleBooks: books,
			ownerId: OWNER
		});
		expect(doubled.failures[0]!.reason).toBe('outline_chapter_on_two_volumes');
	});

	it('keeps repeated file rows and retires a practice row with a different locator', () => {
		const practice: CalvinExistingRef = {
			id: 'practice-1',
			book_id: V2,
			bible_book: '1 Thessalonians',
			chapter_start: 1,
			verse_start: 5,
			chapter_end: null,
			verse_end: null,
			page_start: 'IV.1.6',
			page_end: null,
			deleted_at: null
		};
		const plan = planCalvinImport({
			rows: [...one('Genesis', '1:27', '2.1.1'), ...one('Genesis', '1:27', '2.1.1')],
			volumes,
			existing: [practice],
			knownBibleBooks: books,
			ownerId: OWNER
		});
		expect(plan.inserts).toHaveLength(2);
		expect(plan.retireIds).toEqual(['practice-1']);
	});

	it('skips a live twin and does not revive a deleted one', () => {
		const live = one('Matthew', '8:10', '3.2.13')[0]!;
		const existing: CalvinExistingRef = {
			id: 'live-1',
			book_id: V1,
			bible_book: 'Matthew',
			chapter_start: 8,
			verse_start: 10,
			chapter_end: null,
			verse_end: null,
			page_start: '3.2.13',
			page_end: null,
			deleted_at: null
		};
		const deleted: CalvinExistingRef = { ...existing, id: 'gone-1', deleted_at: '2026-10-01' };
		const plan = planCalvinImport({
			rows: [live, live],
			volumes,
			existing: [existing, deleted],
			knownBibleBooks: books,
			ownerId: OWNER
		});
		expect(plan.inserts).toEqual([]);
		expect(plan.skippedLive).toBe(1);
		expect(plan.skippedDeleted).toBe(1);
		expect(plan.retireIds).toEqual([]);
	});
});

describe('resolveCalvinVolumes', () => {
	it('requires a chapter outline on both volumes', () => {
		const ok = resolveCalvinVolumes(
			[
				{ id: V1, volume_number: '1', deleted_at: null },
				{ id: V2, volume_number: '2', deleted_at: null },
				{ id: 'other', volume_number: null, deleted_at: null }
			],
			new Map([
				[V1, ['I', 'I.1', null]],
				[V2, ['IV.1']]
			])
		);
		expect(ok.ok).toBe(true);
		if (ok.ok) expect(ok.volumes[0]!.locators).toEqual(['I.1']);
	});
});
