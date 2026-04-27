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
	AuthorRole
} from '$lib/types/library';

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
	// TODO post-delta-v1: re-add `.is('deleted_at', null)` filter once
	// 20260425160000_library_delta_v1.sql adds the column to series.
	const { data, error } = await supabase
		.from('series')
		.select('id, name, abbreviation')
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
	// TODO post-delta-v1: include `middle_name, suffix, aliases` in SELECT and
	// re-add `.is('deleted_at', null)` filter. Pre-migration the columns don't
	// exist yet; PostgREST rejects SELECTs that name absent columns, so we
	// load only baseline columns and synthesize defaults in the mapper.
	const { data, error } = await supabase
		.from('people')
		.select('id, first_name, last_name')
		.order('last_name', { ascending: true })
		.order('first_name', { ascending: true });
	if (error) {
		console.error(error);
		return [];
	}
	return (data ?? []).map((p) => {
		const r = p as unknown as Pick<RawPerson, 'id' | 'first_name' | 'last_name'>;
		return {
			id: r.id,
			first_name: r.first_name ?? null,
			middle_name: null,
			last_name: r.last_name,
			suffix: null,
			aliases: []
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
	title: string;
	subtitle: string | null;
	genre: string;
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
			reading_status,
			needs_review,
			volume_number,
			categories!books_primary_category_id_fkey ( id, name ),
			series ( name, abbreviation ),
			book_authors ( person_id, sort_order, role )
		`
		)
		.is('deleted_at', null)
		.order('title', { ascending: true });
	if (error) {
		console.error(error);
		return [];
	}

	const peopleMap = new Map(people.map((p) => [p.id, p]));

	return (data ?? []).map((raw) => {
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
			title: r.title,
			subtitle: r.subtitle ?? null,
			genre: r.genre,
			reading_status: (r.reading_status as ReadingStatus) ?? 'unread',
			needs_review: Boolean(r.needs_review),
			primary_category_name: cat?.name ?? null,
			series_abbreviation: ser?.abbreviation ?? null,
			volume_number: r.volume_number ?? null,
			authors_label
		};
	});
}

type RawBookDetail = {
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
	series_id: string | null;
	volume_number: string | null;
	genre: string;
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
	// TODO post-delta-v1: include `needs_review_note, page_count` in SELECT.
	// Pre-migration the columns don't exist; defaults are synthesized below.
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
			deleted_at,
			created_at,
			updated_at,
			primary_category:categories!books_primary_category_id_fkey ( id, name ),
			series ( id, name, abbreviation ),
			book_categories ( category_id ),
			book_authors ( person_id, role, sort_order )
		` as never
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
		title: r.title,
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
		primary_category_id: r.primary_category_id,
		primary_category_name: cat?.name ?? '—',
		category_ids: (r.book_categories ?? []).map((c) => c.category_id),
		series_id: r.series_id ?? null,
		series_name: r.series?.name ?? null,
		series_abbreviation: r.series?.abbreviation ?? null,
		volume_number: r.volume_number ?? null,
		genre: r.genre,
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

export function personDisplayShort(p: PersonRow): string {
	const first = (p.first_name ?? '').trim();
	const initial = first ? `${first.charAt(0)}.` : '';
	const parts = [p.last_name, initial].filter((s) => s.length > 0);
	return parts.join(', ');
}

export function personDisplayLong(p: PersonRow): string {
	const segments: string[] = [];
	if (p.first_name) segments.push(p.first_name);
	if (p.middle_name) segments.push(p.middle_name);
	segments.push(p.last_name);
	if (p.suffix) segments.push(p.suffix);
	return segments.filter((s) => s.length > 0).join(' ');
}
