/**
 * Best-effort parse of a human passage string into structured sermon_passages rows.
 * Supports common seminary/church forms:
 *   "Mark 1:16-34", "Genesis 15", "1 John 1:1-4",
 *   "Proverbs 14:17, 29; 15:1; 16:32" (book once, chapter:verse clusters).
 */

import { BIBLE_BOOK_NAMES } from '$lib/library/bible-book-names';

export type ParsedSermonPassage = {
	bible_book: string;
	chapter_start: number | null;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
};

/** Longest-first so "1 John" wins over "John", "Song of Songs" over "Song". */
const BOOK_NAMES_LONGEST_FIRST = [...BIBLE_BOOK_NAMES].sort((a, b) => b.length - a.length);

function matchBibleBook(raw: string): { book: string; rest: string } | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	const lower = trimmed.toLowerCase();
	for (const name of BOOK_NAMES_LONGEST_FIRST) {
		const n = name.toLowerCase();
		if (lower === n) return { book: name, rest: '' };
		if (lower.startsWith(n + ' ')) {
			return { book: name, rest: trimmed.slice(name.length).trim() };
		}
	}
	return null;
}

function parseIntStrict(s: string): number | null {
	const n = Number.parseInt(s, 10);
	return Number.isFinite(n) && n > 0 ? n : null;
}

/** Parse "14:17-19", "14:17", "14", "14:17, 29" → one or more ranges in same chapter. */
function parseChapterVerseCluster(
	bible_book: string,
	cluster: string
): ParsedSermonPassage[] {
	const t = cluster.trim();
	if (!t) return [];

	const chapterOnly = parseIntStrict(t);
	if (chapterOnly != null && !t.includes(':')) {
		return [
			{
				bible_book,
				chapter_start: chapterOnly,
				verse_start: null,
				chapter_end: null,
				verse_end: null
			}
		];
	}

	const colon = t.indexOf(':');
	if (colon < 0) return [];

	const chapter = parseIntStrict(t.slice(0, colon));
	if (chapter == null) return [];

	const versePart = t.slice(colon + 1).trim();
	const verseBits = versePart.split(',').map((s) => s.trim()).filter(Boolean);
	const out: ParsedSermonPassage[] = [];

	for (const bit of verseBits) {
		const range = bit.split('-').map((s) => s.trim());
		const vs = parseIntStrict(range[0] ?? '');
		if (vs == null) continue;
		const ve = range.length > 1 ? parseIntStrict(range[1] ?? '') : null;
		out.push({
			bible_book,
			chapter_start: chapter,
			verse_start: vs,
			chapter_end: ve != null ? chapter : null,
			verse_end: ve
		});
	}

	return out;
}

/**
 * Parse a full passage_display string into zero or more structured rows.
 * Returns [] when nothing reliable can be extracted (caller keeps display text).
 */
export function parsePassageDisplay(input: string): ParsedSermonPassage[] {
	const raw = input.trim();
	if (!raw) return [];

	const matched = matchBibleBook(raw);
	if (!matched) return [];

	const { book, rest } = matched;
	if (!rest) {
		// Whole book (unusual for sermons) — store book-only row.
		return [
			{
				bible_book: book,
				chapter_start: null,
				verse_start: null,
				chapter_end: null,
				verse_end: null
			}
		];
	}

	// Split on semicolon for multi-chapter clusters (Proverbs style).
	const clusters = rest.split(';').map((s) => s.trim()).filter(Boolean);
	const out: ParsedSermonPassage[] = [];
	for (const cluster of clusters) {
		out.push(...parseChapterVerseCluster(book, cluster));
	}
	return out;
}

/** Build `/library/search-passage` query from the first structured passage. */
export function librarySearchHref(
	p: ParsedSermonPassage | null | undefined,
	opts?: { returnTo?: string }
): string | null {
	if (!p?.bible_book) return null;
	const params = new URLSearchParams();
	params.set('bible_book', p.bible_book);
	if (p.chapter_start != null) params.set('chapter', String(p.chapter_start));
	if (p.verse_start != null) params.set('verse', String(p.verse_start));
	if (p.chapter_end != null && p.chapter_end !== p.chapter_start) {
		params.set('chapter_end', String(p.chapter_end));
	}
	if (
		p.verse_end != null &&
		(p.verse_end !== p.verse_start ||
			(p.chapter_end != null && p.chapter_end !== p.chapter_start))
	) {
		params.set('verse_end', String(p.verse_end));
	}
	if (opts?.returnTo) params.set('returnTo', opts.returnTo);
	return `/library/search-passage?${params.toString()}`;
}

export function formatPassageRow(p: {
	bible_book: string;
	chapter_start: number | null;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
}): string {
	const { bible_book, chapter_start, verse_start, chapter_end, verse_end } = p;
	if (chapter_start == null) return bible_book;
	if (verse_start == null) {
		if (chapter_end != null && chapter_end !== chapter_start) {
			return `${bible_book} ${chapter_start}–${chapter_end}`;
		}
		return `${bible_book} ${chapter_start}`;
	}
	let s = `${bible_book} ${chapter_start}:${verse_start}`;
	if (verse_end != null && (chapter_end == null || chapter_end === chapter_start)) {
		if (verse_end !== verse_start) s += `–${verse_end}`;
	} else if (chapter_end != null && verse_end != null) {
		s += `–${chapter_end}:${verse_end}`;
	}
	return s;
}
