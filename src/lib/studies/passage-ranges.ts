/**
 * Study passage → inclusive ranges for passage-section overlap.
 *
 * Structured primary rows win (sermon_passages / paper_passages). Otherwise
 * the display string is parsed. "Psalm" aliases to Psalms. An en dash is a
 * hyphen. "Matthew 5-7" is a chapter span. A second book after "and" is its
 * own range; semicolon clusters inside one book stay together.
 */
import { bibleBooksInDisplay } from '$lib/studies/import-suggest';
import { parsePassageDisplay, type ParsedSermonPassage } from '$lib/sermons/passage-parse';

export type StudyPassageRange = {
	bibleBook: string;
	chapter: number | null;
	verse: number | null;
	chapterEnd: number | null;
	verseEnd: number | null;
};

export type StructuredStudyPassage = {
	bible_book: string;
	chapter_start: number | null;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
};

function normalizePassageDisplay(input: string): string {
	return input
		.replace(/[–—]/g, '-')
		.replace(/\bsong of solomon\b/gi, 'Song of Songs')
		.replace(/\bpsalms?\b/gi, 'Psalms');
}

function fromParsed(row: ParsedSermonPassage): StudyPassageRange {
	return {
		bibleBook: row.bible_book,
		chapter: row.chapter_start,
		verse: row.verse_start,
		chapterEnd: row.chapter_end,
		verseEnd: row.verse_end
	};
}

/** "Matthew 5-7" → chapter span. Verse ranges ("Mark 1:16-34") fall through. */
function chapterSpan(chunk: string): StudyPassageRange | null {
	const match = chunk.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)$/);
	if (!match) return null;
	const bookRaw = match[1]?.trim() ?? '';
	const books = bibleBooksInDisplay(bookRaw);
	const book = books[0];
	if (!book || books.length !== 1 || bookRaw.toLowerCase() !== book.toLowerCase()) return null;
	const chapter = Number(match[2]);
	const chapterEnd = Number(match[3]);
	if (!Number.isFinite(chapter) || !Number.isFinite(chapterEnd) || chapterEnd < chapter) return null;
	return {
		bibleBook: book,
		chapter,
		verse: null,
		chapterEnd,
		verseEnd: null
	};
}

function rangesFromChunk(chunk: string): StudyPassageRange[] {
	const span = chapterSpan(chunk);
	if (span) return [span];
	return parsePassageDisplay(chunk).map(fromParsed);
}

function rangesFromDisplay(input: string | null | undefined): StudyPassageRange[] {
	const normalized = normalizePassageDisplay(input?.trim() ?? '');
	if (!normalized) return [];
	const books = bibleBooksInDisplay(normalized);
	const chunks =
		books.length > 1 ? normalized.split(/\s+and\s+/i).map((part) => part.trim()).filter(Boolean) : [normalized];
	const out: StudyPassageRange[] = [];
	for (const chunk of chunks) out.push(...rangesFromChunk(chunk));
	return out;
}

export function studyPassageRanges(
	passageDisplay: string | null | undefined,
	structured?: readonly StructuredStudyPassage[] | null
): StudyPassageRange[] {
	const rows = (structured ?? []).filter((row) => row.bible_book.trim().length > 0);
	if (rows.length > 0) {
		return rows.map((row) => ({
			bibleBook: row.bible_book,
			chapter: row.chapter_start,
			verse: row.verse_start,
			chapterEnd: row.chapter_end,
			verseEnd: row.verse_end
		}));
	}
	return rangesFromDisplay(passageDisplay);
}
