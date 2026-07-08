import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	countReviewDecks,
	countReviewQueue,
	loadPeople,
	loadPublishers,
	loadReviewQueue,
	loadScriptureRefsNeedingReview
} from '$lib/library/server/loaders';
import { SLICE_DENOMINATORS } from '$lib/library/turabian';
import { defaultReviewSlice } from '$lib/library/turabian/review-progress';
import type { ReviewSlice } from '$lib/types/library';
import {
	reviewSaveAction,
	undoReviewSaveAction,
	markNeedsShelfAction,
	softDeleteBookAction
} from '$lib/library/server/book-actions';
import { resolveProposalAction } from '$lib/library/server/proposal-actions';
import { parseReviewFilters, withReviewShelfDefault } from '$lib/library/review';
import { hasReviewDeckParams, sliceForReviewFilters } from '$lib/library/review-decks';

const QUEUE_PAGE_SIZE = 10;

export const load: PageServerLoad = async ({ locals, url, parent, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:library:review');

	const supabase = locals.supabase;
	let filters = parseReviewFilters(url);
	if (!hasReviewDeckParams(url)) {
		const defaultSlice = defaultReviewSlice();
		filters = { ...filters, slice: defaultSlice };
	}
	filters = withReviewShelfDefault(filters);

	const activeSlice: ReviewSlice = sliceForReviewFilters(filters);

	const people = await loadPeople(supabase);
	const [cards, remaining, scriptureRefsNeedingReview, deckCounts, publishers] =
		await Promise.all([
			loadReviewQueue(supabase, people, filters, {
				limit: QUEUE_PAGE_SIZE,
				excludeIds: [],
				shufflePivot: filters.shuffle ? crypto.randomUUID() : null
			}),
			countReviewQueue(supabase, filters),
			loadScriptureRefsNeedingReview(supabase, { limit: 50 }),
			countReviewDecks(supabase),
			loadPublishers(supabase)
		]);

	const sliceDenominator = SLICE_DENOMINATORS[activeSlice];

	return {
		cards,
		remaining,
		filters,
		activeSlice,
		sliceDenominator,
		deckCounts,
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
	markNeedsShelf: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'markedNeedsShelf' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return markNeedsShelfAction(locals.supabase, fd);
	},
	undoReviewSave: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'reviewUndone' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return undoReviewSaveAction(locals.supabase, fd);
	},
	softDeleteBook: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'softDeleteBook' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return softDeleteBookAction(locals.supabase, fd);
	},
	resolveProposal: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'proposalResolved' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return resolveProposalAction(locals.supabase, fd);
	}
};
