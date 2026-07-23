import type { SupabaseClient } from '@supabase/supabase-js';
import { authorsLabelForBook } from '$lib/library/authors-label';
import { BIBLE_BOOK_NAMES } from '$lib/library/bible-book-names';
import {
	collapseCommentaryHits,
	emptyByBookRows,
	filterByBookRows,
	parseByBookListFilters,
	sortByBookRows,
	sortShelfHits,
	summarizeByBookRows
} from '$lib/sermons/by-book';
import { librarySearchHref } from '$lib/sermons/passage-parse';
import type { PersonRow } from '$lib/types/library';
import {
	CONTEXT_TYPES,
	type ByBookListFilters,
	type ByBookRow,
	type ByBookShelfHit,
	type ByBookSummary,
	type ContextType,
	type DashboardSermonRow,
	type SermonListFilters,
	type SermonListRow,
	type SermonPassageRow,
	type SermonVenueRow
} from '$lib/types/sermons';

type VenueDb = {
	id: string;
	name: string;
	notes: string | null;
};

type PassageDb = {
	id: string;
	sermon_id: string;
	bible_book: string;
	chapter_start: number | null;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
	sort_order: number;
};

type SermonDb = {
	id: string;
	preached_on: string;
	venue_id: string | null;
	context_type: string | null;
	topic: string | null;
	passage_display: string | null;
	notes: string | null;
};

function asContextType(v: string | null): ContextType | null {
	if (v == null) return null;
	return (CONTEXT_TYPES as readonly string[]).includes(v) ? (v as ContextType) : null;
}

function mapPassage(p: PassageDb): SermonPassageRow {
	return {
		id: p.id,
		bible_book: p.bible_book,
		chapter_start: p.chapter_start,
		verse_start: p.verse_start,
		chapter_end: p.chapter_end,
		verse_end: p.verse_end,
		sort_order: p.sort_order
	};
}

export async function loadSermonVenues(supabase: SupabaseClient): Promise<{
	venues: SermonVenueRow[];
	error: string | null;
}> {
	const [venuesRes, countsRes] = await Promise.all([
		supabase
			.from('sermon_venues')
			.select('id, name, notes')
			.is('deleted_at', null)
			.order('name', { ascending: true }),
		supabase.from('sermons').select('venue_id').is('deleted_at', null).not('venue_id', 'is', null)
	]);

	if (venuesRes.error) {
		console.error('[sermons] loadSermonVenues', venuesRes.error);
		return { venues: [], error: venuesRes.error.message };
	}
	if (countsRes.error) {
		console.error('[sermons] venue counts', countsRes.error);
	}

	const countByVenue = new Map<string, number>();
	for (const row of countsRes.data ?? []) {
		const vid = (row as { venue_id: string | null }).venue_id;
		if (!vid) continue;
		countByVenue.set(vid, (countByVenue.get(vid) ?? 0) + 1);
	}

	const venues: SermonVenueRow[] = ((venuesRes.data ?? []) as VenueDb[]).map((v) => ({
		id: v.id,
		name: v.name,
		notes: v.notes,
		sermonCount: countByVenue.get(v.id) ?? 0
	}));

	return { venues, error: null };
}

const UPCOMING_SERMONS_DEFAULT_LIMIT = 5;

/** Live sermons with `preached_on >= todayYmd`, soonest first (dashboard panel). */
export async function loadUpcomingSermons(
	supabase: SupabaseClient,
	opts: { todayYmd: string; limit?: number }
): Promise<{ sermons: DashboardSermonRow[]; error: string | null }> {
	const limit = opts.limit ?? UPCOMING_SERMONS_DEFAULT_LIMIT;
	const sermonsRes = await supabase
		.from('sermons')
		.select('id, preached_on, venue_id, context_type, topic, passage_display')
		.is('deleted_at', null)
		.gte('preached_on', opts.todayYmd)
		.order('preached_on', { ascending: true })
		.limit(limit);

	if (sermonsRes.error) {
		console.error('[sermons] loadUpcomingSermons', sermonsRes.error);
		return { sermons: [], error: sermonsRes.error.message };
	}

	const sermonRows = (sermonsRes.data ?? []) as Array<{
		id: string;
		preached_on: string;
		venue_id: string | null;
		context_type: string | null;
		topic: string | null;
		passage_display: string | null;
	}>;

	const venueIds = [
		...new Set(sermonRows.map((s) => s.venue_id).filter((id): id is string => id != null))
	];
	const venuesRes = venueIds.length
		? await supabase.from('sermon_venues').select('id, name').in('id', venueIds)
		: { data: [] as { id: string; name: string }[], error: null };

	if (venuesRes.error) console.error('[sermons] upcoming venues', venuesRes.error);

	const venueNameById = new Map<string, string>();
	for (const v of venuesRes.data ?? []) {
		const row = v as { id: string; name: string };
		venueNameById.set(row.id, row.name);
	}

	const sermons: DashboardSermonRow[] = sermonRows.map((s) => ({
		id: s.id,
		preached_on: s.preached_on,
		venue_name: s.venue_id ? (venueNameById.get(s.venue_id) ?? null) : null,
		context_type: asContextType(s.context_type),
		topic: s.topic,
		passage_display: s.passage_display
	}));

	return { sermons, error: null };
}

export async function loadSermons(
	supabase: SupabaseClient,
	filters: SermonListFilters = {
		year: null,
		context: null,
		venueId: null,
		bibleBook: null
	}
): Promise<{ sermons: SermonListRow[]; error: string | null }> {
	let sermonIdFilter: string[] | null = null;
	if (filters.bibleBook) {
		const passRes = await supabase
			.from('sermon_passages')
			.select('sermon_id')
			.eq('bible_book', filters.bibleBook)
			.is('deleted_at', null);
		if (passRes.error) {
			console.error('[sermons] bible_book passage filter', passRes.error);
			return { sermons: [], error: passRes.error.message };
		}
		sermonIdFilter = [
			...new Set(
				((passRes.data ?? []) as { sermon_id: string }[]).map((r) => r.sermon_id)
			)
		];
		if (sermonIdFilter.length === 0) {
			return { sermons: [], error: null };
		}
	}

	let q = supabase
		.from('sermons')
		.select('id, preached_on, venue_id, context_type, topic, passage_display, notes')
		.is('deleted_at', null)
		.order('preached_on', { ascending: false });

	if (filters.context) {
		q = q.eq('context_type', filters.context);
	}
	if (filters.venueId) {
		q = q.eq('venue_id', filters.venueId);
	}
	if (filters.year != null) {
		q = q
			.gte('preached_on', `${filters.year}-01-01`)
			.lte('preached_on', `${filters.year}-12-31`);
	}
	if (sermonIdFilter) {
		q = q.in('id', sermonIdFilter);
	}

	const sermonsRes = await q;
	if (sermonsRes.error) {
		console.error('[sermons] loadSermons', sermonsRes.error);
		return { sermons: [], error: sermonsRes.error.message };
	}

	const sermonRows = (sermonsRes.data ?? []) as SermonDb[];
	const sermonIds = sermonRows.map((s) => s.id);
	const venueIds = [
		...new Set(sermonRows.map((s) => s.venue_id).filter((id): id is string => id != null))
	];

	const [venuesRes, passagesRes] = await Promise.all([
		venueIds.length
			? supabase.from('sermon_venues').select('id, name').in('id', venueIds)
			: Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
		sermonIds.length
			? supabase
					.from('sermon_passages')
					.select(
						'id, sermon_id, bible_book, chapter_start, verse_start, chapter_end, verse_end, sort_order'
					)
					.in('sermon_id', sermonIds)
					.is('deleted_at', null)
					.order('sort_order', { ascending: true })
			: Promise.resolve({ data: [] as PassageDb[], error: null })
	]);

	if (venuesRes.error) console.error('[sermons] venues embed', venuesRes.error);
	if (passagesRes.error) console.error('[sermons] passages', passagesRes.error);

	const venueNameById = new Map<string, string>();
	for (const v of venuesRes.data ?? []) {
		const row = v as { id: string; name: string };
		venueNameById.set(row.id, row.name);
	}

	const passagesBySermon = new Map<string, SermonPassageRow[]>();
	for (const raw of passagesRes.data ?? []) {
		const p = raw as PassageDb;
		const list = passagesBySermon.get(p.sermon_id) ?? [];
		list.push(mapPassage(p));
		passagesBySermon.set(p.sermon_id, list);
	}

	const sermons: SermonListRow[] = sermonRows.map((s) => {
		const passages = passagesBySermon.get(s.id) ?? [];
		const first = passages[0];
		return {
			id: s.id,
			preached_on: s.preached_on,
			venue_id: s.venue_id,
			venue_name: s.venue_id ? (venueNameById.get(s.venue_id) ?? null) : null,
			context_type: asContextType(s.context_type),
			topic: s.topic,
			passage_display: s.passage_display,
			notes: s.notes,
			passages,
			library_search_href: first
				? librarySearchHref(
						{
							bible_book: first.bible_book,
							chapter_start: first.chapter_start,
							verse_start: first.verse_start,
							chapter_end: first.chapter_end,
							verse_end: first.verse_end
						},
						{ returnTo: '/sermons' }
					)
				: null
		};
	});

	return { sermons, error: null };
}

export function parseSermonListFilters(url: URL): SermonListFilters {
	const yearRaw = url.searchParams.get('year');
	let year: number | null = null;
	if (yearRaw) {
		const n = Number.parseInt(yearRaw, 10);
		if (Number.isFinite(n) && n >= 2000 && n <= 2100) year = n;
	}

	const contextRaw = url.searchParams.get('context');
	const context =
		contextRaw && (CONTEXT_TYPES as readonly string[]).includes(contextRaw)
			? (contextRaw as ContextType)
			: null;

	const venueRaw = (url.searchParams.get('venue') ?? '').trim();
	const venueId =
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(venueRaw)
			? venueRaw
			: null;

	const bibleBookRaw = (url.searchParams.get('bible_book') ?? '').trim();
	const bibleBook =
		bibleBookRaw && (BIBLE_BOOK_NAMES as readonly string[]).includes(bibleBookRaw)
			? bibleBookRaw
			: null;

	return { year, context, venueId, bibleBook };
}

// ---------------------------------------------------------------------------
// By-book commentary × sermon stats
// ---------------------------------------------------------------------------

type CovSeriesEmbed = {
	id: string;
	name: string;
	abbreviation: string | null;
	deleted_at: string | null;
};

type CovBookEmbed = {
	id: string;
	title: string | null;
	genre: string | null;
	rating: number | null;
	deleted_at: string | null;
	series_id: string | null;
	series: CovSeriesEmbed | CovSeriesEmbed[] | null;
};

type CovEssayParentEmbed = {
	id: string;
	title: string | null;
	genre: string | null;
	rating: number | null;
	deleted_at: string | null;
	series_id: string | null;
	series: CovSeriesEmbed | CovSeriesEmbed[] | null;
};

type CovEssayEmbed = {
	id: string;
	essay_title: string;
	deleted_at: string | null;
	parent_book_id: string;
	books: CovEssayParentEmbed | CovEssayParentEmbed[] | null;
};

type CoverageDb = {
	id: string;
	bible_book: string;
	book_id: string | null;
	essay_id: string | null;
	books: CovBookEmbed | CovBookEmbed[] | null;
	essays: CovEssayEmbed | CovEssayEmbed[] | null;
};

type AuthorJunctionDb = {
	book_id: string;
	person_id: string;
	sort_order: number;
	role: string;
};

type EssayAuthorDb = {
	essay_id: string;
	person_id: string;
	sort_order: number;
	role: string;
};

type PersonDb = {
	id: string;
	first_name: string | null;
	middle_name: string | null;
	last_name: string;
	suffix: string | null;
	aliases: string[] | null;
};

function oneEmbed<T>(v: T | T[] | null | undefined): T | null {
	if (v == null) return null;
	return Array.isArray(v) ? (v[0] ?? null) : v;
}

function personFromDb(p: PersonDb): PersonRow {
	return {
		id: p.id,
		first_name: p.first_name,
		middle_name: p.middle_name,
		last_name: p.last_name,
		suffix: p.suffix,
		aliases: Array.isArray(p.aliases) ? p.aliases : []
	};
}

function essayAuthorShort(
	essayId: string,
	essayAuthors: EssayAuthorDb[],
	peopleMap: Map<string, PersonRow>
): string | null {
	const rows = essayAuthors
		.filter((a) => a.essay_id === essayId)
		.sort((a, b) => a.sort_order - b.sort_order);
	if (rows.length === 0) return null;
	return authorsLabelForBook(
		rows.map((a) => ({ person_id: a.person_id, sort_order: a.sort_order, role: a.role })),
		peopleMap
	);
}

function essayAuthorKey(essayId: string, essayAuthors: EssayAuthorDb[]): string {
	const ids = [
		...new Set(
			essayAuthors
				.filter((a) => a.essay_id === essayId && (a.role === 'author' || a.role === 'editor'))
				.map((a) => a.person_id)
		)
	].sort();
	return ids.join('|');
}

/** Sorted author/editor person ids — collapse key with series_id. */
function authorKeyFromJunctions(rows: AuthorJunctionDb[]): string {
	const ids = [
		...new Set(
			rows
				.filter((a) => a.role === 'author' || a.role === 'editor')
				.map((a) => a.person_id)
		)
	].sort();
	return ids.join('|');
}

function seriesLabelFromEmbed(
	seriesId: string | null,
	seriesEmbed: CovSeriesEmbed | CovSeriesEmbed[] | null
): { seriesId: string | null; seriesLabel: string | null } {
	if (!seriesId) return { seriesId: null, seriesLabel: null };
	const series = oneEmbed(seriesEmbed);
	if (!series || series.deleted_at) return { seriesId: null, seriesLabel: null };
	const abbr = series.abbreviation?.trim() || null;
	const name = series.name?.trim() || null;
	return { seriesId: series.id, seriesLabel: abbr || name };
}

/**
 * Assemble the Protestant canon spine with sermon counts + Commentary coverage
 * (and Also on shelf). No new tables — aggregates existing rows.
 */
export async function loadByBookStats(
	supabase: SupabaseClient,
	filters: ByBookListFilters
): Promise<{
	rows: ByBookRow[];
	summary: ByBookSummary;
	filters: ByBookListFilters;
	error: string | null;
}> {
	const [passagesRes, coverageRes] = await Promise.all([
		supabase
			.from('sermon_passages')
			.select('sermon_id, bible_book, sermons!inner ( id, deleted_at, preached_on )')
			.is('deleted_at', null)
			.is('sermons.deleted_at', null),
		supabase.from('book_bible_coverage').select(
			`
			id,
			bible_book,
			book_id,
			essay_id,
			books (
				id,
				title,
				genre,
				rating,
				deleted_at,
				series_id,
				series ( id, name, abbreviation, deleted_at )
			),
			essays (
				id,
				essay_title,
				deleted_at,
				parent_book_id,
				books!essays_parent_book_id_fkey (
					id,
					title,
					genre,
					rating,
					deleted_at,
					series_id,
					series ( id, name, abbreviation, deleted_at )
				)
			)
		`
		)
	]);

	if (passagesRes.error) {
		console.error('[sermons] loadByBookStats passages', passagesRes.error);
		return {
			rows: emptyByBookRows(),
			summary: { sermonTotal: 0, commentaryTotal: 0, fourStarTotal: 0 },
			filters,
			error: passagesRes.error.message
		};
	}
	if (coverageRes.error) {
		console.error('[sermons] loadByBookStats coverage', coverageRes.error);
		return {
			rows: emptyByBookRows(),
			summary: { sermonTotal: 0, commentaryTotal: 0, fourStarTotal: 0 },
			filters,
			error: coverageRes.error.message
		};
	}

	const sermonIdsByBook = new Map<string, Set<string>>();
	const latestSermonOnByBook = new Map<string, string>();
	const allSermonIds = new Set<string>();
	for (const raw of passagesRes.data ?? []) {
		const row = raw as {
			sermon_id: string;
			bible_book: string;
			sermons:
				| { id: string; deleted_at: string | null; preached_on: string }
				| { id: string; deleted_at: string | null; preached_on: string }[]
				| null;
		};
		allSermonIds.add(row.sermon_id);
		const set = sermonIdsByBook.get(row.bible_book) ?? new Set<string>();
		set.add(row.sermon_id);
		sermonIdsByBook.set(row.bible_book, set);

		const sermon = oneEmbed(row.sermons);
		const preachedOn = sermon?.preached_on?.trim() || null;
		if (preachedOn) {
			const prev = latestSermonOnByBook.get(row.bible_book);
			if (!prev || preachedOn > prev) {
				latestSermonOnByBook.set(row.bible_book, preachedOn);
			}
		}
	}

	const covRows = (coverageRes.data ?? []) as unknown as CoverageDb[];
	const bookIds = new Set<string>();
	const essayIds = new Set<string>();
	for (const c of covRows) {
		if (c.book_id) bookIds.add(c.book_id);
		if (c.essay_id) essayIds.add(c.essay_id);
	}

	const [authorsRes, essayAuthorsRes] = await Promise.all([
		bookIds.size
			? supabase
					.from('book_authors')
					.select('book_id, person_id, sort_order, role')
					.in('book_id', [...bookIds])
			: Promise.resolve({ data: [] as AuthorJunctionDb[], error: null }),
		essayIds.size
			? supabase
					.from('essay_authors')
					.select('essay_id, person_id, sort_order, role')
					.in('essay_id', [...essayIds])
			: Promise.resolve({ data: [] as EssayAuthorDb[], error: null })
	]);

	if (authorsRes.error) console.error('[sermons] by-book book_authors', authorsRes.error);
	if (essayAuthorsRes.error) {
		console.error('[sermons] by-book essay_authors', essayAuthorsRes.error);
	}

	const authorRows = (authorsRes.data ?? []) as AuthorJunctionDb[];
	const essayAuthorRows = (essayAuthorsRes.data ?? []) as EssayAuthorDb[];
	const personIds = [
		...new Set([
			...authorRows.map((a) => a.person_id),
			...essayAuthorRows.map((a) => a.person_id)
		])
	];

	const peopleRes = personIds.length
		? await supabase
				.from('people')
				.select('id, first_name, middle_name, last_name, suffix, aliases')
				.in('id', personIds)
				.is('deleted_at', null)
		: { data: [] as PersonDb[], error: null };

	if (peopleRes.error) console.error('[sermons] by-book people', peopleRes.error);

	const peopleMap = new Map<string, PersonRow>();
	for (const p of (peopleRes.data ?? []) as PersonDb[]) {
		peopleMap.set(p.id, personFromDb(p));
	}

	const authorsByBook = new Map<string, AuthorJunctionDb[]>();
	for (const a of authorRows) {
		const list = authorsByBook.get(a.book_id) ?? [];
		list.push(a);
		authorsByBook.set(a.book_id, list);
	}

	const commentariesByBook = new Map<string, ByBookShelfHit[]>();
	const alsoByBook = new Map<string, ByBookShelfHit[]>();

	for (const c of covRows) {
		if (!(BIBLE_BOOK_NAMES as readonly string[]).includes(c.bible_book)) continue;

		if (c.essay_id) {
			const essay = oneEmbed(c.essays);
			if (!essay || essay.deleted_at) continue;
			const parent = oneEmbed(essay.books);
			if (!parent || parent.deleted_at) continue;
			const authorKey = essayAuthorKey(essay.id, essayAuthorRows) || null;
			const { seriesId, seriesLabel } = seriesLabelFromEmbed(parent.series_id, parent.series);
			const hit: ByBookShelfHit = {
				kind: 'essay',
				bookId: parent.id,
				essayId: essay.id,
				title: essay.essay_title,
				authorShort: essayAuthorShort(essay.id, essayAuthorRows, peopleMap),
				seriesLabel,
				seriesId,
				authorKey,
				rating: parent.rating,
				genre: parent.genre,
				href: `/library/books/${parent.id}#essay-${essay.id}`
			};
			// Signed commentary essays (ESVEC, NIB) belong with Commentaries; other
			// essay coverage (reference parents, etc.) stays under Also on the shelf.
			if (parent.genre === 'Commentary') {
				const list = commentariesByBook.get(c.bible_book) ?? [];
				list.push(hit);
				commentariesByBook.set(c.bible_book, list);
			} else {
				const list = alsoByBook.get(c.bible_book) ?? [];
				list.push(hit);
				alsoByBook.set(c.bible_book, list);
			}
			continue;
		}

		const book = oneEmbed(c.books);
		if (!book || book.deleted_at || !c.book_id) continue;

		const junctions = authorsByBook.get(book.id) ?? [];
		const authorShort = authorsLabelForBook(junctions, peopleMap);
		const authorKey = authorKeyFromJunctions(junctions) || null;
		const { seriesId, seriesLabel } = seriesLabelFromEmbed(book.series_id, book.series);
		const hit: ByBookShelfHit = {
			kind: 'book',
			bookId: book.id,
			essayId: null,
			title: (book.title ?? '').trim() || 'Untitled',
			authorShort,
			seriesLabel,
			seriesId,
			authorKey,
			rating: book.rating,
			genre: book.genre,
			href: `/library/books/${book.id}`
		};

		if (book.genre === 'Commentary') {
			const list = commentariesByBook.get(c.bible_book) ?? [];
			list.push(hit);
			commentariesByBook.set(c.bible_book, list);
		} else {
			// Biblical Reference + every other genre with coverage
			const list = alsoByBook.get(c.bible_book) ?? [];
			list.push(hit);
			alsoByBook.set(c.bible_book, list);
		}
	}

	const assembled = emptyByBookRows().map((row) => {
		const sermonCount = sermonIdsByBook.get(row.bibleBook)?.size ?? 0;
		const commentaries = sortShelfHits(
			collapseCommentaryHits(commentariesByBook.get(row.bibleBook) ?? [])
		);
		const alsoOnShelf = sortShelfHits(alsoByBook.get(row.bibleBook) ?? []);
		const fourStarCount = commentaries.filter((h) => h.rating != null && h.rating >= 4).length;
		return {
			...row,
			sermonCount,
			latestSermonOn: latestSermonOnByBook.get(row.bibleBook) ?? null,
			commentaryCount: commentaries.length,
			fourStarCount,
			commentaries,
			alsoOnShelf
		};
	});

	const summary = summarizeByBookRows(assembled, allSermonIds.size);
	const filtered = filterByBookRows(assembled, filters);
	const rows = sortByBookRows(filtered, filters.sort, filters.sortDir);

	return { rows, summary, filters, error: null };
}

export { parseByBookListFilters };
