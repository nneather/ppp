import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { SeriesRow } from '$lib/types/library';
import { fetchLiveBookCountsBySeriesId } from '$lib/library/server/series-settings-book-counts';
import {
	softDeleteSeriesSettingsAction,
	updateSeriesSettingsAction
} from '$lib/library/server/series-settings-actions';

export type SeriesSettingsListRow = SeriesRow & {
	book_count: number;
};

export const load: PageServerLoad = async ({ locals, depends, parent }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const { isOwner } = await parent();

	depends('app:library:series');

	const supabase = locals.supabase;
	const { data: seriesRaw, error: seriesErr } = await supabase
		.from('series')
		.select('id, name, abbreviation')
		.is('deleted_at', null)
		.order('name', { ascending: true });

	if (seriesErr) {
		console.error(seriesErr);
		return {
			isOwner,
			series: [] as SeriesSettingsListRow[],
			loadError: 'Could not load series.',
			bookCountError: null as string | null
		};
	}

	const rows = (seriesRaw ?? []) as SeriesRow[];
	const ids = rows.map((s) => s.id);
	const { map: bookCountMap, error: bookCountError } = await fetchLiveBookCountsBySeriesId(
		supabase,
		ids
	);

	const series: SeriesSettingsListRow[] = rows.map((s) => ({
		...s,
		book_count: bookCountMap.get(s.id) ?? 0
	}));

	return {
		isOwner,
		series,
		loadError: null as string | null,
		bookCountError
	};
};

export const actions: Actions = {
	updateSeries: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'updateSeries' as const, seriesId: '', message: 'Unauthorized' });
		return updateSeriesSettingsAction(locals.supabase, user.id, await request.formData());
	},
	softDeleteSeries: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'softDeleteSeries' as const, seriesId: '', message: 'Unauthorized' });
		return softDeleteSeriesSettingsAction(locals.supabase, user.id, await request.formData());
	}
};
