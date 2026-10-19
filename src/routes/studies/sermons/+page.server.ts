import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loadSermonVenues, loadSermons, parseSermonListFilters } from '$lib/sermons/server/loaders';
import {
	createSermonAction,
	createVenueAction,
	softDeleteSermonAction,
	updateSermonAction
} from '$lib/sermons/server/actions';

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:sermons:list');

	const filters = parseSermonListFilters(url);
	const supabase = locals.supabase;

	const [sermonsRes, venuesRes, profileRes, yearsRes] = await Promise.all([
		loadSermons(supabase, filters),
		loadSermonVenues(supabase),
		supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
		supabase.from('sermons').select('preached_on').is('deleted_at', null)
	]);

	if (profileRes.error) console.error('[sermons] profile', profileRes.error);
	if (yearsRes.error) console.error('[sermons] years', yearsRes.error);
	const role = (profileRes.data?.role as string | null) ?? null;
	const isOwner = role === 'owner';

	const years = [
		...new Set(
			((yearsRes.data ?? []) as { preached_on: string }[]).map((s) =>
				Number.parseInt(s.preached_on.slice(0, 4), 10)
			)
		)
	]
		.filter((y) => Number.isFinite(y))
		.sort((a, b) => b - a);

	return {
		sermons: sermonsRes.sermons,
		venues: venuesRes.venues,
		filters,
		years,
		isOwner,
		loadError: sermonsRes.error ?? venuesRes.error
	};
};

export const actions: Actions = {
	createSermon: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createSermon' as const, message: 'Unauthorized' });
		return createSermonAction(locals.supabase, user.id, await request.formData());
	},
	updateSermon: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateSermon' as const, message: 'Unauthorized' });
		return updateSermonAction(locals.supabase, user.id, await request.formData());
	},
	softDeleteSermon: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'softDeleteSermon' as const, message: 'Unauthorized' });
		return softDeleteSermonAction(locals.supabase, await request.formData());
	},
	createVenue: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createVenue' as const, message: 'Unauthorized' });
		return createVenueAction(locals.supabase, user.id, await request.formData());
	}
};
