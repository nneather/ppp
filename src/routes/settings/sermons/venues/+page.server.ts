import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loadSermonVenues } from '$lib/sermons/server/loaders';
import {
	createVenueAction,
	softDeleteVenueAction,
	updateVenueAction
} from '$lib/sermons/server/actions';

export const load: PageServerLoad = async ({ locals, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:sermons:venues');

	const supabase = locals.supabase;
	const { data: profile, error: profileErr } = await supabase
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.maybeSingle();

	if (profileErr) console.error('[sermons venues] profile', profileErr);
	const isOwner = profile?.role === 'owner';
	if (!isOwner) {
		return {
			notOwner: true as const,
			venues: [],
			loadError: null as string | null
		};
	}

	const { venues, error } = await loadSermonVenues(supabase);
	return {
		notOwner: false as const,
		venues,
		loadError: error
	};
};

export const actions: Actions = {
	createVenue: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createVenue' as const, message: 'Unauthorized' });
		return createVenueAction(locals.supabase, user.id, await request.formData());
	},
	updateVenue: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateVenue' as const, message: 'Unauthorized' });
		return updateVenueAction(locals.supabase, await request.formData());
	},
	softDeleteVenue: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'softDeleteVenue' as const, message: 'Unauthorized' });
		return softDeleteVenueAction(locals.supabase, await request.formData());
	}
};
