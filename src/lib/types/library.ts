/**
 * Library module types + closed enums.
 *
 * Constants here mirror the schema's CHECK constraints and the tracker's
 * Session 1 / Session 4 acceptance vocabulary. Genres are open in the schema
 * (TEXT, no CHECK) but closed at the UI layer.
 *
 * Per `.cursor/rules/library-module.mdc`: never improvise free-text lists in
 * forms. Add entries here and reuse.
 */

export const GENRES = [
	'Commentary',
	'Bibles',
	'Biblical Reference',
	'Greek Language Tools',
	'Hebrew Language Tools',
	'Latin Language Tools',
	'German Language Tools',
	'Chinese Language Tools',
	'Theology',
	'Church History',
	'Pastoral',
	'General'
] as const;
export type Genre = (typeof GENRES)[number];

/** Matches `books.language` CHECK after library_delta_v1 ('french' added). */
export const LANGUAGES = [
	'english',
	'greek',
	'hebrew',
	'latin',
	'german',
	'french',
	'chinese',
	'other'
] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
	english: 'English',
	greek: 'Greek',
	hebrew: 'Hebrew',
	latin: 'Latin',
	german: 'German',
	french: 'French',
	chinese: 'Chinese',
	other: 'Other'
};

/** Matches `books.reading_status` CHECK. */
export const READING_STATUSES = ['unread', 'in_progress', 'read', 'reference', 'n_a'] as const;
export type ReadingStatus = (typeof READING_STATUSES)[number];

export const READING_STATUS_LABELS: Record<ReadingStatus, string> = {
	unread: 'Unread',
	in_progress: 'In progress',
	read: 'Read',
	reference: 'Reference',
	n_a: 'N/A'
};

/** Matches `book_authors.role` CHECK. */
export const AUTHOR_ROLES = ['author', 'editor', 'translator'] as const;
export type AuthorRole = (typeof AUTHOR_ROLES)[number];

export const AUTHOR_ROLE_LABELS: Record<AuthorRole, string> = {
	author: 'Author',
	editor: 'Editor',
	translator: 'Translator'
};

// ---------------------------------------------------------------------------
// View-models (load-function output, never raw DB rows)
// ---------------------------------------------------------------------------

export type CategoryRow = {
	id: string;
	name: string;
	slug: string;
	sort_order: number;
};

export type SeriesRow = {
	id: string;
	name: string;
	abbreviation: string | null;
};

export type PersonRow = {
	id: string;
	first_name: string | null;
	middle_name: string | null;
	last_name: string;
	suffix: string | null;
	aliases: string[];
};

export type BookAuthorAssignment = {
	person_id: string;
	person_label: string;
	role: AuthorRole;
	sort_order: number;
};

export type BookListRow = {
	id: string;
	title: string;
	subtitle: string | null;
	genre: string;
	reading_status: ReadingStatus;
	needs_review: boolean;
	primary_category_name: string | null;
	series_abbreviation: string | null;
	volume_number: string | null;
	authors_label: string | null;
};

export type BookDetail = {
	id: string;
	title: string;
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
	primary_category_id: string;
	primary_category_name: string;
	category_ids: string[];
	series_id: string | null;
	series_name: string | null;
	series_abbreviation: string | null;
	volume_number: string | null;
	genre: string;
	language: Language;
	isbn: string | null;
	barcode: string | null;
	shelving_location: string | null;
	reading_status: ReadingStatus;
	borrowed_to: string | null;
	personal_notes: string | null;
	rating: number | null;
	needs_review: boolean;
	needs_review_note: string | null;
	page_count: number | null;
	authors: BookAuthorAssignment[];
	created_at: string;
	updated_at: string;
};

/** Person dedup hint surfaced by `peopleByLastInitial` map. */
export type PersonDedupHint = {
	person: PersonRow;
	book_count: number;
};
