import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	loadBookList,
	loadCategories,
	loadPeople,
	loadPersonBookCounts,
	loadSeries
} from '$lib/library/server/loaders';
import {
	createBookAction,
	createPersonAction,
	softDeleteBookAction,
	undoSoftDeleteBookAction,
	updateBookAction
} from '$lib/library/server/book-actions';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;

	const [people, categories, series] = await Promise.all([
		loadPeople(supabase),
		loadCategories(supabase),
		loadSeries(supabase)
	]);
	const [books, personBookCounts] = await Promise.all([
		loadBookList(supabase, people),
		loadPersonBookCounts(supabase)
	]);

	const recentlyDeletedId = url.searchParams.get('deleted');

	return {
		books,
		categories,
		series,
		people,
		personBookCounts: Object.fromEntries(personBookCounts),
		recentlyDeletedId
	};
};

export const actions: Actions = {
	createBook: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createBook' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return createBookAction(locals.supabase, user.id, fd);
	},
	updateBook: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateBook' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return updateBookAction(locals.supabase, user.id, fd);
	},
	softDeleteBook: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'softDeleteBook' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return softDeleteBookAction(locals.supabase, fd);
	},
	undoSoftDeleteBook: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'undoSoftDeleteBook' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return undoSoftDeleteBookAction(locals.supabase, fd);
	},
	createPerson: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createPerson' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return createPersonAction(locals.supabase, user.id, fd);
	}
};
