import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { AncientTextRow } from '$lib/types/library';
import { fetchCoverageCountsByAncientTextId } from '$lib/library/server/ancient-texts-settings-book-counts';
import {
	createAncientTextSettingsAction,
	mergeAncientTextsSettingsAction,
	softDeleteAncientTextSettingsAction,
	updateAncientTextSettingsAction
} from '$lib/library/server/ancient-texts-settings-actions';

export type AncientTextsSettingsListRow = AncientTextRow & {
	coverage_count: number;
};

export const load: PageServerLoad = async ({ locals, depends, parent }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const { isOwner } = await parent();

	depends('app:library:ancient_texts');

	const supabase = locals.supabase;
	const { data: rowsRaw, error: rowsErr } = await supabase
		.from('ancient_texts')
		.select('id, canonical_name, abbreviations, category')
		.is('deleted_at', null)
		.order('canonical_name', { ascending: true });

	if (rowsErr) {
		console.error(rowsErr);
		return {
			isOwner,
			rows: [] as AncientTextsSettingsListRow[],
			loadError: 'Could not load ancient texts.',
			coverageCountError: null as string | null
		};
	}

	const raw = (rowsRaw ?? []) as AncientTextRow[];
	const ids = raw.map((r) => r.id);
	const { map: covMap, error: coverageCountError } = await fetchCoverageCountsByAncientTextId(
		supabase,
		ids
	);

	const rows: AncientTextsSettingsListRow[] = raw.map((r) => ({
		...r,
		abbreviations: Array.isArray(r.abbreviations) ? r.abbreviations : [],
		coverage_count: covMap.get(r.id) ?? 0
	}));

	return {
		isOwner,
		rows,
		loadError: null as string | null,
		coverageCountError
	};
};

export const actions: Actions = {
	createAncientText: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'createAncientText' as const, message: 'Unauthorized' });
		return createAncientTextSettingsAction(locals.supabase, user.id, await request.formData());
	},
	updateAncientText: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'updateAncientText' as const, ancientTextId: '', message: 'Unauthorized' });
		return updateAncientTextSettingsAction(locals.supabase, user.id, await request.formData());
	},
	softDeleteAncientText: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, {
				kind: 'softDeleteAncientText' as const,
				ancientTextId: '',
				message: 'Unauthorized'
			});
		return softDeleteAncientTextSettingsAction(locals.supabase, user.id, await request.formData());
	},
	mergeAncientTexts: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'mergeAncientTexts' as const, message: 'Unauthorized' });
		return mergeAncientTextsSettingsAction(locals.supabase, user.id, await request.formData());
	}
};
