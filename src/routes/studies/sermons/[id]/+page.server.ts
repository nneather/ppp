import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loadSermonById, loadSermonVenues } from '$lib/sermons/server/loaders';
import {
	createVenueAction,
	softDeleteSermonAction,
	updateSermonAction
} from '$lib/sermons/server/actions';
import {
	addPaperSourceAction,
	createNotOwnedSourceAction,
	createPaperGroupAction,
	importPaperSourcesAction,
	removePaperSourceAction,
	renamePaperGroupAction,
	reorderPaperGroupsAction,
	restorePaperSourceAction,
	setPaperSourceGroupAction,
	setPaperSourceUsageAction,
	softDeletePaperGroupAction,
	updatePaperSourceNotesAction
} from '$lib/studies/server/paper-actions';
import { loadStudyWorkspace } from '$lib/studies/server/study-workspace';
import {
	setCommentaryRatingAction,
	setCommentaryShelfAction
} from '$lib/sermons/server/commentary-shelf-actions';
import {
	createResourceSetAction,
	removeSetMemberAction,
	restoreSetMemberAction,
	saveGroupAsSetAction
} from '$lib/studies/server/resource-set-actions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ locals, params, url, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	if (!UUID_RE.test(params.id)) error(404, 'Sermon not found');

	depends(`app:sermons:sermon:${params.id}`);

	const supabase = locals.supabase;
	const sermonRes = await loadSermonById(supabase, params.id);
	if (!sermonRes.sermon) error(404, 'Sermon not found');

	const [workspace, venuesRes, profileRes] = await Promise.all([
		loadStudyWorkspace(
			supabase,
			{ kind: 'sermon', id: params.id },
			{
				topical: sermonRes.sermon.topical,
				passageDisplay: sermonRes.sermon.passage_display,
				topic: sermonRes.sermon.topic
			},
			url.searchParams.get('import'),
			url.searchParams.get('src_q')?.trim() ?? ''
		),
		loadSermonVenues(supabase),
		supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
	]);

	if (profileRes.error) console.error('[sermons] profile', profileRes.error);
	const isOwner = ((profileRes.data?.role as string | null) ?? null) === 'owner';

	return {
		sermon: sermonRes.sermon,
		venues: venuesRes.venues,
		...workspace,
		isOwner,
		loadError: sermonRes.error ?? workspace.loadError ?? venuesRes.error
	};
};

export const actions: Actions = {
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
	},
	setCommentaryRating: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'setCommentaryRating' as const, message: 'Unauthorized' });
		return setCommentaryRatingAction(locals.supabase, user.id, await request.formData());
	},
	setCommentaryShelf: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'setCommentaryShelf' as const, message: 'Unauthorized' });
		return setCommentaryShelfAction(locals.supabase, user.id, await request.formData());
	},
	addPaperSource: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'addPaperSource' as const, message: 'Unauthorized' });
		return addPaperSourceAction(locals.supabase, user.id, await request.formData());
	},
	updatePaperSourceNotes: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updatePaperSourceNotes' as const, message: 'Unauthorized' });
		return updatePaperSourceNotesAction(locals.supabase, await request.formData());
	},
	removePaperSource: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'removePaperSource' as const, message: 'Unauthorized' });
		return removePaperSourceAction(locals.supabase, await request.formData());
	},
	createNotOwnedSource: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createNotOwnedSource' as const, message: 'Unauthorized' });
		return createNotOwnedSourceAction(locals.supabase, user.id, await request.formData());
	},
	createPaperGroup: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createPaperGroup' as const, message: 'Unauthorized' });
		return createPaperGroupAction(locals.supabase, user.id, await request.formData());
	},
	renamePaperGroup: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'renamePaperGroup' as const, message: 'Unauthorized' });
		return renamePaperGroupAction(locals.supabase, await request.formData());
	},
	reorderPaperGroups: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'reorderPaperGroups' as const, message: 'Unauthorized' });
		return reorderPaperGroupsAction(locals.supabase, await request.formData());
	},
	softDeletePaperGroup: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'softDeletePaperGroup' as const, message: 'Unauthorized' });
		return softDeletePaperGroupAction(locals.supabase, await request.formData());
	},
	setPaperSourceGroup: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'setPaperSourceGroup' as const, message: 'Unauthorized' });
		return setPaperSourceGroupAction(locals.supabase, await request.formData());
	},
	importPaperSources: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'importPaperSources' as const, message: 'Unauthorized' });
		return importPaperSourcesAction(locals.supabase, user.id, await request.formData());
	},
	setPaperSourceUsage: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'setPaperSourceUsage' as const, message: 'Unauthorized' });
		return setPaperSourceUsageAction(locals.supabase, await request.formData());
	},
	restorePaperSource: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'restorePaperSource' as const, message: 'Unauthorized' });
		return restorePaperSourceAction(locals.supabase, await request.formData());
	},
	removeSetMember: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'removeSetMember' as const, message: 'Unauthorized' });
		return removeSetMemberAction(locals.supabase, user.id, await request.formData());
	},
	restoreSetMember: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'restoreSetMember' as const, message: 'Unauthorized' });
		return restoreSetMemberAction(locals.supabase, user.id, await request.formData());
	},
	createSet: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createSet' as const, message: 'Unauthorized' });
		return createResourceSetAction(locals.supabase, user.id, await request.formData());
	},
	saveGroupAsSet: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'saveGroupAsSet' as const, message: 'Unauthorized' });
		return saveGroupAsSetAction(locals.supabase, user.id, await request.formData());
	}
};
