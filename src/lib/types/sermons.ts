/** Closed enums and view-models for the sermons module. */

export const CONTEXT_TYPES = ['church', 'parachurch', 'academic'] as const;
export type ContextType = (typeof CONTEXT_TYPES)[number];

export const CONTEXT_TYPE_LABELS: Record<ContextType, string> = {
	church: 'Church',
	parachurch: 'Parachurch',
	academic: 'Academic'
};

/** Short labels matching Parker's C / P / A spreadsheet. */
export const CONTEXT_TYPE_SHORT: Record<ContextType, string> = {
	church: 'C',
	parachurch: 'P',
	academic: 'A'
};

/**
 * Static Tailwind badge/chip classes for context type.
 * Church = green, parachurch = yellow, academic = blue.
 */
export const CONTEXT_TYPE_BADGE_CLASSES: Record<ContextType, string> = {
	church: 'border-emerald-600/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
	parachurch: 'border-amber-600/40 bg-amber-500/15 text-amber-900 dark:text-amber-300',
	academic: 'border-sky-600/40 bg-sky-500/15 text-sky-900 dark:text-sky-300'
};

/** Selected filter chip variants (stronger fill). */
export const CONTEXT_TYPE_FILTER_ACTIVE_CLASSES: Record<ContextType, string> = {
	church: 'border-emerald-700 bg-emerald-600 text-white',
	parachurch: 'border-amber-700 bg-amber-500 text-amber-950',
	academic: 'border-sky-700 bg-sky-600 text-white'
};

export type SermonVenueRow = {
	id: string;
	name: string;
	notes: string | null;
	sermonCount: number;
};

export type SermonPassageRow = {
	id: string;
	bible_book: string;
	chapter_start: number | null;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
	sort_order: number;
};

export type SermonListRow = {
	id: string;
	preached_on: string;
	venue_id: string | null;
	venue_name: string | null;
	context_type: ContextType | null;
	topic: string | null;
	passage_display: string | null;
	notes: string | null;
	passages: SermonPassageRow[];
	library_search_href: string | null;
};

export type SermonListFilters = {
	year: number | null;
	context: ContextType | null;
	venueId: string | null;
	/** Distinct sermons with a live passage on this Protestant canon book. */
	bibleBook: string | null;
};

/** Sort keys for `/sermons/by-book` (bidirectional via `sortDir`). */
export const BY_BOOK_SORTS = ['canon', 'sermons', 'commentaries', 'four_star'] as const;
export type ByBookSort = (typeof BY_BOOK_SORTS)[number];

export const BY_BOOK_SORT_LABELS: Record<ByBookSort, string> = {
	canon: 'Canon',
	sermons: 'Sermons',
	commentaries: 'Commentaries',
	four_star: '4★+'
};

export type ByBookSortDir = 'asc' | 'desc';

export type ByBookTestamentFilter = 'ot' | 'nt' | null;

export type ByBookListFilters = {
	sort: ByBookSort;
	sortDir: ByBookSortDir;
	testament: ByBookTestamentFilter;
	hasSermons: boolean;
	noCommentaries: boolean;
	hasFourStar: boolean;
};

/** Commentary (or Also-on-shelf book) hit for one Bible book. */
export type ByBookShelfHit = {
	kind: 'book' | 'essay';
	/** Book id, or parent book id for essays. */
	bookId: string;
	/** Essay id when `kind === 'essay'`. */
	essayId: string | null;
	title: string;
	/** Short author line, or null when unknown / unsigned. */
	authorShort: string | null;
	/** 1–5 when rated; null = unrated (commentaries still list). */
	rating: number | null;
	genre: string | null;
	href: string;
};

export type ByBookRow = {
	bibleBook: string;
	canonIndex: number;
	testament: 'ot' | 'nt';
	sermonCount: number;
	commentaryCount: number;
	fourStarCount: number;
	commentaries: ByBookShelfHit[];
	alsoOnShelf: ByBookShelfHit[];
};

export type ByBookSummary = {
	/** Distinct live sermons with ≥1 structured passage. */
	sermonTotal: number;
	/** Distinct Commentary-genre books with ≥1 bible coverage. */
	commentaryTotal: number;
	/** Distinct commentaries rated ≥4. */
	fourStarTotal: number;
};
