/**
 * Pure helpers for `/library/search-passage` band placement.
 *
 * Bands (high → low): commentary coverage → passage sections → other
 * coverage → scripture index. Search abs bounds mirror
 * `search_scripture_refs` (20260722184251).
 */

export type PassageBand = 'commentary' | 'section' | 'coverage' | 'index';

export const PASSAGE_BAND_ORDER: PassageBand[] = [
	'commentary',
	'section',
	'coverage',
	'index'
];

export const PASSAGE_BAND_LABELS: Record<PassageBand, string> = {
	commentary: 'Commentaries',
	section: 'On this passage',
	coverage: 'Also covers this book',
	index: 'Scripture index'
};

/** Inclusive abs bounds for a passage query (matches the SQL RPC). */
export function searchPassageAbsBounds(input: {
	chapter: number | null;
	verse: number | null;
	chapterEnd: number | null;
	verseEnd: number | null;
}): { start: number; end: number } {
	const { chapter, verse, chapterEnd, verseEnd } = input;
	const start = chapter == null ? 0 : chapter * 1000 + (verse ?? 0);
	let end: number;
	if (chapter == null) {
		end = 999999;
	} else if (chapterEnd != null) {
		end = chapterEnd * 1000 + (verseEnd ?? 999);
	} else if (verseEnd != null) {
		end = chapter * 1000 + verseEnd;
	} else {
		end = chapter * 1000 + (verse ?? 999);
	}
	return { start, end };
}

/** Inclusive overlap: ranges touch or intersect. */
export function rangesOverlap(
	aStart: number,
	aEnd: number,
	bStart: number,
	bEnd: number
): boolean {
	return aStart <= bEnd && aEnd >= bStart;
}

export type PassageBandInput = {
	/** Coverage rows with optional genre (null = unknown → other coverage). */
	coverages: { bookId: string; genre: string | null }[];
	/** Section hits already filtered to overlapping ranges. */
	sections: { bookId: string }[];
	/** Scripture index hits (all kept in the index band). */
	indexHits: { bookId: string | null }[];
};

/**
 * Assign books to bands. Commentary coverage wins over a section for the
 * same book. Books in commentary or section are omitted from other coverage.
 * Index hits are never dropped by a section or coverage hit.
 */
export function assignPassageBands(input: PassageBandInput): {
	commentaryBookIds: Set<string>;
	sectionBookIds: Set<string>;
	coverageBookIds: Set<string>;
} {
	const commentaryBookIds = new Set<string>();
	for (const c of input.coverages) {
		if (c.genre === 'Commentary') commentaryBookIds.add(c.bookId);
	}

	const sectionBookIds = new Set<string>();
	for (const s of input.sections) {
		if (!commentaryBookIds.has(s.bookId)) sectionBookIds.add(s.bookId);
	}

	const coverageBookIds = new Set<string>();
	for (const c of input.coverages) {
		if (c.genre === 'Commentary') continue;
		if (commentaryBookIds.has(c.bookId) || sectionBookIds.has(c.bookId)) continue;
		coverageBookIds.add(c.bookId);
	}

	return { commentaryBookIds, sectionBookIds, coverageBookIds };
}
