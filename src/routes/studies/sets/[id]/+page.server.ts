import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loadResourceSetDetail } from '$lib/studies/server/resource-set-loaders';
import {
	markSetReviewedAction,
	removeSetMemberAction,
	restoreSetMemberAction
} from '$lib/studies/server/resource-set-actions';

export const load: PageServerLoad = async ({ locals, params, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	depends('app:studies:sets');

	const supabase = locals.supabase;
	const [detail, profileRes] = await Promise.all([
		loadResourceSetDetail(supabase, params.id),
		supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
	]);
	if (detail.error) {
		console.error('[studies] set detail', detail.error);
	}
	if (!detail.set) error(404, 'Resource set not found');
	if (profileRes.error) console.error('[studies] profile', profileRes.error);
	const isOwner = ((profileRes.data?.role as string | null) ?? null) === 'owner';
	return { set: detail.set, isOwner, loadError: detail.error };
};

export const actions: Actions = {
	markReviewed: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'markSetReviewed' as const, message: 'Unauthorized' });
		return markSetReviewedAction(locals.supabase, await request.formData());
	},
	removeMember: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'removeSetMember' as const, message: 'Unauthorized' });
		return removeSetMemberAction(locals.supabase, user.id, await request.formData());
	},
	restoreMember: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'restoreSetMember' as const, message: 'Unauthorized' });
		return restoreSetMemberAction(locals.supabase, user.id, await request.formData());
	}
};
