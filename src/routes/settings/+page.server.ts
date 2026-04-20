import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const { count, error } = await locals.supabase
		.from('clients')
		.select('id', { count: 'exact', head: true })
		.is('deleted_at', null);

	if (error) {
		console.error(error);
		return {
			userEmail: user.email ?? '',
			clientCount: null as number | null,
			settingsHubError: 'Could not load client count.'
		};
	}

	return {
		userEmail: user.email ?? '',
		clientCount: count ?? 0,
		settingsHubError: null as string | null
	};
};
