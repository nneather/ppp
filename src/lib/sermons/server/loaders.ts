import type { SupabaseClient } from '@supabase/supabase-js';
import {
	CONTEXT_TYPES,
	type ContextType,
	type SermonListFilters,
	type SermonListRow,
	type SermonPassageRow,
	type SermonVenueRow
} from '$lib/types/sermons';
import { librarySearchHref } from '$lib/sermons/passage-parse';

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

export async function loadSermons(
	supabase: SupabaseClient,
	filters: SermonListFilters = { year: null, context: null, venueId: null }
): Promise<{ sermons: SermonListRow[]; error: string | null }> {
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
				? librarySearchHref({
						bible_book: first.bible_book,
						chapter_start: first.chapter_start,
						verse_start: first.verse_start,
						chapter_end: first.chapter_end,
						verse_end: first.verse_end
					})
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

	return { year, context, venueId };
}
