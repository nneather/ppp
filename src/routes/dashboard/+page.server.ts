import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	countBooksNeedingReview,
	countReviewQueueBySlice
} from '$lib/library/server/loaders';
import { loadProjectTree, loadLatestHealth } from '$lib/projects/server/loaders';
import { countAttentionNodes, countActiveProjects } from '$lib/projects/filter';
import type { LatestHealth } from '$lib/types/projects';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;

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
			.is('deleted_at', null),
		countBooksNeedingReview(supabase),
		countReviewQueueBySlice(supabase, 'critical'),
		countReviewQueueBySlice(supabase, 'backlog'),
		locals.perf.measure('db', () => loadProjectTree(supabase)),
		locals.perf.measure('db', () => loadLatestHealth(supabase))
	]);

	const latestHealth = Object.fromEntries(latestHealthMap) as Record<string, LatestHealth>;
	const attentionCount = countAttentionNodes(latestHealthMap);
	const activeProjectCount = countActiveProjects(projectTree);

	if (unbilledRes.error) {
		console.error(unbilledRes.error);
		return {
			unbilledCount: null as number | null,
			libraryNeedsReviewCount: libraryNeedsReview,
			libraryCriticalRemaining: criticalRemaining,
			libraryBacklogRemaining: backlogRemaining,
			projectTree,
			latestHealth,
			attentionCount,
			activeProjectCount,
			dashboardError: 'Could not load unbilled count.' as string | null
		};
	}

	return {
		unbilledCount: unbilledRes.count ?? 0,
		libraryNeedsReviewCount: libraryNeedsReview,
		libraryCriticalRemaining: criticalRemaining,
		libraryBacklogRemaining: backlogRemaining,
		projectTree,
		latestHealth,
		attentionCount,
		activeProjectCount,
		dashboardError: null as string | null
	};
};
