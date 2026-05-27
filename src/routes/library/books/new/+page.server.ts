import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loadBookFormPageData, loadPeople } from '$lib/library/server/loaders';
import {
	createBookAction,
	createPersonAction
} from '$lib/library/server/book-actions';
import { createSeriesSettingsAction } from '$lib/library/server/series-settings-actions';

export const load: PageServerLoad = async ({ locals, depends, parent }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:library:people');
	depends('app:library:series');

	const supabase = locals.supabase;
	const { series } = await parent();
	const people = await loadPeople(supabase);
	return loadBookFormPageData(supabase, { people, series });
};

export const actions: Actions = {
	createBook: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createBook' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return createBookAction(locals.supabase, user.id, fd);
	},
	createPerson: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createPerson' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return createPersonAction(locals.supabase, user.id, fd);
	},
	createSeries: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createSeries' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return createSeriesSettingsAction(locals.supabase, user.id, fd);
	}
};
