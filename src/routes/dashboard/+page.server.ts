import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	countBooksNeedingReview,
	countReviewQueueBySlice
} from '$lib/library/server/loaders';
import { ymdInChicago, mondaySundayWeekContainingYmd } from '$lib/invoicing/chicago-date';
import { loadProjectTree, loadLatestHealth } from '$lib/projects/server/loaders';
import type { LatestHealth } from '$lib/types/projects';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;
	const thisMonday = mondaySundayWeekContainingYmd(ymdInChicago()).start;

	const [
		unbilledRes,
		libraryNeedsReview,
		criticalRemaining,
		backlogRemaining,
		projectTree,
		latestHealthMap
	] = await Promise.all([
		supabase
			.from('time_entries')
			.select('id', { count: 'exact', head: true })
			.is('invoice_id', null)
			.is('deleted_at', null)
			.lt('date', thisMonday),
		countBooksNeedingReview(supabase),
		countReviewQueueBySlice(supabase, 'critical'),
		countReviewQueueBySlice(supabase, 'backlog'),
		locals.perf.measure('db', () => loadProjectTree(supabase)),
		locals.perf.measure('db', () => loadLatestHealth(supabase))
	]);

	const latestHealth = Object.fromEntries(latestHealthMap) as Record<string, LatestHealth>;

	if (unbilledRes.error) {
		console.error(unbilledRes.error);
		return {
			unbilledPriorCount: null as number | null,
			libraryNeedsReviewCount: libraryNeedsReview,
			libraryCriticalRemaining: criticalRemaining,
			libraryBacklogRemaining: backlogRemaining,
			projectTree,
			latestHealth,
			dashboardError: 'Could not load unbilled count.' as string | null
		};
	}

	return {
		unbilledPriorCount: unbilledRes.count ?? 0,
		libraryNeedsReviewCount: libraryNeedsReview,
		libraryCriticalRemaining: criticalRemaining,
		libraryBacklogRemaining: backlogRemaining,
		projectTree,
		latestHealth,
		dashboardError: null as string | null
	};
};
