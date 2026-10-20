/**
 * Apocrypha book names + soft validators for the Turretin text-layer parser.
 * Parser/gate only — `bible_books` vocab is deferred to the insert session.
 */

export const APOCRYPHA_BOOKS = [
	'2 Esdras',
	'Tobit',
	'Judith',
	'Wisdom of Solomon',
	'Sirach',
	'Baruch',
	'1 Maccabees',
	'2 Maccabees'
] as const;

export type ApocryphaBook = (typeof APOCRYPHA_BOOKS)[number];

/** Printed index headings that normalize to NRSV names. */
export const APOCRYPHA_HEADING_ALIASES: Record<string, ApocryphaBook> = {
	'son of sirach': 'Sirach',
	ecclesiasticus: 'Sirach',
	'wisdom of sirach': 'Sirach'
};

/** Soft chapter ceilings (NRSV / Vulgate-ish). */
export const APOCRYPHA_CHAPTER_COUNTS: Record<ApocryphaBook, number> = {
	'2 Esdras': 16,
	Tobit: 14,
	Judith: 16,
	'Wisdom of Solomon': 19,
	Sirach: 51,
	Baruch: 6,
	'1 Maccabees': 16,
	'2 Maccabees': 15
};

const APOCRYPHA_SET = new Set<string>(APOCRYPHA_BOOKS);
const MAX_VERSE = 176;

export function isApocryphaBook(name: string): boolean {
	return APOCRYPHA_SET.has(name);
}

export type ApocryphaValidateRow = {
	bible_book: string;
	chapter_start?: number | null;
	verse_start?: number | null;
	chapter_end?: number | null;
	verse_end?: number | null;
};

export type ApocryphaValidateIssue = {
	index: number;
	reason: string;
};

function absKey(row: ApocryphaValidateRow): number | null {
	const bookIdx = APOCRYPHA_BOOKS.indexOf(row.bible_book as ApocryphaBook);
	if (bookIdx < 0) return null;
	const ch = row.chapter_start ?? 0;
	const vs = row.verse_start ?? 0;
	return bookIdx * 1_000_000 + ch * 1000 + vs;
}

/**
 * Structural checks for apocrypha rows (mirrors validateIndexRows reasons).
 * Does not emit short_page_among_longer — that stays on the canon validator.
 */
export function validateApocryphaRows(rows: ApocryphaValidateRow[]): ApocryphaValidateIssue[] {
	const issues: ApocryphaValidateIssue[] = [];
	let prevAbs: number | null = null;

	for (let i = 0; i < rows.length; i++) {
		const r = rows[i]!;
		if (!APOCRYPHA_SET.has(r.bible_book)) {
			issues.push({ index: i, reason: 'unknown_bible_book' });
			continue;
		}

		const maxCh = APOCRYPHA_CHAPTER_COUNTS[r.bible_book as ApocryphaBook];
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

		const abs = absKey(r);
		if (abs != null && prevAbs != null && abs < prevAbs) {
			issues.push({ index: i, reason: 'out_of_canonical_order' });
		}
		if (abs != null) prevAbs = abs;
	}

	return issues;
}
