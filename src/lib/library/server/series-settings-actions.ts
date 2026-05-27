import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeSeriesName } from '$lib/library/match';

export type SeriesSettingsActionKind = 'createSeries' | 'updateSeries' | 'softDeleteSeries';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trimOrNull(v: FormDataEntryValue | null): string | null {
	if (v === null || v === undefined) return null;
	const t = String(v).trim();
	return t.length > 0 ? t : null;
}

async function findDuplicateSeriesByName(
	supabase: SupabaseClient,
	name: string
): Promise<{ id: string; name: string } | null> {
	const normalized = normalizeSeriesName(name);
	if (!normalized) return null;

	const { data, error } = await supabase
		.from('series')
		.select('id, name, abbreviation')
		.is('deleted_at', null);

	if (error) {
		console.error(error);
		return null;
	}

	for (const row of data ?? []) {
		const r = row as { id: string; name: string; abbreviation: string | null };
		if (normalizeSeriesName(r.name) === normalized) return { id: r.id, name: r.name };
		if (r.abbreviation && normalizeSeriesName(r.abbreviation) === normalized) {
			return { id: r.id, name: r.name };
		}
	}
	return null;
}

export async function createSeriesSettingsAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const name = String(fd.get('name') ?? '').trim();
	if (!name) {
		return fail(400, { kind: 'createSeries' as const, message: 'Name is required.' });
	}
	if (name.length > 300) {
		return fail(400, { kind: 'createSeries' as const, message: 'Name is too long.' });
	}

	const abbreviation = trimOrNull(fd.get('abbreviation'));
	if (abbreviation && abbreviation.length > 32) {
		return fail(400, { kind: 'createSeries' as const, message: 'Abbreviation is too long.' });
	}

	const duplicate = await findDuplicateSeriesByName(supabase, name);
	if (duplicate) {
		return fail(400, {
			kind: 'createSeries' as const,
			message: `Series already exists: “${duplicate.name}”.`
		});
	}

	const { data: inserted, error: insErr } = await supabase
		.from('series')
		.insert({
			name,
			abbreviation,
			created_by: userId
		} as never)
		.select('id, name, abbreviation')
		.single();

	if (insErr) {
		console.error(insErr);
		return fail(500, {
			kind: 'createSeries' as const,
			message: insErr.message ?? 'Could not create series.'
		});
	}

	const row = inserted as { id: string; name: string; abbreviation: string | null };

	return {
		kind: 'createSeries' as const,
		success: true as const,
		seriesId: row.id,
		series: {
			id: row.id,
			name: row.name,
			abbreviation: row.abbreviation
		}
	};
}

export async function updateSeriesSettingsAction(
	supabase: SupabaseClient,
	_userId: string,
	fd: FormData
) {
	const id = String(fd.get('id') ?? '').trim();
	if (!id)
		return fail(400, { kind: 'updateSeries' as const, seriesId: '', message: 'Missing series id.' });
	if (!UUID_RE.test(id)) {
		return fail(400, { kind: 'updateSeries' as const, seriesId: id, message: 'Invalid series id.' });
	}

	const name = String(fd.get('name') ?? '').trim();
	if (!name) {
		return fail(400, {
			kind: 'updateSeries' as const,
			seriesId: id,
			message: 'Name is required.'
		});
	}
	if (name.length > 300) {
		return fail(400, {
			kind: 'updateSeries' as const,
			seriesId: id,
			message: 'Name is too long.'
		});
	}

	const abbreviation = trimOrNull(fd.get('abbreviation'));

	const { data: existing, error: exErr } = await supabase
		.from('series')
		.select('id')
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();
	if (exErr) {
		console.error(exErr);
		return fail(500, {
			kind: 'updateSeries' as const,
			seriesId: id,
			message: exErr.message ?? 'Could not load series.'
		});
	}
	if (!existing) {
		return fail(404, { kind: 'updateSeries' as const, seriesId: id, message: 'Series not found.' });
	}

	const { error: updErr } = await supabase
		.from('series')
		.update({
			name,
			abbreviation
		} as never)
		.eq('id', id);
	if (updErr) {
		console.error(updErr);
		return fail(500, {
			kind: 'updateSeries' as const,
			seriesId: id,
			message: updErr.message ?? 'Could not update series.'
		});
	}

	return { kind: 'updateSeries' as const, seriesId: id, success: true as const };
}

export async function softDeleteSeriesSettingsAction(
	supabase: SupabaseClient,
	_userId: string,
	fd: FormData
) {
	const id = String(fd.get('id') ?? '').trim();
	if (!id) {
		return fail(400, {
			kind: 'softDeleteSeries' as const,
			seriesId: '',
			message: 'Missing series id.'
		});
	}
	if (!UUID_RE.test(id)) {
		return fail(400, {
			kind: 'softDeleteSeries' as const,
			seriesId: id,
			message: 'Invalid series id.'
		});
	}

	const { data: existing, error: exErr } = await supabase
		.from('series')
		.select('id')
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();
	if (exErr) {
		console.error(exErr);
		return fail(500, {
			kind: 'softDeleteSeries' as const,
			seriesId: id,
			message: exErr.message ?? 'Could not load series.'
		});
	}
	if (!existing) {
		return fail(404, {
			kind: 'softDeleteSeries' as const,
			seriesId: id,
			message: 'Series not found.'
		});
	}

	const { count, error: cntErr } = await supabase
		.from('books')
		.select('id', { count: 'exact', head: true })
		.eq('series_id', id)
		.is('deleted_at', null);
	if (cntErr) {
		console.error(cntErr);
		return fail(500, {
			kind: 'softDeleteSeries' as const,
			seriesId: id,
			message: cntErr.message ?? 'Could not count attached books.'
		});
	}
	const n = count ?? 0;
	if (n > 0) {
		return fail(400, {
			kind: 'softDeleteSeries' as const,
			seriesId: id,
			message: `This series is still used by ${n} book(s). Reassign or clear series on those books before removing it.`
		});
	}

	const { error: updErr } = await supabase
		.from('series')
		.update({ deleted_at: new Date().toISOString() } as never)
		.eq('id', id);
	if (updErr) {
		console.error(updErr);
		return fail(500, {
			kind: 'softDeleteSeries' as const,
			seriesId: id,
			message: updErr.message ?? 'Could not remove series.'
		});
	}

	return { kind: 'softDeleteSeries' as const, seriesId: id, success: true as const };
}
