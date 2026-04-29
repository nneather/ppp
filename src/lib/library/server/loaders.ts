import type { SupabaseClient } from '@supabase/supabase-js';
import type {
	BookListRow,
	BookDetail,
	CategoryRow,
	SeriesRow,
	PersonRow,
	BookAuthorAssignment,
	ReadingStatus,
	Language,
	AuthorRole,
	ScriptureRefRow
} from '$lib/types/library';
import {
	SCRIPTURE_IMAGES_BUCKET,
	SCRIPTURE_IMAGES_SIGNED_URL_TTL
} from '$lib/library/storage';

/**
 * Shared load helpers for book list + detail pages.
 *
 * Junction-bearing loads use Supabase's nested-select syntax. Per
 * `.cursor/rules/sveltekit-routes.mdc`, raw rows are mapped to view-model
 * shapes here so the .svelte files never see Record<string, unknown>.
 */

type RawCategory = { id: string; name: string; slug: string; sort_order: number };
type RawSeries = { id: string; name: string; abbreviation: string | null };
type RawPerson = {
	id: string;
	first_name: string | null;
	middle_name: string | null;
	last_name: string;
	suffix: string | null;
	aliases: string[] | null;
};

export async function loadCategories(supabase: SupabaseClient): Promise<CategoryRow[]> {
	const { data, error } = await supabase
		.from('categories')
		.select('id, name, slug, sort_order')
		.order('sort_order', { ascending: true });
	if (error) {
		console.error(error);
		return [];
	}
	return (data ?? []).map((c) => {
		const r = c as RawCategory;
		return { id: r.id, name: r.name, slug: r.slug, sort_order: r.sort_order };
	});
}

export async function loadSeries(supabase: SupabaseClient): Promise<SeriesRow[]> {
	const { data, error } = await supabase
		.from('series')
		.select('id, name, abbreviation')
		.is('deleted_at', null)
		.order('name', { ascending: true });
	if (error) {
		console.error(error);
		return [];
	}
	return (data ?? []).map((s) => {
		const r = s as RawSeries;
		return { id: r.id, name: r.name, abbreviation: r.abbreviation ?? null };
	});
}

export async function loadPeople(supabase: SupabaseClient): Promise<PersonRow[]> {
	const { data, error } = await supabase
		.from('people')
		.select('id, first_name, last_name, middle_name, suffix, aliases')
		.is('deleted_at', null)
		.order('last_name', { ascending: true })
		.order('first_name', { ascending: true });
	if (error) {
		console.error(error);
		return [];
	}
	return (data ?? []).map((p) => {
		const r = p as unknown as RawPerson;
		return {
			id: r.id,
			first_name: r.first_name ?? null,
			middle_name: r.middle_name ?? null,
			last_name: r.last_name,
			suffix: r.suffix ?? null,
			aliases: Array.isArray(r.aliases) ? r.aliases : []
		};
	});
}

/** Map of person_id -> count of books that person is on (any role, any deletion state). */
export async function loadPersonBookCounts(
	supabase: SupabaseClient
): Promise<Map<string, number>> {
	const { data, error } = await supabase.from('book_authors').select('person_id, book_id');
	const counts = new Map<string, number>();
	if (error) {
		console.error(error);
		return counts;
	}
	for (const row of data ?? []) {
		const pid = (row as { person_id: string }).person_id;
		counts.set(pid, (counts.get(pid) ?? 0) + 1);
	}
	return counts;
}

type RawBookListRow = {
	id: string;
	title: string | null;
	subtitle: string | null;
	genre: string | null;
	reading_status: string;
	needs_review: boolean;
	volume_number: string | null;
	categories: { id: string; name: string } | { id: string; name: string }[] | null;
	series: { name: string; abbreviation: string | null } | { name: string; abbreviation: string | null }[] | null;
	book_authors:
		| { person_id: string; sort_order: number; role: string }[]
		| null;
};

/**
 * Sort key with leading articles stripped — "The Book of Exodus" sorts under
 * "B" not "T". Keep the displayed title untouched. Lowercase for stable
 * locale-aware comparison. Nullable input → empty key (sorts to top).
 */
function titleSortKey(title: string | null): string {
	if (!title) return '';
	return title.replace(/^(the|a|an)\s+/i, '').toLocaleLowerCase();
}

function asArrayOrSingle<T>(v: T | T[] | null | undefined): T[] {
	if (v == null) return [];
	return Array.isArray(v) ? v : [v];
}

export async function loadBookList(
	supabase: SupabaseClient,
	people: PersonRow[]
): Promise<BookListRow[]> {
	const { data, error } = await supabase
		.from('books')
		.select(
			`
			id,
			title,
			subtitle,
			genre,
			reading_status,
			needs_review,
			volume_number,
			categories!books_primary_category_id_fkey ( id, name ),
			series ( name, abbreviation ),
			book_authors ( person_id, sort_order, role )
		`
		)
		.is('deleted_at', null);
	if (error) {
		console.error(error);
		return [];
	}

	const peopleMap = new Map(people.map((p) => [p.id, p]));

	const rows = (data ?? []).map((raw) => {
		const r = raw as unknown as RawBookListRow;
		const cat = asArrayOrSingle(r.categories)[0] ?? null;
		const ser = asArrayOrSingle(r.series)[0] ?? null;
		const authorRows = (r.book_authors ?? [])
			.filter((a) => a.role === 'author')
			.sort((a, b) => a.sort_order - b.sort_order);
		const authorLabels = authorRows
			.map((a) => {
				const p = peopleMap.get(a.person_id);
				if (!p) return null;
				return personDisplayShort(p);
			})
			.filter((s): s is string => s != null);
		const authors_label = authorLabels.length === 0 ? null : authorLabels.join(', ');

		return {
			id: r.id,
			title: r.title ?? null,
			subtitle: r.subtitle ?? null,
			genre: r.genre ?? null,
			reading_status: (r.reading_status as ReadingStatus) ?? 'unread',
			needs_review: Boolean(r.needs_review),
			primary_category_name: cat?.name ?? null,
			series_abbreviation: ser?.abbreviation ?? null,
			series_name: ser?.name ?? null,
			volume_number: r.volume_number ?? null,
			authors_label
		} satisfies BookListRow;
	});

	// Article-stripped sort: "The Book of Exodus" → "B", not "T".
	rows.sort((a, b) => titleSortKey(a.title).localeCompare(titleSortKey(b.title)));
	return rows;
}

type RawBookDetail = {
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
	primary_category_id: string | null;
	series_id: string | null;
	volume_number: string | null;
	genre: string | null;
	language: string;
	isbn: string | null;
	barcode: string | null;
	shelving_location: string | null;
	reading_status: string;
	borrowed_to: string | null;
	personal_notes: string | null;
	rating: number | null;
	needs_review: boolean;
	needs_review_note: string | null;
	page_count: number | null;
	deleted_at: string | null;
	created_at: string;
	updated_at: string;
	primary_category:
		| { id: string; name: string }
		| { id: string; name: string }[]
		| null;
	series: { id: string; name: string; abbreviation: string | null } | null;
	book_categories:
		| { category_id: string }[]
		| null;
	book_authors:
		| { person_id: string; role: string; sort_order: number }[]
		| null;
};

export async function loadBookDetail(
	supabase: SupabaseClient,
	id: string,
	people: PersonRow[]
): Promise<BookDetail | null> {
	const { data, error } = await supabase
		.from('books')
		.select(
			`
			id,
			title,
			subtitle,
			publisher,
			publisher_location,
			year,
			edition,
			total_volumes,
			original_year,
			reprint_publisher,
			reprint_location,
			reprint_year,
			primary_category_id,
			series_id,
			volume_number,
			genre,
			language,
			isbn,
			barcode,
			shelving_location,
			reading_status,
			borrowed_to,
			personal_notes,
			rating,
			needs_review,
			needs_review_note,
			page_count,
			deleted_at,
			created_at,
			updated_at,
			primary_category:categories!books_primary_category_id_fkey ( id, name ),
			series ( id, name, abbreviation ),
			book_categories ( category_id ),
			book_authors ( person_id, role, sort_order )
		`
		)
		.eq('id', id)
		.maybeSingle();

	if (error) {
		console.error(error);
		return null;
	}
	if (!data) return null;
	const r = data as unknown as RawBookDetail;
	if (r.deleted_at) return null;

	const peopleMap = new Map(people.map((p) => [p.id, p]));
	const authors: BookAuthorAssignment[] = (r.book_authors ?? [])
		.slice()
		.sort((a, b) => a.sort_order - b.sort_order)
		.map((a) => {
			const p = peopleMap.get(a.person_id);
			return {
				person_id: a.person_id,
				person_label: p ? personDisplayLong(p) : 'Unknown',
				role: a.role as AuthorRole,
				sort_order: a.sort_order
			};
		});

	const cat = asArrayOrSingle(r.primary_category)[0] ?? null;
	return {
		id: r.id,
		title: r.title ?? null,
		subtitle: r.subtitle ?? null,
		publisher: r.publisher ?? null,
		publisher_location: r.publisher_location ?? null,
		year: r.year ?? null,
		edition: r.edition ?? null,
		total_volumes: r.total_volumes ?? null,
		original_year: r.original_year ?? null,
		reprint_publisher: r.reprint_publisher ?? null,
		reprint_location: r.reprint_location ?? null,
		reprint_year: r.reprint_year ?? null,
		primary_category_id: r.primary_category_id ?? null,
		primary_category_name: cat?.name ?? null,
		category_ids: (r.book_categories ?? []).map((c) => c.category_id),
		series_id: r.series_id ?? null,
		series_name: r.series?.name ?? null,
		series_abbreviation: r.series?.abbreviation ?? null,
		volume_number: r.volume_number ?? null,
		genre: r.genre ?? null,
		language: (r.language as Language) ?? 'english',
		isbn: r.isbn ?? null,
		barcode: r.barcode ?? null,
		shelving_location: r.shelving_location ?? null,
		reading_status: (r.reading_status as ReadingStatus) ?? 'unread',
		borrowed_to: r.borrowed_to ?? null,
		personal_notes: r.personal_notes ?? null,
		rating: r.rating ?? null,
		needs_review: Boolean(r.needs_review),
		needs_review_note: r.needs_review_note ?? null,
		page_count: r.page_count ?? null,
		authors,
		created_at: r.created_at,
		updated_at: r.updated_at
	};
}

/**
 * Compact display for list views: "First Last" (with middle initial if any).
 * Example: "Richard Bauckham", "F. F. Bruce", "John T. McNeill".
 *
 * Long form (`personDisplayLong`) is for citation-shaped detail views and
 * picker labels — full first + middle + last + suffix.
 */
export function personDisplayShort(p: PersonRow): string {
	const first = (p.first_name ?? '').trim();
	const middle = (p.middle_name ?? '').trim();
	const middleInitial = middle ? `${middle.charAt(0)}.` : '';
	const parts = [first, middleInitial, p.last_name].filter((s) => s.length > 0);
	return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Scripture references
// ---------------------------------------------------------------------------

type RawScriptureRefRow = {
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
	created_at: string;
};

/**
 * 66 bible_book names in canon order. Drives both the `<Select>` in
 * `<ScriptureReferenceForm>` AND the canon-ordered grouping on the book
 * detail page (so groups render Genesis → Revelation, not alphabetical).
 */
export async function loadBibleBookNames(supabase: SupabaseClient): Promise<string[]> {
	const { data, error } = await supabase
		.from('bible_books')
		.select('name, sort_order')
		.order('sort_order', { ascending: true });
	if (error) {
		console.error(error);
		return [];
	}
	return (data ?? []).map((r) => (r as { name: string }).name);
}

/**
 * Load all live scripture_references for a book, ordered by `verse_start_abs`
 * so the detail-page list reads in scripture order. Generates a 1h signed
 * URL for any row that has `source_image_url` populated.
 *
 * `verse_start_abs` itself is not surfaced — it's a trigger-computed column
 * the UI doesn't need; only the ORDER BY + the eventual `search_scripture_refs`
 * RPC consume it directly.
 */
export async function loadScriptureRefsForBook(
	supabase: SupabaseClient,
	bookId: string
): Promise<ScriptureRefRow[]> {
	const { data, error } = await supabase
		.from('scripture_references')
		.select(
			`
			id,
			book_id,
			essay_id,
			bible_book,
			chapter_start,
			verse_start,
			chapter_end,
			verse_end,
			page_start,
			page_end,
			confidence_score,
			needs_review,
			review_note,
			source_image_url,
			created_at
		`
		)
		.eq('book_id', bookId)
		.is('deleted_at', null)
		.order('verse_start_abs', { ascending: true })
		.order('created_at', { ascending: true });

	if (error) {
		console.error(error);
		return [];
	}

	const rows = (data ?? []) as unknown as RawScriptureRefRow[];

	// Sign in parallel; null path → null URL.
	const signed = await Promise.all(
		rows.map(async (r) => {
			if (!r.source_image_url) return null;
			const { data: s, error: sErr } = await supabase.storage
				.from(SCRIPTURE_IMAGES_BUCKET)
				.createSignedUrl(r.source_image_url, SCRIPTURE_IMAGES_SIGNED_URL_TTL);
			if (sErr) {
				console.error('[loadScriptureRefsForBook] signed URL error', sErr);
				return null;
			}
			return s?.signedUrl ?? null;
		})
	);

	return rows.map((r, i) => ({
		id: r.id,
		book_id: r.book_id,
		essay_id: r.essay_id,
		bible_book: r.bible_book,
		chapter_start: r.chapter_start,
		verse_start: r.verse_start,
		chapter_end: r.chapter_end,
		verse_end: r.verse_end,
		page_start: r.page_start,
		page_end: r.page_end,
		confidence_score: r.confidence_score,
		needs_review: Boolean(r.needs_review),
		review_note: r.review_note,
		source_image_url: r.source_image_url,
		source_image_signed_url: signed[i],
		created_at: r.created_at
	}));
}

export function personDisplayLong(p: PersonRow): string {
	const segments: string[] = [];
	if (p.first_name) segments.push(p.first_name);
	if (p.middle_name) segments.push(p.middle_name);
	segments.push(p.last_name);
	if (p.suffix) segments.push(p.suffix);
	return segments.filter((s) => s.length > 0).join(' ');
}
