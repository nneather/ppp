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
