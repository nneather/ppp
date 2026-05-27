import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loadBookListFiltered } from '$lib/library/server/loaders';
import {
	createPersonAction,
	softDeleteBookAction,
	undoSoftDeleteBookAction,
	updateReadingStatusAction,
	bulkUpdateBooksAction
} from '$lib/library/server/book-actions';
import { parseBookListFilters } from '$lib/library/server/url-params';
import { LIBRARY_PAGE_SIZE } from '$lib/types/library';

export const load: PageServerLoad = async ({ locals, url, parent, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:library:list');

	const supabase = locals.supabase;
	const filters = parseBookListFilters(url);
	const recentlyDeletedId = url.searchParams.get('deleted');

	const { series, bibleBookNames, totalCount } = await parent();

	const { books, filteredCount } = await loadBookListFiltered(supabase, [], filters, {
		limit: filters.all === true ? undefined : LIBRARY_PAGE_SIZE,
		offset: 0
	});

	return {
		books,
		filteredCount,
		pageSize: LIBRARY_PAGE_SIZE,
		series,
		bibleBookNames,
		recentlyDeletedId,
		filters,
		totalCount
	};
};

export const actions: Actions = {
	softDeleteBook: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'softDeleteBook' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return softDeleteBookAction(locals.supabase, fd);
	},
	undoSoftDeleteBook: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'undoSoftDeleteBook' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return undoSoftDeleteBookAction(locals.supabase, fd);
	},
	createPerson: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createPerson' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return createPersonAction(locals.supabase, user.id, fd);
	},
	updateReadingStatus: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateReadingStatus' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return updateReadingStatusAction(locals.supabase, fd);
	},
	bulkUpdateBooks: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'bulkUpdateBooks' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return bulkUpdateBooksAction(locals.supabase, user.id, fd);
	}
};
