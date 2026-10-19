/**
 * Structural validators for scripture-index OCR rows ([252]).
 * Violations → needs_review with a reason string.
 */

import { BIBLE_BOOK_NAMES } from '$lib/library/bible-book-names';
import { pageNumberFromText } from '$lib/library/outline';
import { parseSectionPointer } from '$lib/library/section-pointer';

export type IndexValidateRow = {
	bible_book: string;
	chapter_start?: number | null;
	verse_start?: number | null;
	chapter_end?: number | null;
	verse_end?: number | null;
	page_start?: string | null;
};

/** Protestant canon chapter counts (KJV versification). */
export const BIBLE_CHAPTER_COUNTS: Record<string, number> = {
	Genesis: 50,
	Exodus: 40,
	Leviticus: 27,
	Numbers: 36,
	Deuteronomy: 34,
	Joshua: 24,
	Judges: 21,
	Ruth: 4,
	'1 Samuel': 31,
	'2 Samuel': 24,
	'1 Kings': 22,
	'2 Kings': 25,
	'1 Chronicles': 29,
	'2 Chronicles': 36,
	Ezra: 10,
	Nehemiah: 13,
	Esther: 10,
	Job: 42,
	Psalms: 150,
	Proverbs: 31,
	Ecclesiastes: 12,
	'Song of Songs': 8,
	Isaiah: 66,
	Jeremiah: 52,
	Lamentations: 5,
	Ezekiel: 48,
	Daniel: 12,
	Hosea: 14,
	Joel: 3,
	Amos: 9,
	Obadiah: 1,
	Jonah: 4,
	Micah: 7,
	Nahum: 3,
	Habakkuk: 3,
	Zephaniah: 3,
	Haggai: 2,
	Zechariah: 14,
	Malachi: 4,
	Matthew: 28,
	Mark: 16,
	Luke: 24,
	John: 21,
	Acts: 28,
	Romans: 16,
	'1 Corinthians': 16,
	'2 Corinthians': 13,
	Galatians: 6,
	Ephesians: 6,
	Philippians: 4,
	Colossians: 4,
	'1 Thessalonians': 5,
	'2 Thessalonians': 3,
	'1 Timothy': 6,
	'2 Timothy': 4,
	Titus: 3,
	Philemon: 1,
	Hebrews: 13,
	James: 5,
	'1 Peter': 5,
	'2 Peter': 3,
	'1 John': 5,
	'2 John': 1,
	'3 John': 1,
	Jude: 1,
	Revelation: 22
};

/** Soft verse ceiling (Psalm 119 is 176). */
const MAX_VERSE = 176;

const BOOK_SET = new Set(BIBLE_BOOK_NAMES);

export type IndexValidateIssue = {
	index: number;
	reason: string;
};

function absKey(row: IndexValidateRow): number | null {
	const bookIdx = BIBLE_BOOK_NAMES.indexOf(row.bible_book as (typeof BIBLE_BOOK_NAMES)[number]);
	if (bookIdx < 0) return null;
	const ch = row.chapter_start ?? 0;
	const vs = row.verse_start ?? 0;
	return bookIdx * 1_000_000 + ch * 1000 + vs;
}

export function validateIndexRows(
	rows: IndexValidateRow[],
	opts?: { pageMin?: number; pageMax?: number }
): IndexValidateIssue[] {
	const issues: IndexValidateIssue[] = [];
	let prevAbs: number | null = null;

	for (let i = 0; i < rows.length; i++) {
		const r = rows[i]!;
		if (!BOOK_SET.has(r.bible_book as (typeof BIBLE_BOOK_NAMES)[number])) {
			issues.push({ index: i, reason: 'unknown_bible_book' });
			continue;
		}

		const maxCh = BIBLE_CHAPTER_COUNTS[r.bible_book];
		if (r.chapter_start != null && maxCh != null && r.chapter_start > maxCh) {
			issues.push({ index: i, reason: 'chapter_out_of_range' });
		}
		if (r.chapter_end != null && maxCh != null && r.chapter_end > maxCh) {
			issues.push({ index: i, reason: 'chapter_end_out_of_range' });
		}
		if (r.verse_start != null && (r.verse_start < 1 || r.verse_start > MAX_VERSE)) {
			issues.push({ index: i, reason: 'verse_out_of_range' });
		}
		if (r.verse_end != null && (r.verse_end < 1 || r.verse_end > MAX_VERSE)) {
			issues.push({ index: i, reason: 'verse_end_out_of_range' });
		}

		const page = parseSectionPointer(r.page_start, null)
			? null
			: pageNumberFromText(r.page_start);
		if (page != null) {
			if (opts?.pageMin != null && page < opts.pageMin) {
				issues.push({ index: i, reason: 'page_below_outline' });
			}
			if (opts?.pageMax != null && page > opts.pageMax) {
				issues.push({ index: i, reason: 'page_above_outline' });
			}
		}

		const abs = absKey(r);
		if (abs != null && prevAbs != null && abs < prevAbs) {
			issues.push({ index: i, reason: 'out_of_canonical_order' });
		}
		if (abs != null) prevAbs = abs;
	}

	return issues;
}

/**
 * Lower confidence and attach a review_note when a row fails structural
 * checks or two-pass consensus.
 */
export function flagIndexCandidates<
	T extends IndexValidateRow & { confidence_score: number; consensus_flag?: string }
>(rows: T[]): (T & { review_note?: string })[] {
	const issues = validateIndexRows(rows);
	const byIndex = new Map<number, string[]>();
	for (const issue of issues) {
		const list = byIndex.get(issue.index) ?? [];
		list.push(issue.reason);
		byIndex.set(issue.index, list);
	}
	return rows.map((row, i) => {
		const reasons = [...(byIndex.get(i) ?? [])];
		if (row.consensus_flag && row.consensus_flag !== 'ok') reasons.push(row.consensus_flag);
		if (reasons.length === 0) return row;
		return {
			...row,
			confidence_score: Math.min(row.confidence_score, 0.7),
			review_note: reasons.join(', ')
		};
	});
}
