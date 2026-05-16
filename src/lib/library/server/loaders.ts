import type { SupabaseClient } from '@supabase/supabase-js';
import type {
	BookListFilters,
	BookListRow,
	BookDetail,
	CategoryRow,
	SeriesRow,
	PersonRow,
	BookAuthorAssignment,
	ReadingStatus,
	Language,
	AuthorRole,
	ScriptureRefRow,
	ReviewQueueFilters,
	ReviewCard,
	ImportMatchType,
	AncientTextRow,
	AncientCoverageRow,
	BookTopicRow,
	TopicCount
} from '$lib/types/library';
import {
	SCRIPTURE_IMAGES_BUCKET,
	SCRIPTURE_IMAGES_SIGNED_URL_TTL
} from '$lib/library/storage';
import { titleSortKey } from '$lib/library/title-sort';

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

/**
 * Fetch ALL rows from a Supabase query, paging past PostgREST's default
 * 1,000-row response cap. The `factory` callback receives a [from, to]
 * tuple and rebuilds the query each iteration with `.range(from, to)` at
 * the tail. We run pages of 1,000 until a short page (< 1,000 rows) signals
 * end-of-result.
 *
 * On error: logs and returns whatever was collected so far, matching the
 * existing loader contract (every loader catches + logs + returns []).
 *
 * Used by `loadBookListFiltered`, `loadPeople`, and `loadPersonBookCounts`
 * — the three queries that hit (or could hit) > 1,000 rows on the live
 * library. Pre-Pass-1 they were fine; post-Pass-1 (1,331 books, 1,441
 * `book_authors`, 911 people) the cap silently undercut the list page.
 */
async function paginateAll<T>(
	factory: (
		range: [number, number]
	) => PromiseLike<{ data: T[] | null; error: unknown }>,
	logTag: string
): Promise<T[]> {
	const out: T[] = [];
	let from = 0;
	const PAGE = 1000;
	while (true) {
		const { data, error } = await factory([from, from + PAGE - 1]);
		if (error) {
			console.error(`[${logTag}] page from ${from}`, error);
			break;
		}
		const batch = (data ?? []) as T[];
		out.push(...batch);
		if (batch.length < PAGE) break;
		from += PAGE;
	}
	return out;
}

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
	const data = await paginateAll<RawPerson>(
		([from, to]) =>
			supabase
				.from('people')
				.select('id, first_name, last_name, middle_name, suffix, aliases')
				.is('deleted_at', null)
				.order('last_name', { ascending: true })
				.order('first_name', { ascending: true })
				.range(from, to),
		'loadPeople'
	);
	return data.map((r) => ({
		id: r.id,
		first_name: r.first_name ?? null,
		middle_name: r.middle_name ?? null,
		last_name: r.last_name,
		suffix: r.suffix ?? null,
		aliases: Array.isArray(r.aliases) ? r.aliases : []
	}));
}

/** Map of person_id -> count of books that person is on (any role, any deletion state). */
export async function loadPersonBookCounts(
	supabase: SupabaseClient
): Promise<Map<string, number>> {
	const rows = await paginateAll<{ person_id: string; book_id: string }>(
		([from, to]) =>
			supabase.from('book_authors').select('person_id, book_id').range(from, to),
		'loadPersonBookCounts'
	);
	const counts = new Map<string, number>();
	for (const row of rows) {
		counts.set(row.person_id, (counts.get(row.person_id) ?? 0) + 1);
	}
	return counts;
}

type RawBookListRow = {
	id: string;
	title: string | null;
	subtitle: string | null;
	genre: string | null;
	language: string;
	reading_status: string;
	needs_review: boolean;
	volume_number: string | null;
	categories: { id: string; name: string } | { id: string; name: string }[] | null;
	series: { name: string; abbreviation: string | null } | { name: string; abbreviation: string | null }[] | null;
	book_authors:
		| { person_id: string; sort_order: number; role: string }[]
		| null;
};

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
			language,
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
			language: (r.language as Language) ?? 'english',
			reading_status: (r.reading_status as ReadingStatus) ?? 'unread',
			needs_review: Boolean(r.needs_review),
			primary_category_name: cat?.name ?? null,
			series_abbreviation: ser?.abbreviation ?? null,
			series_name: ser?.name ?? null,
			volume_number: r.volume_number ?? null,
			authors_label
		} satisfies BookListRow;
	});

	rows.sort((a, b) =>
		titleSortKey(a.title, a.language).localeCompare(titleSortKey(b.title, b.language))
	);
	return rows;
}

/**
 * Escape a user-supplied keyword for safe inclusion in a PostgREST `.or()`
 * filter expression. PostgREST treats `,`, `(`, `)`, and `*` as syntax in the
 * filter DSL; `%` is the SQL wildcard we wrap around the term ourselves.
 *
 * The trigram GIN indexes (migration 20260429190000) make `ILIKE '%foo%'`
 * substring scans cheap, so we don't need prefix-only matching.
 */
function escapeForPostgrestOrFilter(q: string): string {
	return q
		.trim()
		.replace(/[\\,()*%]/g, (ch) => '\\' + ch);
}

/**
 * Max `id.in.(…)` length we'll append to a PostgREST `.or()` or pass
 * directly to `.in('id', …)`. Per decision 009 Surprise #1, the cap is the
 * 16KB header limit — each UUID+comma ≈ 37 chars, so ~400 ids fills the
 * budget. 200 gives us plenty of slack alongside the other filter DSL.
 * If we hit this cap, the author filter falls back to a client-side
 * post-fetch prune (cheap at our data scale).
 */
const MAX_IN_LIST = 200;

/**
 * Filter-aware book list loader. URL params on `/library` flow through
 * `+page.server.ts` → `BookListFilters` → here. AND between filter types,
 * OR within. `q` runs across title / subtitle (on `books`) and author
 * `last_name` (on `people` via `book_authors`).
 *
 * Strategy for `q` (Session 3):
 *   1. Parallel SELECT on `people` matching `last_name ILIKE '%q%'` → person_ids.
 *   2. Parallel SELECT on `book_authors` for those person_ids → book_ids
 *      contributed by author-match.
 *   3. Single `books` query with `.or('title.ilike.%q%,subtitle.ilike.%q%,id.in.(book_ids))')`.
 *
 * Strategy for `author_id` (Session 5):
 *   - Parallel SELECT on `book_authors WHERE person_id IN (...)` → book_ids.
 *   - If the resolved list is <= MAX_IN_LIST, narrow via `.in('id', bookIds)`
 *     (AND with the rest of the filter set).
 *   - If the list exceeds MAX_IN_LIST, fetch without the author narrow and
 *     prune client-side after hydration (same-module trade-off as the
 *     category filter pre-Session-5).
 */
export async function loadBookListFiltered(
	supabase: SupabaseClient,
	people: PersonRow[],
	filters: BookListFilters
): Promise<BookListRow[]> {
	// Resolve the keyword-search author lookup ONCE up front so the per-page
	// factory below is pure (same inputs → same query). Otherwise we'd be
	// re-running the people + book_authors lookup on every page iteration.
	let orClause: string | null = null;
	if (filters.q && filters.q.trim().length > 0) {
		const raw = filters.q.trim();
		const escaped = escapeForPostgrestOrFilter(raw);
		const orParts = [`title.ilike.*${escaped}*`, `subtitle.ilike.*${escaped}*`];

		const { data: peopleHits, error: peopleErr } = await supabase
			.from('people')
			.select('id')
			.is('deleted_at', null)
			.ilike('last_name', `%${raw}%`);
		if (peopleErr) console.error('[loadBookListFiltered] people search', peopleErr);
		const personIds = (peopleHits ?? []).map((p) => (p as { id: string }).id);

		if (personIds.length > 0) {
			const { data: authorBooks, error: abErr } = await supabase
				.from('book_authors')
				.select('book_id')
				.in('person_id', personIds);
			if (abErr) console.error('[loadBookListFiltered] book_authors lookup', abErr);
			const bookIds = Array.from(
				new Set((authorBooks ?? []).map((a) => (a as { book_id: string }).book_id))
			);
			if (bookIds.length > 0 && bookIds.length <= MAX_IN_LIST) {
				orParts.push(`id.in.(${bookIds.join(',')})`);
			}
		}

		orClause = orParts.join(',');
	}

	// Resolve the author facet.
	let authorBookIds: string[] | null = null;
	let authorFilterClientSide = false;
	if (filters.author_id && filters.author_id.length > 0) {
		const { data: authorBooks, error: abErr } = await supabase
			.from('book_authors')
			.select('book_id')
			.in('person_id', filters.author_id);
		if (abErr) console.error('[loadBookListFiltered] author facet lookup', abErr);
		authorBookIds = Array.from(
			new Set((authorBooks ?? []).map((a) => (a as { book_id: string }).book_id))
		);
		if (authorBookIds.length > MAX_IN_LIST) {
			authorFilterClientSide = true;
		} else if (authorBookIds.length === 0) {
			// Selected authors have no books → empty result set.
			return [];
		}
	}

	const data = await paginateAll<unknown>(([from, to]) => {
		let query = supabase
			.from('books')
			.select(
				`
				id,
				title,
				subtitle,
				genre,
				language,
				reading_status,
				needs_review,
				volume_number,
				primary_category_id,
				categories!books_primary_category_id_fkey ( id, name ),
				series ( name, abbreviation ),
				book_authors ( person_id, sort_order, role )
			`
			)
			.is('deleted_at', null);

		if (filters.genre && filters.genre.length > 0) {
			query = query.in('genre', filters.genre);
		}
		if (filters.series_id && filters.series_id.length > 0) {
			query = query.in('series_id', filters.series_id);
		}
		if (filters.language && filters.language.length > 0) {
			query = query.in('language', filters.language);
		}
		if (filters.reading_status && filters.reading_status.length > 0) {
			query = query.in('reading_status', filters.reading_status);
		}
		if (filters.needs_review === true) {
			query = query.eq('needs_review', true);
		}
		if (authorBookIds && !authorFilterClientSide && authorBookIds.length > 0) {
			query = query.in('id', authorBookIds);
		}
		if (orClause) {
			query = query.or(orClause);
		}
		return query.range(from, to);
	}, 'loadBookListFiltered');

	const peopleMap = new Map(people.map((p) => [p.id, p]));

	let rows = data.map((raw) => {
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
		const raw_author_ids = (r.book_authors ?? []).map((a) => a.person_id);

		return {
			row: {
				id: r.id,
				title: r.title ?? null,
				subtitle: r.subtitle ?? null,
				genre: r.genre ?? null,
				language: (r.language as Language) ?? 'english',
				reading_status: (r.reading_status as ReadingStatus) ?? 'unread',
				needs_review: Boolean(r.needs_review),
				primary_category_name: cat?.name ?? null,
				series_abbreviation: ser?.abbreviation ?? null,
				series_name: ser?.name ?? null,
				volume_number: r.volume_number ?? null,
				authors_label
			} satisfies BookListRow,
			author_person_ids: raw_author_ids
		};
	});

	// Client-side prune when the author id list exceeded MAX_IN_LIST.
	if (authorFilterClientSide && filters.author_id && filters.author_id.length > 0) {
		const wanted = new Set(filters.author_id);
		rows = rows.filter((r) => r.author_person_ids.some((pid) => wanted.has(pid)));
	}

	const out = rows.map((r) => r.row);
	out.sort((a, b) =>
		titleSortKey(a.title, a.language).localeCompare(titleSortKey(b.title, b.language))
	);
	return out;
}

async function fetchLiveBookCount(
	supabase: SupabaseClient,
	needsReviewOnly: boolean
): Promise<number | null> {
	let q = supabase
		.from('books')
		.select('*', { count: 'exact', head: true })
		.is('deleted_at', null);
	if (needsReviewOnly) q = q.eq('needs_review', true);
	const { count, error } = await q;
	if (error) {
		console.error('[fetchLiveBookCount]', error);
		return null;
	}
	return count ?? 0;
}

/**
 * Cheap unfiltered count via `head: true` — drives the "Showing N of M"
 * indicator on the list page header.
 */
export async function countLiveBooks(supabase: SupabaseClient): Promise<number> {
	return (await fetchLiveBookCount(supabase, false)) ?? 0;
}

/** Live books with `needs_review = true` — dashboard tile. `null` if query failed. */
export async function countBooksNeedingReview(
	supabase: SupabaseClient
): Promise<number | null> {
	return fetchLiveBookCount(supabase, true);
}

/** Total live books for dashboard — `null` if query failed. */
export async function countLiveBooksExact(
	supabase: SupabaseClient
): Promise<number | null> {
	return fetchLiveBookCount(supabase, false);
}

export type BibleBookListRow = { name: string; testament: 'OT' | 'NT' };

export async function loadBibleBookList(supabase: SupabaseClient): Promise<BibleBookListRow[]> {
	const { data, error } = await supabase
		.from('bible_books')
		.select('name, testament, sort_order')
		.order('sort_order', { ascending: true });
	if (error) {
		console.error(error);
		return [];
	}
	return (data ?? []).map((r) => ({
		name: (r as { name: string }).name,
		testament: (r as { testament: 'OT' | 'NT' }).testament
	}));
}

/** Shared deps for `/library/books/new`, `/library/add`, etc. */
export async function loadBookFormPageData(
	supabase: SupabaseClient,
	opts?: { people?: PersonRow[]; series?: SeriesRow[] }
) {
	const [people, series] = await Promise.all([
		opts?.people != null ? Promise.resolve(opts.people) : loadPeople(supabase),
		opts?.series != null ? Promise.resolve(opts.series) : loadSeries(supabase)
	]);
	const [categories, personBookCounts, bibleBooks] = await Promise.all([
		loadCategories(supabase),
		loadPersonBookCounts(supabase),
		loadBibleBookList(supabase)
	]);
	return {
		people,
		categories,
		series,
		personBookCounts: Object.fromEntries(personBookCounts),
		bibleBooks
	};
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

// ---------------------------------------------------------------------------
// Review queue (Session 5.5)
// ---------------------------------------------------------------------------

type RawReviewCard = RawBookListRow & {
	year: number | null;
	publisher: string | null;
	needs_review_note: string | null;
	import_match_type: string | null;
};

/**
 * Filter-aware loader for `/library/review`. Forces `needs_review = true`
 * (the queue's invariant) and supports two extra filters that don't exist on
 * the regular list page:
 *
 * - `subject_blank: true` → `genre IS NULL` (the no-subject 1,047-row chunk)
 * - `import_match_type: [...]` → OL provenance slice (Pass 1 backfill)
 *
 * `excludeIds` is the client-side skipped-this-session set, threaded through
 * the `queue/+server.ts` refetch endpoint when the local card stack runs low.
 *
 * Returns up to `limit` cards ordered by `id` for a stable cursor — natural
 * randomness from UUIDs is fine; we don't need title-sort here, the user is
 * draining the queue not browsing it.
 */
export async function loadReviewQueue(
	supabase: SupabaseClient,
	people: PersonRow[],
	filters: ReviewQueueFilters,
	opts: { limit: number; excludeIds: string[] }
): Promise<ReviewCard[]> {
	let query = supabase
		.from('books')
		.select(
			`
			id,
			title,
			subtitle,
			genre,
			reading_status,
			needs_review,
			needs_review_note,
			volume_number,
			year,
			publisher,
			language,
			import_match_type,
			categories!books_primary_category_id_fkey ( id, name ),
			series ( name, abbreviation ),
			book_authors ( person_id, sort_order, role )
		`
		)
		.is('deleted_at', null)
		.eq('needs_review', true);

	if (filters.subject_blank === true) {
		query = query.is('genre', null);
	}
	if (filters.genre && filters.genre.length > 0) {
		query = query.in('genre', filters.genre);
	}
	if (filters.series_id && filters.series_id.length > 0) {
		query = query.in('series_id', filters.series_id);
	}
	if (filters.language && filters.language.length > 0) {
		query = query.in('language', filters.language);
	}
	if (filters.reading_status && filters.reading_status.length > 0) {
		query = query.in('reading_status', filters.reading_status);
	}
	if (filters.import_match_type && filters.import_match_type.length > 0) {
		query = query.in('import_match_type', filters.import_match_type);
	}
	if (opts.excludeIds.length > 0) {
		query = query.not('id', 'in', `(${opts.excludeIds.join(',')})`);
	}

	const { data, error } = await query
		.order('id', { ascending: true })
		.limit(opts.limit);
	if (error) {
		console.error('[loadReviewQueue]', error);
		return [];
	}

	const peopleMap = new Map(people.map((p) => [p.id, p]));

	return (data ?? []).map((raw) => {
		const r = raw as unknown as RawReviewCard;
		const cat = asArrayOrSingle(r.categories)[0] ?? null;
		const ser = asArrayOrSingle(r.series)[0] ?? null;
		const authorRows = (r.book_authors ?? [])
			.filter((a) => a.role === 'author')
			.sort((a, b) => a.sort_order - b.sort_order);
		const authorLabels = authorRows
			.map((a) => peopleMap.get(a.person_id))
			.filter((p): p is PersonRow => p != null)
			.map((p) => personDisplayShort(p));
		const authors_label = authorLabels.length === 0 ? null : authorLabels.join(', ');

		return {
			id: r.id,
			title: r.title ?? null,
			subtitle: r.subtitle ?? null,
			genre: r.genre ?? null,
			language: (r.language as Language) ?? 'english',
			reading_status: (r.reading_status as ReadingStatus) ?? 'unread',
			needs_review: Boolean(r.needs_review),
			primary_category_name: cat?.name ?? null,
			series_abbreviation: ser?.abbreviation ?? null,
			series_name: ser?.name ?? null,
			volume_number: r.volume_number ?? null,
			authors_label,
			year: r.year ?? null,
			publisher: r.publisher ?? null,
			needs_review_note: r.needs_review_note ?? null,
			import_match_type: (r.import_match_type as ImportMatchType | null) ?? null
		} satisfies ReviewCard;
	});
}

/**
 * Cheap unfiltered remaining-count for the review queue. Mirrors the same
 * filter set as `loadReviewQueue` (minus `excludeIds` — the counter shows
 * total remaining for THIS slice, not total minus skipped). Drives the
 * "X left" header counter.
 */
export async function countReviewQueue(
	supabase: SupabaseClient,
	filters: ReviewQueueFilters
): Promise<number> {
	let query = supabase
		.from('books')
		.select('*', { count: 'exact', head: true })
		.is('deleted_at', null)
		.eq('needs_review', true);

	if (filters.subject_blank === true) query = query.is('genre', null);
	if (filters.genre && filters.genre.length > 0) query = query.in('genre', filters.genre);
	if (filters.series_id && filters.series_id.length > 0)
		query = query.in('series_id', filters.series_id);
	if (filters.language && filters.language.length > 0)
		query = query.in('language', filters.language);
	if (filters.reading_status && filters.reading_status.length > 0)
		query = query.in('reading_status', filters.reading_status);
	if (filters.import_match_type && filters.import_match_type.length > 0)
		query = query.in('import_match_type', filters.import_match_type);

	const { count, error } = await query;
	if (error) {
		console.error('[countReviewQueue]', error);
		return 0;
	}
	return count ?? 0;
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

// ---------------------------------------------------------------------------
// Topics + coverage (Session 5)
// ---------------------------------------------------------------------------

type RawAncientText = {
	id: string;
	canonical_name: string;
	abbreviations: string[] | null;
	category: string | null;
};

type RawBookTopic = {
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
	created_at: string;
};

type RawBibleCoverage = {
	id: string;
	bible_book: string;
};

type RawAncientCoverage = {
	id: string;
	ancient_text_id: string;
	ancient_texts:
		| { canonical_name: string; abbreviations: string[] | null; category: string | null }
		| { canonical_name: string; abbreviations: string[] | null; category: string | null }[]
		| null;
};

/**
 * Load the full `ancient_texts` table for the combobox. Count is left
 * unpopulated — rare enough that scanning book_ancient_coverage per load
 * isn't worth the round-trip; if it ever matters we'll fold it in similarly
 * to `loadAllTopicCounts`.
 */
export async function loadAncientTexts(supabase: SupabaseClient): Promise<AncientTextRow[]> {
	const { data, error } = await supabase
		.from('ancient_texts')
		.select('id, canonical_name, abbreviations, category')
		.is('deleted_at', null)
		.order('canonical_name', { ascending: true });
	if (error) {
		console.error('[loadAncientTexts]', error);
		return [];
	}
	return (data ?? []).map((r) => {
		const row = r as RawAncientText;
		return {
			id: row.id,
			canonical_name: row.canonical_name,
			abbreviations: Array.isArray(row.abbreviations) ? row.abbreviations : [],
			category: row.category
		};
	});
}

/**
 * Per-book topic rows with 1h signed URLs for any attached page image.
 * Mirrors `loadScriptureRefsForBook`'s shape — same batch-entry surface.
 */
export async function loadBookTopicsForBook(
	supabase: SupabaseClient,
	bookId: string
): Promise<BookTopicRow[]> {
	const { data, error } = await supabase
		.from('book_topics')
		.select(
			`
			id,
			book_id,
			essay_id,
			topic,
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
		.order('created_at', { ascending: true });
	if (error) {
		console.error('[loadBookTopicsForBook]', error);
		return [];
	}
	const rows = (data ?? []) as unknown as RawBookTopic[];
	const signed = await Promise.all(
		rows.map(async (r) => {
			if (!r.source_image_url) return null;
			const { data: s, error: sErr } = await supabase.storage
				.from(SCRIPTURE_IMAGES_BUCKET)
				.createSignedUrl(r.source_image_url, SCRIPTURE_IMAGES_SIGNED_URL_TTL);
			if (sErr) {
				console.error('[loadBookTopicsForBook] signed URL error', sErr);
				return null;
			}
			return s?.signedUrl ?? null;
		})
	);
	return rows.map((r, i) => ({
		id: r.id,
		book_id: r.book_id,
		essay_id: r.essay_id,
		topic: r.topic,
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

/**
 * Covered bible_books for a single book. Returns just the names — the
 * detail page only cares whether a given bible_book is covered; the `id` on
 * the junction is irrelevant to the UI (delete is keyed by book_id +
 * bible_book via the UNIQUE constraint).
 */
export async function loadBibleCoverageForBook(
	supabase: SupabaseClient,
	bookId: string
): Promise<string[]> {
	const { data, error } = await supabase
		.from('book_bible_coverage')
		.select('id, bible_book')
		.eq('book_id', bookId);
	if (error) {
		console.error('[loadBibleCoverageForBook]', error);
		return [];
	}
	return (data ?? []).map((r) => (r as RawBibleCoverage).bible_book);
}

/**
 * Hydrated ancient-coverage rows for a single book. Embeds ancient_texts so
 * the detail page can display canonical_name + abbreviations without a
 * second round-trip per row.
 */
export async function loadAncientCoverageForBook(
	supabase: SupabaseClient,
	bookId: string
): Promise<AncientCoverageRow[]> {
	const { data, error } = await supabase
		.from('book_ancient_coverage')
		.select(
			`
			id,
			ancient_text_id,
			ancient_texts ( canonical_name, abbreviations, category )
		`
		)
		.eq('book_id', bookId);
	if (error) {
		console.error('[loadAncientCoverageForBook]', error);
		return [];
	}
	return (data ?? []).map((r) => {
		const row = r as unknown as RawAncientCoverage;
		const at = asArrayOrSingle(row.ancient_texts)[0] ?? null;
		return {
			id: row.id,
			ancient_text_id: row.ancient_text_id,
			canonical_name: at?.canonical_name ?? '(unknown)',
			abbreviations: Array.isArray(at?.abbreviations) ? at!.abbreviations : [],
			category: at?.category ?? null
		};
	});
}

/**
 * Aggregate `{ topic, count }` across all live `book_topics`. Drives the
 * typo-warn `< 3 uses` gate in <CanonicalizingCombobox>: we only warn when
 * the fuzzy-match candidate has few uses (a near-duplicate that would
 * fragment the vocabulary if the typo becomes a new row).
 *
 * Cheap: a single SELECT of distinct topic column values + app-layer
 * counting. Scale tops out in the low thousands even long-term; no index
 * is needed beyond the default row scan.
 */
export async function loadAllTopicCounts(supabase: SupabaseClient): Promise<TopicCount[]> {
	const rows = await paginateAll<{ topic: string }>(
		([from, to]) =>
			supabase
				.from('book_topics')
				.select('topic')
				.is('deleted_at', null)
				.range(from, to),
		'loadAllTopicCounts'
	);
	const counts = new Map<string, number>();
	for (const r of rows) {
		counts.set(r.topic, (counts.get(r.topic) ?? 0) + 1);
	}
	return Array.from(counts.entries()).map(([topic, count]) => ({ topic, count }));
}
