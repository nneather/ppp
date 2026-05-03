import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

export type PeopleSettingsActionKind =
	| 'updatePerson'
	| 'softDeletePerson'
	| 'mergePeople';

function trimOrNull(v: FormDataEntryValue | null): string | null {
	if (v === null || v === undefined) return null;
	const t = String(v).trim();
	return t.length > 0 ? t : null;
}

function readAliases(fd: FormData): string[] {
	const raw = fd.getAll('aliases').map((x) => String(x).trim()).filter(Boolean);
	return [...new Set(raw)];
}

export async function loadProfileRole(
	supabase: SupabaseClient,
	userId: string
): Promise<'owner' | 'viewer' | null> {
	const { data, error } = await supabase
		.from('profiles')
		.select('role')
		.eq('id', userId)
		.maybeSingle();
	if (error) {
		console.error(error);
		return null;
	}
	const r = data?.role as string | null;
	if (r === 'owner' || r === 'viewer') return r;
	return null;
}

export async function updatePersonSettingsAction(
	supabase: SupabaseClient,
	_userId: string,
	fd: FormData
) {
	const id = String(fd.get('id') ?? '').trim();
	if (!id)
		return fail(400, { kind: 'updatePerson' as const, personId: '', message: 'Missing person id.' });

	const last_name = String(fd.get('last_name') ?? '').trim();
	if (!last_name)
		return fail(400, {
			kind: 'updatePerson' as const,
			personId: id,
			message: 'Last name is required.'
		});
	if (last_name.length > 200)
		return fail(400, {
			kind: 'updatePerson' as const,
			personId: id,
			message: 'Last name is too long.'
		});

	const first_name = trimOrNull(fd.get('first_name'));
	const middle_name = trimOrNull(fd.get('middle_name'));
	const suffix = trimOrNull(fd.get('suffix'));
	const aliases = readAliases(fd);

	const { data: existing, error: exErr } = await supabase
		.from('people')
		.select('id')
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();
	if (exErr) {
		console.error(exErr);
		return fail(500, {
			kind: 'updatePerson' as const,
			personId: id,
			message: exErr.message ?? 'Could not load person.'
		});
	}
	if (!existing) {
		return fail(404, { kind: 'updatePerson' as const, personId: id, message: 'Person not found.' });
	}

	const { error: updErr } = await supabase
		.from('people')
		.update({
			last_name,
			first_name,
			middle_name,
			suffix,
			aliases
		} as never)
		.eq('id', id);
	if (updErr) {
		console.error(updErr);
		return fail(500, {
			kind: 'updatePerson' as const,
			personId: id,
			message: updErr.message ?? 'Could not update person.'
		});
	}

	return { kind: 'updatePerson' as const, personId: id, success: true as const };
}

export async function softDeletePersonSettingsAction(
	supabase: SupabaseClient,
	_userId: string,
	fd: FormData
) {
	const id = String(fd.get('id') ?? '').trim();
	if (!id) {
		return fail(400, {
			kind: 'softDeletePerson' as const,
			personId: '',
			message: 'Missing person id.'
		});
	}

	const { data: existing, error: exErr } = await supabase
		.from('people')
		.select('id')
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();
	if (exErr) {
		console.error(exErr);
		return fail(500, {
			kind: 'softDeletePerson' as const,
			personId: id,
			message: exErr.message ?? 'Could not load person.'
		});
	}
	if (!existing) {
		return fail(404, {
			kind: 'softDeletePerson' as const,
			personId: id,
			message: 'Person not found.'
		});
	}

	const { error: updErr } = await supabase
		.from('people')
		.update({
			deleted_at: new Date().toISOString(),
			merged_into_id: null
		} as never)
		.eq('id', id);
	if (updErr) {
		console.error(updErr);
		return fail(500, {
			kind: 'softDeletePerson' as const,
			personId: id,
			message: updErr.message ?? 'Could not delete person.'
		});
	}

	return { kind: 'softDeletePerson' as const, personId: id, success: true as const };
}

export async function mergePeopleSettingsAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const role = await loadProfileRole(supabase, userId);
	if (role !== 'owner') {
		return fail(403, {
			kind: 'mergePeople' as const,
			message: 'Only the workspace owner can merge people.'
		});
	}

	const p_canonical = String(fd.get('p_canonical') ?? '').trim();
	const p_merged_away = String(fd.get('p_merged_away') ?? '').trim();
	const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	if (!uuidRe.test(p_canonical) || !uuidRe.test(p_merged_away)) {
		return fail(400, {
			kind: 'mergePeople' as const,
			message: 'Choose two valid people to merge.'
		});
	}
	if (p_canonical === p_merged_away) {
		return fail(400, {
			kind: 'mergePeople' as const,
			message: 'Cannot merge a person into themselves.'
		});
	}

	const { error: rpcErr } = await supabase.rpc('library_merge_people', {
		p_canonical,
		p_merged_away
	});
	if (rpcErr) {
		console.error(rpcErr);
		const msg = rpcErr.message ?? 'Merge failed.';
		if (
			msg.includes('merge requires owner role') ||
			msg.includes('42501') ||
			rpcErr.code === '42501'
		) {
			return fail(403, { kind: 'mergePeople' as const, message: 'Only the workspace owner can merge people.' });
		}
		return fail(400, { kind: 'mergePeople' as const, message: msg });
	}

	return {
		kind: 'mergePeople' as const,
		success: true as const,
		canonicalId: p_canonical,
		mergedAwayId: p_merged_away
	};
}
