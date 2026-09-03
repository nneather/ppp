import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { toggleFollowedAction } from '$lib/sports/server/actions';
import { loadSportsPage, parseSportsLeagueParam } from '$lib/sports/server/loaders';

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:sports:list');

	const league = parseSportsLeagueParam(url.searchParams.get('league'));
	const supabase = locals.supabase;

	const profileRes = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
	if (profileRes.error) console.error('[sports] profile', profileRes.error);
	const isOwner = (profileRes.data?.role as string | null) === 'owner';

	return loadSportsPage(supabase, { league, isOwner });
};

export const actions: Actions = {
	toggleFollowed: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'toggleFollowed' as const, message: 'Unauthorized' });

		const profileRes = await locals.supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.maybeSingle();
		if ((profileRes.data?.role as string | null) !== 'owner') {
			return fail(403, { kind: 'toggleFollowed' as const, message: 'Owner only.' });
		}

		return toggleFollowedAction(locals.supabase, await request.formData());
	}
};
