import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { authorLabelsForRefs, loadResourceSetDetail, searchBooksToAdd } from '$lib/studies/server/resource-set-loaders';
import {
	markSetReviewedAction,
	removeSetMemberAction,
	restoreSetMemberAction,
	setMemberBibliographicalAction
} from '$lib/studies/server/resource-set-actions';

export const load: PageServerLoad = async ({ locals, params, url, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	depends('app:studies:sets');

	const supabase = locals.supabase;
	const q = url.searchParams.get('q')?.trim() ?? '';
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
	const needle = q.replace(/[%_\\]/g, '').trim();
	let addHits: {
		id: string;
		title: string;
		authors: string | null;
		bookIds: string[];
		seriesAbbreviation: string | null;
		volumeCount: number;
		included: boolean;
	}[] = [];
	if (isOwner && needle && detail.set) {
		const groups = await searchBooksToAdd(supabase, needle);
		const labels = await authorLabelsForRefs(
			supabase,
			groups.map((group) => ({ bookId: group.id, essayId: null }))
		);
		const inSet = new Set(
			detail.set.included.flatMap((member) =>
				member.volumeBookIds.length > 0 ? member.volumeBookIds : member.bookId ? [member.bookId] : []
			)
		);
		addHits = groups.map((group) => ({
			...group,
			authors: labels.get(`b:${group.id}`) ?? null,
			included: group.bookIds.every((id) => inSet.has(id))
		}));
	}
	return { set: detail.set, isOwner, loadError: detail.error, addQuery: needle, addHits };
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
	},
	addMember: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'restoreSetMember' as const, message: 'Unauthorized' });
		return restoreSetMemberAction(locals.supabase, user.id, await request.formData());
	},
	setBibliographical: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'setBibliographical' as const, message: 'Unauthorized' });
		return setMemberBibliographicalAction(locals.supabase, user.id, await request.formData());
	}
};
