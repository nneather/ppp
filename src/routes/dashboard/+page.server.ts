import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { countBooksNeedingReview, countLiveBooksExact } from '$lib/library/server/loaders';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;

	const [unbilledRes, libraryTotal, libraryNeedsReview] = await Promise.all([
		supabase
			.from('time_entries')
			.select('id', { count: 'exact', head: true })
			.is('invoice_id', null)
			.is('deleted_at', null),
		countLiveBooksExact(supabase),
		countBooksNeedingReview(supabase)
	]);

	if (unbilledRes.error) {
		console.error(unbilledRes.error);
		return {
			unbilledCount: null as number | null,
			libraryBookCount: libraryTotal,
			libraryNeedsReviewCount: libraryNeedsReview,
			dashboardError: 'Could not load unbilled count.' as string | null
		};
	}

	return {
		unbilledCount: unbilledRes.count ?? 0,
		libraryBookCount: libraryTotal,
		libraryNeedsReviewCount: libraryNeedsReview,
		dashboardError: null as string | null
	};
};
