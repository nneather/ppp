import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loadBookFormPageData } from '$lib/library/server/loaders';
import {
	createBookAction,
	createPersonAction
} from '$lib/library/server/book-actions';

export const load: PageServerLoad = async ({ locals, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:library:people');
	depends('app:library:series');

	const supabase = locals.supabase;
	return loadBookFormPageData(supabase);
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
