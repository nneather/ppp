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
};
