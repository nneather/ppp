import type {
	BookAuthorAssignment,
	BookDetail,
	Language,
	ReviewSlice,
	WorkType
} from '$lib/types/library';

export type { ReviewSlice };

/** Genres that define the Citation Critical scholarly-core slice (Session 8 / decision 022). */
export const CITATION_CRITICAL_GENRES = [
	'Commentary',
	'Bibles',
	'Biblical Reference',
	'Greek Language Tools',
	'Hebrew Language Tools',
	'Latin Language Tools',
	'German Language Tools',
	'Chinese Language Tools'
] as const;

export type CitationCriticalGenre = (typeof CITATION_CRITICAL_GENRES)[number];

export type CitationSourceType =
	| 'bible'
	| 'single-author-book'
	| 'edited-volume'
	| 'book-with-translator'
	| 'multi-volume'
	| 'commentary-in-series'
	| 'standalone-commentary'
	| 'reference-work-edited'
	| 'reference-work-single-author'
	| 'book-with-editor';

/** Hydrated book shape for pure citation formatters — no DB access inside formatters. */
export type BookCitationInput = {
	id: string;
	title: string | null;
	subtitle: string | null;
	publisher: string | null;
	publisher_location: string | null;
	year: number | null;
	edition: string | null;
	total_volumes: number | null;
	original_year: number | null;
	reprint_publisher: string | null;
	reprint_location: string | null;
	reprint_year: number | null;
	series_name: string | null;
	series_abbreviation: string | null;
	volume_number: string | null;
	genre: string | null;
	work_type: WorkType;
	language: Language;
	authors: BookAuthorAssignment[];
};

export type CitationFormatted = {
	plain: string;
	html: string;
	sourceType: CitationSourceType;
};

export type BibliographySortKey = {
	lastName: string;
	year: number | null;
	title: string;
};

export function bookDetailToCitationInput(book: BookDetail): BookCitationInput {
	return {
		id: book.id,
		title: book.title,
		subtitle: book.subtitle,
		publisher: book.publisher,
		publisher_location: book.publisher_location,
		year: book.year,
		edition: book.edition,
		total_volumes: book.total_volumes,
		original_year: book.original_year,
		reprint_publisher: book.reprint_publisher,
		reprint_location: book.reprint_location,
		reprint_year: book.reprint_year,
		series_name: book.series_name,
		series_abbreviation: book.series_abbreviation,
		volume_number: book.volume_number,
		genre: book.genre,
		work_type: book.work_type,
		language: book.language,
		authors: book.authors
	};
}

export function isCitationCriticalGenre(genre: string | null | undefined): boolean {
	if (!genre) return false;
	return (CITATION_CRITICAL_GENRES as readonly string[]).includes(genre);
}
