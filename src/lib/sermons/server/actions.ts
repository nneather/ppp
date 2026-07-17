import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BIBLE_BOOK_NAMES } from '$lib/library/bible-book-names';
import { CONTEXT_TYPES, type ContextType } from '$lib/types/sermons';
import { parsePassageDisplay } from '$lib/sermons/passage-parse';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function trimOrNull(v: FormDataEntryValue | null): string | null {
	if (v === null || v === undefined) return null;
	const t = String(v).trim();
	return t.length > 0 ? t : null;
}

function parseContextType(raw: string | null): ContextType | null {
	if (!raw) return null;
	return (CONTEXT_TYPES as readonly string[]).includes(raw) ? (raw as ContextType) : null;
}

function parseOptionalInt(raw: string | null): number | null {
	if (raw == null || raw.trim() === '') return null;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n > 0 ? n : null;
}

type PassageDraft = {
	bible_book: string;
	chapter_start: number | null;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
	sort_order: number;
};

function parsePassagesJson(fd: FormData): { ok: true; passages: PassageDraft[] } | { ok: false; message: string } {
	const raw = trimOrNull(fd.get('passages_json'));
	if (!raw) return { ok: true, passages: [] };

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { ok: false, message: 'Invalid passages payload.' };
	}
	if (!Array.isArray(parsed)) {
		return { ok: false, message: 'Invalid passages payload.' };
	}

	const bibleSet = new Set(BIBLE_BOOK_NAMES);
	const passages: PassageDraft[] = [];
	let sort = 0;
	for (const item of parsed) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const bible_book = typeof row.bible_book === 'string' ? row.bible_book.trim() : '';
		if (!bible_book) continue;
		if (!bibleSet.has(bible_book as (typeof BIBLE_BOOK_NAMES)[number])) {
			return { ok: false, message: `Unknown Bible book: ${bible_book}.` };
		}
		passages.push({
			bible_book,
			chapter_start: typeof row.chapter_start === 'number' ? row.chapter_start : parseOptionalInt(String(row.chapter_start ?? '')),
			verse_start: typeof row.verse_start === 'number' ? row.verse_start : parseOptionalInt(String(row.verse_start ?? '')),
			chapter_end: typeof row.chapter_end === 'number' ? row.chapter_end : parseOptionalInt(String(row.chapter_end ?? '')),
			verse_end: typeof row.verse_end === 'number' ? row.verse_end : parseOptionalInt(String(row.verse_end ?? '')),
			sort_order: sort++
		});
	}
	return { ok: true, passages };
}

async function syncPassages(
	supabase: SupabaseClient,
	userId: string,
	sermonId: string,
	passages: PassageDraft[]
): Promise<string | null> {
	const { data: existing, error: loadErr } = await supabase
		.from('sermon_passages')
		.select('id')
		.eq('sermon_id', sermonId)
		.is('deleted_at', null);

	if (loadErr) {
		console.error('[sermons] syncPassages load', loadErr);
		return loadErr.message;
	}

	const now = new Date().toISOString();
	const liveIds = ((existing ?? []) as { id: string }[]).map((r) => r.id);
	if (liveIds.length) {
		const { error: softErr } = await supabase
			.from('sermon_passages')
			.update({ deleted_at: now } as never)
			.in('id', liveIds);
		if (softErr) {
			console.error('[sermons] syncPassages soft-delete', softErr);
			return softErr.message;
		}
	}

	if (!passages.length) return null;

	const { error: insErr } = await supabase.from('sermon_passages').insert(
		passages.map((p) => ({
			sermon_id: sermonId,
			bible_book: p.bible_book,
			chapter_start: p.chapter_start,
			verse_start: p.verse_start,
			chapter_end: p.chapter_end,
			verse_end: p.verse_end,
			sort_order: p.sort_order,
			created_by: userId
		})) as never
	);

	if (insErr) {
		console.error('[sermons] syncPassages insert', insErr);
		return insErr.message;
	}
	return null;
}

function resolvePassages(
	fd: FormData,
	passageDisplay: string | null
): { ok: true; passages: PassageDraft[] } | { ok: false; message: string } {
	const fromJson = parsePassagesJson(fd);
	if (!fromJson.ok) return fromJson;
	if (fromJson.passages.length) return fromJson;

	// Fallback: auto-parse display text when no structured rows posted.
	if (!passageDisplay) return { ok: true, passages: [] };
	const parsed = parsePassageDisplay(passageDisplay);
	return {
		ok: true,
		passages: parsed.map((p, i) => ({ ...p, sort_order: i }))
	};
}

export async function createSermonAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const preached_on = trimOrNull(fd.get('preached_on'));
	if (!preached_on || !DATE_RE.test(preached_on)) {
		return fail(400, { kind: 'createSermon' as const, message: 'Date is required.' });
	}

	const venue_id = trimOrNull(fd.get('venue_id'));
	if (venue_id && !UUID_RE.test(venue_id)) {
		return fail(400, { kind: 'createSermon' as const, message: 'Invalid venue.' });
	}

	const contextRaw = trimOrNull(fd.get('context_type'));
	const context_type = parseContextType(contextRaw);
	if (contextRaw && !context_type) {
		return fail(400, { kind: 'createSermon' as const, message: 'Invalid context type.' });
	}

	const topic = trimOrNull(fd.get('topic'));
	const passage_display = trimOrNull(fd.get('passage_display'));
	const notes = trimOrNull(fd.get('notes'));

	const passagesRes = resolvePassages(fd, passage_display);
	if (!passagesRes.ok) {
		return fail(400, { kind: 'createSermon' as const, message: passagesRes.message });
	}

	const { data: inserted, error: insErr } = await supabase
		.from('sermons')
		.insert({
			preached_on,
			venue_id: venue_id,
			context_type,
			topic,
			passage_display,
			notes,
			created_by: userId
		} as never)
		.select('id')
		.single();

	if (insErr || !inserted) {
		console.error('[sermons] createSermon', insErr);
		return fail(500, {
			kind: 'createSermon' as const,
			message: insErr?.message ?? 'Could not create sermon.'
		});
	}

	const sermonId = (inserted as { id: string }).id;
	const syncErr = await syncPassages(supabase, userId, sermonId, passagesRes.passages);
	if (syncErr) {
		return fail(500, { kind: 'createSermon' as const, sermonId, message: syncErr });
	}

	return { kind: 'createSermon' as const, success: true as const, sermonId };
}

export async function updateSermonAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const sermonId = trimOrNull(fd.get('sermon_id'));
	if (!sermonId || !UUID_RE.test(sermonId)) {
		return fail(400, { kind: 'updateSermon' as const, message: 'Invalid sermon.' });
	}

	const preached_on = trimOrNull(fd.get('preached_on'));
	if (!preached_on || !DATE_RE.test(preached_on)) {
		return fail(400, {
			kind: 'updateSermon' as const,
			sermonId,
			message: 'Date is required.'
		});
	}

	const venue_id = trimOrNull(fd.get('venue_id'));
	if (venue_id && !UUID_RE.test(venue_id)) {
		return fail(400, {
			kind: 'updateSermon' as const,
			sermonId,
			message: 'Invalid venue.'
		});
	}

	const contextRaw = trimOrNull(fd.get('context_type'));
	const context_type = parseContextType(contextRaw);
	if (contextRaw && !context_type) {
		return fail(400, {
			kind: 'updateSermon' as const,
			sermonId,
			message: 'Invalid context type.'
		});
	}

	const topic = trimOrNull(fd.get('topic'));
	const passage_display = trimOrNull(fd.get('passage_display'));
	const notes = trimOrNull(fd.get('notes'));

	const passagesRes = resolvePassages(fd, passage_display);
	if (!passagesRes.ok) {
		return fail(400, {
			kind: 'updateSermon' as const,
			sermonId,
			message: passagesRes.message
		});
	}

	const { error: updErr } = await supabase
		.from('sermons')
		.update({
			preached_on,
			venue_id: venue_id,
			context_type,
			topic,
			passage_display,
			notes
		} as never)
		.eq('id', sermonId)
		.is('deleted_at', null);

	if (updErr) {
		console.error('[sermons] updateSermon', updErr);
		return fail(500, {
			kind: 'updateSermon' as const,
			sermonId,
			message: updErr.message
		});
	}

	const syncErr = await syncPassages(supabase, userId, sermonId, passagesRes.passages);
	if (syncErr) {
		return fail(500, { kind: 'updateSermon' as const, sermonId, message: syncErr });
	}

	return { kind: 'updateSermon' as const, success: true as const, sermonId };
}

export async function softDeleteSermonAction(supabase: SupabaseClient, fd: FormData) {
	const sermonId = trimOrNull(fd.get('sermon_id'));
	if (!sermonId || !UUID_RE.test(sermonId)) {
		return fail(400, { kind: 'softDeleteSermon' as const, message: 'Invalid sermon.' });
	}

	const now = new Date().toISOString();
	const { error: updErr } = await supabase
		.from('sermons')
		.update({ deleted_at: now } as never)
		.eq('id', sermonId)
		.is('deleted_at', null);

	if (updErr) {
		console.error('[sermons] softDeleteSermon', updErr);
		return fail(500, {
			kind: 'softDeleteSermon' as const,
			sermonId,
			message: updErr.message
		});
	}

	await supabase
		.from('sermon_passages')
		.update({ deleted_at: now } as never)
		.eq('sermon_id', sermonId)
		.is('deleted_at', null);

	return { kind: 'softDeleteSermon' as const, success: true as const, sermonId };
}

export async function createVenueAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const name = String(fd.get('name') ?? '').trim();
	if (!name) {
		return fail(400, { kind: 'createVenue' as const, message: 'Name is required.' });
	}
	if (name.length > 200) {
		return fail(400, { kind: 'createVenue' as const, message: 'Name is too long.' });
	}

	const notes = trimOrNull(fd.get('notes'));

	const { data: existing } = await supabase
		.from('sermon_venues')
		.select('id, name')
		.is('deleted_at', null);

	const lower = name.toLowerCase();
	for (const row of existing ?? []) {
		const r = row as { id: string; name: string };
		if (r.name.trim().toLowerCase() === lower) {
			return fail(400, {
				kind: 'createVenue' as const,
				message: `Venue already exists: “${r.name}”.`
			});
		}
	}

	const { data: inserted, error: insErr } = await supabase
		.from('sermon_venues')
		.insert({ name, notes, created_by: userId } as never)
		.select('id')
		.single();

	if (insErr || !inserted) {
		console.error('[sermons] createVenue', insErr);
		return fail(500, {
			kind: 'createVenue' as const,
			message: insErr?.message ?? 'Could not create venue.'
		});
	}

	return {
		kind: 'createVenue' as const,
		success: true as const,
		venueId: (inserted as { id: string }).id
	};
}

export async function updateVenueAction(supabase: SupabaseClient, fd: FormData) {
	const venueId = trimOrNull(fd.get('venue_id'));
	if (!venueId || !UUID_RE.test(venueId)) {
		return fail(400, { kind: 'updateVenue' as const, message: 'Invalid venue.' });
	}

	const name = String(fd.get('name') ?? '').trim();
	if (!name) {
		return fail(400, {
			kind: 'updateVenue' as const,
			venueId,
			message: 'Name is required.'
		});
	}

	const notes = trimOrNull(fd.get('notes'));

	const { data: existing } = await supabase
		.from('sermon_venues')
		.select('id, name')
		.is('deleted_at', null)
		.neq('id', venueId);

	const lower = name.toLowerCase();
	for (const row of existing ?? []) {
		const r = row as { id: string; name: string };
		if (r.name.trim().toLowerCase() === lower) {
			return fail(400, {
				kind: 'updateVenue' as const,
				venueId,
				message: `Venue already exists: “${r.name}”.`
			});
		}
	}

	const { error: updErr } = await supabase
		.from('sermon_venues')
		.update({ name, notes } as never)
		.eq('id', venueId)
		.is('deleted_at', null);

	if (updErr) {
		console.error('[sermons] updateVenue', updErr);
		return fail(500, {
			kind: 'updateVenue' as const,
			venueId,
			message: updErr.message
		});
	}

	return { kind: 'updateVenue' as const, success: true as const, venueId };
}

export async function softDeleteVenueAction(supabase: SupabaseClient, fd: FormData) {
	const venueId = trimOrNull(fd.get('venue_id'));
	if (!venueId || !UUID_RE.test(venueId)) {
		return fail(400, { kind: 'softDeleteVenue' as const, message: 'Invalid venue.' });
	}

	const { count, error: countErr } = await supabase
		.from('sermons')
		.select('id', { count: 'exact', head: true })
		.eq('venue_id', venueId)
		.is('deleted_at', null);

	if (countErr) {
		console.error('[sermons] softDeleteVenue count', countErr);
		return fail(500, {
			kind: 'softDeleteVenue' as const,
			venueId,
			message: countErr.message
		});
	}

	if ((count ?? 0) > 0) {
		return fail(400, {
			kind: 'softDeleteVenue' as const,
			venueId,
			message: `Cannot remove: ${count} sermon${count === 1 ? '' : 's'} still reference this venue.`
		});
	}

	const { error: updErr } = await supabase
		.from('sermon_venues')
		.update({ deleted_at: new Date().toISOString() } as never)
		.eq('id', venueId)
		.is('deleted_at', null);

	if (updErr) {
		console.error('[sermons] softDeleteVenue', updErr);
		return fail(500, {
			kind: 'softDeleteVenue' as const,
			venueId,
			message: updErr.message
		});
	}

	return { kind: 'softDeleteVenue' as const, success: true as const, venueId };
}
