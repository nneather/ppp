import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

import { loadProfileRole } from '$lib/library/server/people-settings-actions';
import { fetchLiveBookIdsByPublisherId } from '$lib/library/server/publishers-settings-book-counts';
import { normalizePublisherLocationOrNull } from '$lib/library/publisher-location';

export type PublishersSettingsActionKind =
	| 'createPublisher'
	| 'updatePublisher'
	| 'softDeletePublisher'
	| 'mergePublishers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trimOrNull(v: FormDataEntryValue | null): string | null {
	if (v === null || v === undefined) return null;
	const t = String(v).trim();
	return t.length > 0 ? t : null;
}

function readAliases(fd: FormData): string[] {
	const raw = fd.getAll('aliases').map((x) => String(x).trim()).filter(Boolean);
	return [...new Set(raw)];
}

function parseParentId(fd: FormData): string | null {
	const raw = trimOrNull(fd.get('parent_id'));
	if (!raw) return null;
	return UUID_RE.test(raw) ? raw : null;
}

export async function createPublisherSettingsAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const role = await loadProfileRole(supabase, userId);
	if (role !== 'owner') {
		return fail(403, {
			kind: 'createPublisher' as const,
			message: 'Only the workspace owner can create publishers here.'
		});
	}

	const canonical_name = String(fd.get('canonical_name') ?? '').trim();
	if (!canonical_name) {
		return fail(400, {
			kind: 'createPublisher' as const,
			message: 'Canonical name is required.'
		});
	}
	if (canonical_name.length > 300) {
		return fail(400, {
			kind: 'createPublisher' as const,
			message: 'Canonical name is too long.'
		});
	}

	const default_location = normalizePublisherLocationOrNull(trimOrNull(fd.get('default_location')));
	const aliases = readAliases(fd);
	const notes = trimOrNull(fd.get('notes'));
	const parent_id = parseParentId(fd);

	const { data: inserted, error: insErr } = await supabase
		.from('publishers')
		.insert({
			canonical_name,
			parent_id,
			default_location,
			aliases,
			notes,
			created_by: userId
		} as never)
		.select('id, canonical_name, parent_id, default_location, aliases, notes')
		.single();

	if (insErr) {
		console.error(insErr);
		const msg = insErr.message ?? 'Could not create publisher.';
		if (insErr.code === '23505' || msg.includes('publishers_canonical_name_live_uq')) {
			return fail(400, {
				kind: 'createPublisher' as const,
				message: 'A publisher with this canonical name already exists.'
			});
		}
		return fail(500, { kind: 'createPublisher' as const, message: msg });
	}

	const row = inserted as {
		id: string;
		canonical_name: string;
		parent_id: string | null;
		default_location: string | null;
		aliases: string[] | null;
		notes: string | null;
	};

	return {
		kind: 'createPublisher' as const,
		success: true as const,
		publisherId: row.id,
		publisher: {
			id: row.id,
			canonical_name: row.canonical_name,
			parent_id: row.parent_id,
			default_location: row.default_location,
			aliases: Array.isArray(row.aliases) ? row.aliases : [],
			notes: row.notes
		}
	};
}

export async function updatePublisherSettingsAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const role = await loadProfileRole(supabase, userId);
	if (role !== 'owner') {
		return fail(403, {
			kind: 'updatePublisher' as const,
			publisherId: '',
			message: 'Only the workspace owner can edit publishers here.'
		});
	}

	const id = String(fd.get('id') ?? '').trim();
	if (!id || !UUID_RE.test(id)) {
		return fail(400, {
			kind: 'updatePublisher' as const,
			publisherId: id,
			message: 'Invalid publisher id.'
		});
	}

	const canonical_name = String(fd.get('canonical_name') ?? '').trim();
	if (!canonical_name) {
		return fail(400, {
			kind: 'updatePublisher' as const,
			publisherId: id,
			message: 'Canonical name is required.'
		});
	}

	const default_location = normalizePublisherLocationOrNull(trimOrNull(fd.get('default_location')));
	const aliases = readAliases(fd);
	const notes = trimOrNull(fd.get('notes'));
	const parent_id = parseParentId(fd);

	if (parent_id === id) {
		return fail(400, {
			kind: 'updatePublisher' as const,
			publisherId: id,
			message: 'A publisher cannot be its own parent.'
		});
	}

	const { data: existing, error: exErr } = await supabase
		.from('publishers')
		.select('id')
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();
	if (exErr) {
		console.error(exErr);
		return fail(500, {
			kind: 'updatePublisher' as const,
			publisherId: id,
			message: exErr.message ?? 'Could not load publisher.'
		});
	}
	if (!existing) {
		return fail(404, {
			kind: 'updatePublisher' as const,
			publisherId: id,
			message: 'Publisher not found.'
		});
	}

	const { error: updErr } = await supabase
		.from('publishers')
		.update({
			canonical_name,
			parent_id,
			default_location,
			aliases,
			notes
		} as never)
		.eq('id', id);
	if (updErr) {
		console.error(updErr);
		const msg = updErr.message ?? 'Could not update publisher.';
		if (updErr.code === '23505' || msg.includes('publishers_canonical_name_live_uq')) {
			return fail(400, {
				kind: 'updatePublisher' as const,
				publisherId: id,
				message: 'Another publisher already uses this canonical name.'
			});
		}
		return fail(500, {
			kind: 'updatePublisher' as const,
			publisherId: id,
			message: msg
		});
	}

	return { kind: 'updatePublisher' as const, publisherId: id, success: true as const };
}

export async function softDeletePublisherSettingsAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const role = await loadProfileRole(supabase, userId);
	if (role !== 'owner') {
		return fail(403, {
			kind: 'softDeletePublisher' as const,
			publisherId: '',
			message: 'Only the workspace owner can remove publishers here.'
		});
	}

	const id = String(fd.get('id') ?? '').trim();
	if (!id || !UUID_RE.test(id)) {
		return fail(400, {
			kind: 'softDeletePublisher' as const,
			publisherId: id,
			message: 'Invalid publisher id.'
		});
	}

	const { data: existing, error: exErr } = await supabase
		.from('publishers')
		.select('id')
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();
	if (exErr) {
		console.error(exErr);
		return fail(500, {
			kind: 'softDeletePublisher' as const,
			publisherId: id,
			message: exErr.message ?? 'Could not load publisher.'
		});
	}
	if (!existing) {
		return fail(404, {
			kind: 'softDeletePublisher' as const,
			publisherId: id,
			message: 'Publisher not found.'
		});
	}

	const { map: bookCounts, error: cntErr } = await fetchLiveBookIdsByPublisherId(supabase, [id]);
	if (cntErr) {
		return fail(500, {
			kind: 'softDeletePublisher' as const,
			publisherId: id,
			message: cntErr
		});
	}
	const n = bookCounts.get(id) ?? 0;
	if (n > 0) {
		return fail(400, {
			kind: 'softDeletePublisher' as const,
			publisherId: id,
			message: `This publisher is still linked on ${n} book(s). Merge into another imprint instead.`
		});
	}

	const { count: childCount, error: childErr } = await supabase
		.from('publishers')
		.select('id', { count: 'exact', head: true })
		.eq('parent_id', id)
		.is('deleted_at', null);
	if (childErr) {
		console.error(childErr);
		return fail(500, {
			kind: 'softDeletePublisher' as const,
			publisherId: id,
			message: childErr.message ?? 'Could not count child imprints.'
		});
	}
	if ((childCount ?? 0) > 0) {
		return fail(400, {
			kind: 'softDeletePublisher' as const,
			publisherId: id,
			message: 'Reassign or merge child imprints before deleting this parent.'
		});
	}

	const { error: updErr } = await supabase
		.from('publishers')
		.update({
			deleted_at: new Date().toISOString(),
			merged_into_id: null
		} as never)
		.eq('id', id);
	if (updErr) {
		console.error(updErr);
		return fail(500, {
			kind: 'softDeletePublisher' as const,
			publisherId: id,
			message: updErr.message ?? 'Could not remove publisher.'
		});
	}

	return { kind: 'softDeletePublisher' as const, publisherId: id, success: true as const };
}

export async function mergePublishersSettingsAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const role = await loadProfileRole(supabase, userId);
	if (role !== 'owner') {
		return fail(403, {
			kind: 'mergePublishers' as const,
			message: 'Only the workspace owner can merge publishers.'
		});
	}

	const p_canonical = String(fd.get('p_canonical') ?? '').trim();
	const p_merged_away = String(fd.get('p_merged_away') ?? '').trim();
	if (!UUID_RE.test(p_canonical) || !UUID_RE.test(p_merged_away)) {
		return fail(400, {
			kind: 'mergePublishers' as const,
			message: 'Choose two valid publishers to merge.'
		});
	}
	if (p_canonical === p_merged_away) {
		return fail(400, {
			kind: 'mergePublishers' as const,
			message: 'Cannot merge a publisher into itself.'
		});
	}

	const { error: rpcErr } = await supabase.rpc('library_merge_publishers', {
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
			return fail(403, {
				kind: 'mergePublishers' as const,
				message: 'Only the workspace owner can merge publishers.'
			});
		}
		return fail(400, { kind: 'mergePublishers' as const, message: msg });
	}

	return {
		kind: 'mergePublishers' as const,
		success: true as const,
		canonicalId: p_canonical,
		mergedAwayId: p_merged_away
	};
}
