import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createResourceSetAction,
	createResourceSetSectionAction
} from '$lib/studies/server/resource-set-actions';
import { loadResourceSetList } from '$lib/studies/server/resource-set-loaders';

export const load: PageServerLoad = async ({ locals, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	depends('app:studies:sets');
	const supabase = locals.supabase;
	const [list, profileRes] = await Promise.all([
		loadResourceSetList(supabase),
		supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
	]);
	if (profileRes.error) console.error('[studies] sets profile', profileRes.error);
	const isOwner = ((profileRes.data?.role as string | null) ?? null) === 'owner';
	return { sections: list.sections, loadError: list.error, isOwner };
};

export const actions: Actions = {
	createSet: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createSet' as const, message: 'Unauthorized' });
		return createResourceSetAction(locals.supabase, user.id, await request.formData());
	},
	createSection: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createSection' as const, message: 'Unauthorized' });
		return createResourceSetSectionAction(locals.supabase, user.id, await request.formData());
	}
};
