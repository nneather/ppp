import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const { count, error } = await locals.supabase
		.from('time_entries')
		.select('id', { count: 'exact', head: true })
		.is('invoice_id', null)
		.is('deleted_at', null);

	if (error) {
		console.error(error);
		return { unbilledCount: null as number | null, dashboardError: 'Could not load unbilled count.' };
	}

	return { unbilledCount: count ?? 0, dashboardError: null as string | null };
};
