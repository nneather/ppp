import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	countBooksNeedingReview,
	countReviewQueueBySlice
} from '$lib/library/server/loaders';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;

	const [unbilledRes, libraryNeedsReview, criticalRemaining, backlogRemaining] =
		await Promise.all([
			supabase
				.from('time_entries')
				.select('id', { count: 'exact', head: true })
				.is('invoice_id', null)
				.is('deleted_at', null),
			countBooksNeedingReview(supabase),
			countReviewQueueBySlice(supabase, 'critical'),
			countReviewQueueBySlice(supabase, 'backlog')
		]);

	if (unbilledRes.error) {
		console.error(unbilledRes.error);
		return {
			unbilledCount: null as number | null,
			libraryNeedsReviewCount: libraryNeedsReview,
			libraryCriticalRemaining: criticalRemaining,
			libraryBacklogRemaining: backlogRemaining,
			dashboardError: 'Could not load unbilled count.' as string | null
		};
	}

	return {
		unbilledCount: unbilledRes.count ?? 0,
		libraryNeedsReviewCount: libraryNeedsReview,
		libraryCriticalRemaining: criticalRemaining,
		libraryBacklogRemaining: backlogRemaining,
		dashboardError: null as string | null
	};
};
