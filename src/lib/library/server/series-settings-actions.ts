import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

export type SeriesSettingsActionKind = 'updateSeries' | 'softDeleteSeries';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trimOrNull(v: FormDataEntryValue | null): string | null {
	if (v === null || v === undefined) return null;
	const t = String(v).trim();
	return t.length > 0 ? t : null;
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
