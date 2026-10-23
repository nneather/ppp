import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	setCommentaryRatingAction,
	setCommentaryShelfAction
} from '$lib/sermons/server/commentary-shelf-actions';
import { loadByBookStats, parseByBookListFilters } from '$lib/sermons/server/loaders';

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:sermons:by-book');

	const filters = parseByBookListFilters(url);
	const [result, profileRes] = await Promise.all([
		loadByBookStats(locals.supabase, filters),
		locals.supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
	]);
	if (profileRes.error) console.error('[sermons] by-book profile', profileRes.error);

	return {
		rows: result.rows,
		summary: result.summary,
		filters: result.filters,
		loadError: result.error,
		isOwner: ((profileRes.data?.role as string | null) ?? null) === 'owner'
	};
};

export const actions: Actions = {
	setCommentaryRating: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'setCommentaryRating' as const, message: 'Unauthorized' });
		return setCommentaryRatingAction(locals.supabase, user.id, await request.formData());
	},
	setCommentaryShelf: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'setCommentaryShelf' as const, message: 'Unauthorized' });
		return setCommentaryShelfAction(locals.supabase, user.id, await request.formData());
	}
};
