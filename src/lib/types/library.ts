/**
 * Library module types + closed enums.
 *
 * `GENRES` mirrors `books_genre_check` (migration 20260507190000). Keep lists
 * in sync: add here first, then extend the migration IN list before push.
 *
 * Per `.cursor/rules/library-module.mdc`: never improvise free-text lists in
 * forms. Add entries here and reuse.
 */

export const GENRES = [
	'Apologetics',
	'Apostolic Fathers and Ancient Sources',
	'Applied Theology',
	'Bibles',
	'Biblical Reference',
	'Biblical Theology',
	'Biography',
	'Business',
	'Chinese Language Tools',
	'Christian Living',
	'Church History',
	'Commentary',
	'Culture',
	'Devotional',
	'Ethics',
	'General',
	'General Epistles',
	'German Language Tools',
	'Gospels and Jesus',
	'Greek Language Tools',
	'Hebrew Language Tools',
	'Historical Theology',
	'History',
	'Homiletics',
	'Hymnals and Liturgy',
	'Language',
	'Latin Language Tools',
	'Literature',
	'Music',
	'New Testament',
	'Old Testament',
	'Other',
	'Other Religions',
	'Pastoral',
	'Pastoral Ministry',
	'Philosophy',
	'Poetry',
	'Reference',
	'Science',
	'Sports',
	'Systematic Theology',
	'Theology'
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

/**
 * Matches `books.import_match_type` CHECK (migration 20260501090000).
 * Records OL enrichment provenance at Pass 1 / Pass 2 import time. NULL =
 * never enriched (BDAG ADDITIONS, future barcode-add inserts, etc.).
 */
export const IMPORT_MATCH_TYPES = ['title+author', 'title-only', 'no-match'] as const;
export type ImportMatchType = (typeof IMPORT_MATCH_TYPES)[number];

export const IMPORT_MATCH_TYPE_LABELS: Record<ImportMatchType, string> = {
	'title+author': 'Title + author',
	'title-only': 'Title only',
	'no-match': 'No match'
};

// ---------------------------------------------------------------------------
// View-models (load-function output, never raw DB rows)
// ---------------------------------------------------------------------------

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
	title: string | null;
	subtitle: string | null;
	genre: string | null;
	language: Language;
	reading_status: ReadingStatus;
	needs_review: boolean;
	series_abbreviation: string | null;
	/** Full series name; surfaced as a hover tooltip on the abbreviation chip. */
	series_name: string | null;
	volume_number: string | null;
	authors_label: string | null;
};

export type BookDetail = {
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
	series_id: string | null;
	series_name: string | null;
	series_abbreviation: string | null;
	volume_number: string | null;
	genre: string | null;
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

/**
 * URL-driven filter shape for the `/library` list page (Session 3 + Session 5).
 *
 * AND between filter types, OR within (e.g. `genre: ['Commentary', 'Theology']`
 * matches either; combining `genre` + `series_id` requires both). `q` is a
 * substring keyword search hitting books.title / books.subtitle / people.last_name
 * (via `book_authors` join), backed by the trigram GIN indexes installed in
 * migration `20260429190000_books_title_trigram_index.sql`.
 *
 * Session 5 + decision 022 changes:
 * - Category facet + the `categories` / `book_categories` / `books.primary_category_id`
 *   schema have been removed entirely (Open Question 11 → Open Question 12).
 *   Genre is the single content-type taxonomy; physical shelving lives on the
 *   free-text `books.shelving_location` column when needed.
 * - `author_id` — multi-select against the loadPeople set.
 *   Resolves to `book_id IN (...)` via a parallel SELECT on `book_authors`.
 * - `all` — URL `?all=true` loads every matching row in one shot (off by default;
 *   list uses `LIBRARY_PAGE_SIZE` + client pagination).
 */
export const LIBRARY_PAGE_SIZE = 50;

export type BookListFilters = {
	genre?: string[];
	series_id?: string[];
	author_id?: string[];
	language?: Language[];
	reading_status?: ReadingStatus[];
	needs_review?: boolean;
	q?: string;
	/** When true, skip pagination and return the full filtered list. */
	all?: boolean;
};

/**
 * Filter shape for the `/library/review` card-stack queue (Session 5.5).
 * Superset of `BookListFilters`. `needs_review = true` is always pinned at the
 * loader; the page never renders books outside the review queue.
 *
 * - `subject_blank` (URL `?subject=blank`) → `genre IS NULL`. Drives the
 *   1,047-row no-Subject chunk independently of the scholarly-core slice.
 * - `import_match_type` (URL `?match_type=title-only` etc.) → filters by OL
 *   enrichment provenance from Pass 1.
 */
export type ReviewQueueFilters = BookListFilters & {
	subject_blank?: boolean;
	import_match_type?: ImportMatchType[];
};

/**
 * Card payload for `/library/review`. Extends `BookListRow` with the
 * citation-critical fields that the per-card quick-actions can edit
 * (`title`, `year`, `publisher`, `language`) plus the auto-line so the
 * card can render the "Missing: …" preview.
 */
export type ReviewCard = BookListRow & {
	year: number | null;
	publisher: string | null;
	needs_review_note: string | null;
	import_match_type: ImportMatchType | null;
};

/**
 * Result row for `/library/search-passage`. Merges two sources:
 *
 *   - `source_kind: 'ref'`: a row from `search_scripture_refs` — a precise
 *     verse / chapter / range hit on `scripture_references`.
 *   - `source_kind: 'coverage'`: a row from `book_bible_coverage` — the book
 *     covers the queried bible_book as a whole. Surfaces commentaries that
 *     haven't had individual scripture refs entered yet.
 *
 * The UI treats the two differently (coverage hits have no page / verse
 * specificity) but both point at the same book for the deep-link.
 *
 * `manual_entry` is computed in the SQL for 'ref' rows (true when
 * `confidence_score IS NULL`). Coverage rows are always `manual_entry: true`.
 */
export type PassageResult = {
	source_kind: 'ref' | 'coverage';
	ref_id: string;
	book_id: string | null;
	essay_id: string | null;
	book_title: string | null;
	book_subtitle: string | null;
	bible_book: string;
	chapter_start: number | null;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
	page_start: string | null;
	page_end: string | null;
	confidence_score: number | null;
	needs_review: boolean;
	review_note: string | null;
	manual_entry: boolean;
};

/**
 * Ancient-text row — drives the ancient_texts combobox + coverage hydration.
 * `canonical_name` is UNIQUE at the schema level; `abbreviations` is the
 * alternate-spellings array (e.g. ['Ant.', 'A.J.', 'Antiquities']).
 */
export type AncientTextRow = {
	id: string;
	canonical_name: string;
	abbreviations: string[];
	category: string | null;
};

/** Ancient-coverage junction row hydrated with the ancient text it points at. */
export type AncientCoverageRow = {
	id: string;
	ancient_text_id: string;
	canonical_name: string;
	abbreviations: string[];
	category: string | null;
};

/** Topic row view-model — book_topics joined back for /library/books/[id]. */
export type BookTopicRow = {
	id: string;
	book_id: string | null;
	essay_id: string | null;
	topic: string;
	page_start: string;
	page_end: string | null;
	confidence_score: number | null;
	needs_review: boolean;
	review_note: string | null;
	source_image_url: string | null;
	source_image_signed_url: string | null;
	created_at: string;
};

/**
 * Topic-usage count, surfaced for the typo-warning gate in
 * <CanonicalizingCombobox>: we only warn when the typed-new topic is fuzzy
 * to an existing topic AND the existing topic has < 3 uses (below-threshold
 * fragmentation risk). `topic` is the lowercased canonical value.
 */
export type TopicCount = {
	topic: string;
	count: number;
};

/**
 * Scripture reference view-model — what `loadScriptureRefsForBook` returns.
 *
 * `verse_start_abs` / `verse_end_abs` are intentionally omitted: they're
 * trigger-computed from chapter/verse columns (see `compute_verse_abs` in
 * `00000000000000_baseline.sql`) and the UI never reads them directly. Search
 * pulls them through `search_scripture_refs(...)` instead.
 *
 * `source_image_url` stores the bucket *object path* (not a public URL); the
 * loader generates a 1h signed URL alongside it on every load.
 */
export type ScriptureRefRow = {
	id: string;
	book_id: string | null;
	essay_id: string | null;
	bible_book: string;
	chapter_start: number | null;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
	page_start: string;
	page_end: string | null;
	confidence_score: number | null;
	needs_review: boolean;
	review_note: string | null;
	source_image_url: string | null;
	source_image_signed_url: string | null;
	created_at: string;
};

/** Deep-link row for `/library/review` → book detail `#ref-…`. */
export type ScriptureRefNeedingReviewListItem = {
	refId: string;
	bookId: string;
	bookTitle: string;
	rangeLabel: string;
	pageSummary: string | null;
	confidence: number | null;
};
