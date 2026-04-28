import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	loadCategories,
	loadPeople,
	loadPersonBookCounts,
	loadSeries
} from '$lib/library/server/loaders';
import {
	createBookAction,
	createPersonAction
} from '$lib/library/server/book-actions';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;

	const [people, categories, series, personBookCounts] = await Promise.all([
		loadPeople(supabase),
		loadCategories(supabase),
		loadSeries(supabase),
		loadPersonBookCounts(supabase)
	]);

	return {
		people,
		categories,
		series,
		personBookCounts: Object.fromEntries(personBookCounts)
	};
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
	}
};
