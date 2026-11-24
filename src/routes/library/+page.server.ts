import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	countLiveBooks,
	loadBookListFiltered,
	loadEssaySearchHits
} from '$lib/library/server/loaders';
import {
	createPersonAction,
	softDeleteBookAction,
	undoSoftDeleteBookAction,
	updateReadingStatusAction,
	bulkUpdateBooksAction
} from '$lib/library/server/book-actions';
import { checkoutBookAction } from '$lib/library/server/loan-actions';
import { bookListFiltersAreDefault, parseBookListFilters } from '$lib/library/server/url-params';
import { LIBRARY_PAGE_SIZE } from '$lib/types/library';

export const load: PageServerLoad = async ({ locals, url, parent, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:library:list');

	const supabase = locals.supabase;
	const filters = parseBookListFilters(url);
	const recentlyDeletedId = url.searchParams.get('deleted');

	const { series, bibleBookNames } = await parent();

	const ownerPromise = supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
	const listPromise = locals.perf.measure('db', () =>
		loadBookListFiltered(supabase, [], filters, {
			limit: filters.all === true ? undefined : LIBRARY_PAGE_SIZE,
			offset: 0
		})
	);
	const corpusPromise = bookListFiltersAreDefault(filters)
		? Promise.resolve(null)
		: locals.perf.measure('db', () =>
				countLiveBooks(supabase, { includeUnowned: filters.includeUnowned === true })
			);
	const essayHitsPromise =
		filters.q && filters.q.trim().length > 0
			? locals.perf.measure('db', () =>
					loadEssaySearchHits(supabase, filters.q!, {
						includeUnowned: filters.includeUnowned === true
					})
				)
			: Promise.resolve([]);

	const [{ books, filteredCount }, corpusTotal, essayHits, ownerRes] = await Promise.all([
		listPromise,
		corpusPromise,
		essayHitsPromise,
		ownerPromise
	]);
	const totalCount = corpusTotal ?? filteredCount;

	return {
		books,
		filteredCount,
		essayHits,
		pageSize: LIBRARY_PAGE_SIZE,
		series,
		bibleBookNames,
		recentlyDeletedId,
		filters,
		totalCount,
		isOwner: ownerRes.data?.role === 'owner'
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
	checkoutBook: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'checkoutBook' as const, message: 'Unauthorized' });
		return checkoutBookAction(locals.supabase, user.id, await request.formData());
	},
	bulkUpdateBooks: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'bulkUpdateBooks' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return bulkUpdateBooksAction(locals.supabase, user.id, fd);
	}
};
