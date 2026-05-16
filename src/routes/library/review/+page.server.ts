import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	countReviewQueue,
	loadReviewQueue,
	loadScriptureRefsNeedingReview
} from '$lib/library/server/loaders';
import {
	reviewSaveAction,
	softDeleteBookAction
} from '$lib/library/server/book-actions';
import { parseReviewFilters } from '$lib/library/review';

const QUEUE_PAGE_SIZE = 10;

export const load: PageServerLoad = async ({ locals, url, parent }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;
	const filters = parseReviewFilters(url);

	const { people } = await parent();
	const [cards, remaining, scriptureRefsNeedingReview] = await Promise.all([
		loadReviewQueue(supabase, people, filters, {
			limit: QUEUE_PAGE_SIZE,
			excludeIds: []
		}),
		countReviewQueue(supabase, filters),
		loadScriptureRefsNeedingReview(supabase, { limit: 50 })
	]);

	return {
		cards,
		remaining,
		filters,
		queuePageSize: QUEUE_PAGE_SIZE,
		scriptureRefsNeedingReview
	};
};

export const actions: Actions = {
	saveReviewed: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'reviewSaved' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return reviewSaveAction(locals.supabase, user.id, fd);
	},
	softDeleteBook: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'softDeleteBook' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return softDeleteBookAction(locals.supabase, fd);
	}
};
