import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	countReviewQueue,
	countReviewQueueBySlice,
	loadPublishers,
	loadReviewQueue,
	loadScriptureRefsNeedingReview
} from '$lib/library/server/loaders';
import { SLICE_DENOMINATORS } from '$lib/library/turabian';
import { defaultReviewSlice } from '$lib/library/turabian/review-progress';
import type { ReviewSlice } from '$lib/types/library';
import {
	reviewSaveAction,
	softDeleteBookAction
} from '$lib/library/server/book-actions';
import { parseReviewFilters } from '$lib/library/review';

const QUEUE_PAGE_SIZE = 10;

export const load: PageServerLoad = async ({ locals, url, parent, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:library:review');

	const supabase = locals.supabase;
	let filters = parseReviewFilters(url);
	if (!filters.slice && !url.searchParams.has('subject') && !url.searchParams.has('match_type')) {
		const defaultSlice = defaultReviewSlice();
		filters = { ...filters, slice: defaultSlice };
	}

	const activeSlice: ReviewSlice = filters.slice ?? defaultReviewSlice();

	const { people } = await parent();
	const [cards, remaining, scriptureRefsNeedingReview, criticalRemaining, backlogRemaining, publishers] =
		await Promise.all([
			loadReviewQueue(supabase, people, filters, {
				limit: QUEUE_PAGE_SIZE,
				excludeIds: []
			}),
			countReviewQueue(supabase, filters),
			loadScriptureRefsNeedingReview(supabase, { limit: 50 }),
			countReviewQueueBySlice(supabase, 'critical'),
			countReviewQueueBySlice(supabase, 'backlog'),
			loadPublishers(supabase)
		]);

	const sliceDenominator = SLICE_DENOMINATORS[activeSlice];
	const sliceCleared = Math.max(0, sliceDenominator - remaining);

	return {
		cards,
		remaining,
		filters,
		activeSlice,
		sliceDenominator,
		sliceCleared,
		criticalRemaining,
		backlogRemaining,
		queuePageSize: QUEUE_PAGE_SIZE,
		scriptureRefsNeedingReview,
		publishers
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
