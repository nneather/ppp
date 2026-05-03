import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

import { loadProfileRole } from '$lib/library/server/people-settings-actions';

export type AncientTextsSettingsActionKind =
	| 'createAncientText'
	| 'updateAncientText'
	| 'softDeleteAncientText'
	| 'mergeAncientTexts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trimOrNull(v: FormDataEntryValue | null): string | null {
	if (v === null || v === undefined) return null;
	const t = String(v).trim();
	return t.length > 0 ? t : null;
}

function readAbbreviations(fd: FormData): string[] {
	const raw = fd.getAll('abbreviations').map((x) => String(x).trim()).filter(Boolean);
	return [...new Set(raw)];
}

export async function createAncientTextSettingsAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const role = await loadProfileRole(supabase, userId);
	if (role !== 'owner') {
		return fail(403, {
			kind: 'createAncientText' as const,
			message: 'Only the workspace owner can create ancient texts here.'
		});
	}

	const canonical_name = String(fd.get('canonical_name') ?? '').trim();
	if (!canonical_name) {
		return fail(400, {
			kind: 'createAncientText' as const,
			message: 'Canonical name is required.'
		});
	}
	if (canonical_name.length > 500) {
		return fail(400, {
			kind: 'createAncientText' as const,
			message: 'Canonical name is too long.'
		});
	}

	const abbreviations = readAbbreviations(fd);
	const category = trimOrNull(fd.get('category'));

	const { data: inserted, error: insErr } = await supabase
		.from('ancient_texts')
		.insert({
			canonical_name,
			abbreviations: abbreviations.length > 0 ? abbreviations : null,
			category,
			created_by: userId
		} as never)
		.select('id, canonical_name, abbreviations, category')
		.single();

	if (insErr) {
		console.error(insErr);
		const msg = insErr.message ?? 'Could not create ancient text.';
		if (
			insErr.code === '23505' ||
			msg.includes('ancient_texts_canonical_name') ||
			msg.includes('ancient_texts_canonical_name_live_uq')
		) {
			return fail(400, {
				kind: 'createAncientText' as const,
				message: 'An ancient text with this canonical name already exists.'
			});
		}
		return fail(500, { kind: 'createAncientText' as const, message: msg });
	}

	const row = inserted as {
		id: string;
		canonical_name: string;
		abbreviations: string[] | null;
		category: string | null;
	};

	return {
		kind: 'createAncientText' as const,
		success: true as const,
		ancientTextId: row.id,
		ancientText: {
			id: row.id,
			canonical_name: row.canonical_name,
			abbreviations: Array.isArray(row.abbreviations) ? row.abbreviations : [],
			category: row.category
		}
	};
}

export async function updateAncientTextSettingsAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const role = await loadProfileRole(supabase, userId);
	if (role !== 'owner') {
		return fail(403, {
			kind: 'updateAncientText' as const,
			ancientTextId: '',
			message: 'Only the workspace owner can edit ancient texts here.'
		});
	}

	const id = String(fd.get('id') ?? '').trim();
	if (!id || !UUID_RE.test(id)) {
		return fail(400, {
			kind: 'updateAncientText' as const,
			ancientTextId: id,
			message: 'Invalid ancient text id.'
		});
	}

	const canonical_name = String(fd.get('canonical_name') ?? '').trim();
	if (!canonical_name) {
		return fail(400, {
			kind: 'updateAncientText' as const,
			ancientTextId: id,
			message: 'Canonical name is required.'
		});
	}

	const abbreviations = readAbbreviations(fd);
	const category = trimOrNull(fd.get('category'));

	const { data: existing, error: exErr } = await supabase
		.from('ancient_texts')
		.select('id')
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();
	if (exErr) {
		console.error(exErr);
		return fail(500, {
			kind: 'updateAncientText' as const,
			ancientTextId: id,
			message: exErr.message ?? 'Could not load ancient text.'
		});
	}
	if (!existing) {
		return fail(404, {
			kind: 'updateAncientText' as const,
			ancientTextId: id,
			message: 'Ancient text not found.'
		});
	}

	const { error: updErr } = await supabase
		.from('ancient_texts')
		.update({
			canonical_name,
			abbreviations: abbreviations.length > 0 ? abbreviations : null,
			category
		} as never)
		.eq('id', id);
	if (updErr) {
		console.error(updErr);
		const msg = updErr.message ?? 'Could not update ancient text.';
		if (
			updErr.code === '23505' ||
			msg.includes('ancient_texts_canonical_name') ||
			msg.includes('ancient_texts_canonical_name_live_uq')
		) {
			return fail(400, {
				kind: 'updateAncientText' as const,
				ancientTextId: id,
				message: 'Another ancient text already uses this canonical name.'
			});
		}
		return fail(500, {
			kind: 'updateAncientText' as const,
			ancientTextId: id,
			message: msg
		});
	}

	return { kind: 'updateAncientText' as const, ancientTextId: id, success: true as const };
}

export async function softDeleteAncientTextSettingsAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const role = await loadProfileRole(supabase, userId);
	if (role !== 'owner') {
		return fail(403, {
			kind: 'softDeleteAncientText' as const,
			ancientTextId: '',
			message: 'Only the workspace owner can remove ancient texts here.'
		});
	}

	const id = String(fd.get('id') ?? '').trim();
	if (!id || !UUID_RE.test(id)) {
		return fail(400, {
			kind: 'softDeleteAncientText' as const,
			ancientTextId: id,
			message: 'Invalid ancient text id.'
		});
	}

	const { data: existing, error: exErr } = await supabase
		.from('ancient_texts')
		.select('id')
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();
	if (exErr) {
		console.error(exErr);
		return fail(500, {
			kind: 'softDeleteAncientText' as const,
			ancientTextId: id,
			message: exErr.message ?? 'Could not load ancient text.'
		});
	}
	if (!existing) {
		return fail(404, {
			kind: 'softDeleteAncientText' as const,
			ancientTextId: id,
			message: 'Ancient text not found.'
		});
	}

	const { count, error: cntErr } = await supabase
		.from('book_ancient_coverage')
		.select('id', { count: 'exact', head: true })
		.eq('ancient_text_id', id);
	if (cntErr) {
		console.error(cntErr);
		return fail(500, {
			kind: 'softDeleteAncientText' as const,
			ancientTextId: id,
			message: cntErr.message ?? 'Could not count coverage rows.'
		});
	}
	const n = count ?? 0;
	if (n > 0) {
		return fail(400, {
			kind: 'softDeleteAncientText' as const,
			ancientTextId: id,
			message: `This ancient text is still tagged on ${n} book(s) or essay(s). Remove coverage before deleting.`
		});
	}

	const { error: updErr } = await supabase
		.from('ancient_texts')
		.update({
			deleted_at: new Date().toISOString(),
			merged_into_id: null
		} as never)
		.eq('id', id);
	if (updErr) {
		console.error(updErr);
		return fail(500, {
			kind: 'softDeleteAncientText' as const,
			ancientTextId: id,
			message: updErr.message ?? 'Could not remove ancient text.'
		});
	}

	return { kind: 'softDeleteAncientText' as const, ancientTextId: id, success: true as const };
}

export async function mergeAncientTextsSettingsAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const role = await loadProfileRole(supabase, userId);
	if (role !== 'owner') {
		return fail(403, {
			kind: 'mergeAncientTexts' as const,
			message: 'Only the workspace owner can merge ancient texts.'
		});
	}

	const p_canonical = String(fd.get('p_canonical') ?? '').trim();
	const p_merged_away = String(fd.get('p_merged_away') ?? '').trim();
	if (!UUID_RE.test(p_canonical) || !UUID_RE.test(p_merged_away)) {
		return fail(400, {
			kind: 'mergeAncientTexts' as const,
			message: 'Choose two valid ancient texts to merge.'
		});
	}
	if (p_canonical === p_merged_away) {
		return fail(400, {
			kind: 'mergeAncientTexts' as const,
			message: 'Cannot merge an ancient text into itself.'
		});
	}

	const { error: rpcErr } = await supabase.rpc('library_merge_ancient_texts', {
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
				kind: 'mergeAncientTexts' as const,
				message: 'Only the workspace owner can merge ancient texts.'
			});
		}
		return fail(400, { kind: 'mergeAncientTexts' as const, message: msg });
	}

	return {
		kind: 'mergeAncientTexts' as const,
		success: true as const,
		canonicalId: p_canonical,
		mergedAwayId: p_merged_away
	};
}
