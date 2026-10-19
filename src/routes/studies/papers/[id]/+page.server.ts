import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
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
	setPaperStatusAction,
	softDeletePaperAction,
	softDeletePaperGroupAction,
	updatePaperAction,
	updatePaperSourceNotesAction
} from '$lib/studies/server/paper-actions';
import { loadPaperDetail } from '$lib/studies/server/paper-loaders';
import { loadStudyWorkspace } from '$lib/studies/server/study-workspace';
import {
	removeSetMemberAction,
	restoreSetMemberAction
} from '$lib/studies/server/resource-set-actions';
import { loadAssignments, loadCourses } from '$lib/classwork/server/loaders';
import { ymdInChicago } from '$lib/invoicing/chicago-date';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ locals, params, url, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	if (!UUID_RE.test(params.id)) error(404, 'Paper not found');

	depends(`app:classwork:paper:${params.id}`);

	const supabase = locals.supabase;
	const todayYmd = ymdInChicago();
	const paperRes = await loadPaperDetail(supabase, params.id);
	if (!paperRes.paper) error(404, 'Paper not found');

	const [workspace, coursesRes, assignmentsRes, linkedRes, profileRes] = await Promise.all([
		loadStudyWorkspace(
			supabase,
			{ kind: 'paper', id: params.id },
			{
				topical: paperRes.paper.topical,
				passageDisplay: paperRes.paper.passage_display,
				topic: paperRes.paper.topic
			},
			url.searchParams.get('import'),
			url.searchParams.get('src_q')?.trim() ?? ''
		),
		loadCourses(supabase),
		loadAssignments(supabase, { todayYmd }),
		supabase.from('papers').select('assignment_id').not('assignment_id', 'is', null).is('deleted_at', null),
		supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
	]);

	if (linkedRes.error) console.error('[papers] linked ids', linkedRes.error);
	if (profileRes.error) console.error('[papers] profile', profileRes.error);
	const isOwner = ((profileRes.data?.role as string | null) ?? null) === 'owner';

	const linkedAssignmentIds = ((linkedRes.data ?? []) as { assignment_id: string | null }[])
		.map((row) => row.assignment_id)
		.filter((value): value is string => !!value);

	return {
		paper: paperRes.paper,
		...workspace,
		courses: coursesRes.courses,
		assignments: assignmentsRes.assignments,
		linkedAssignmentIds,
		isOwner,
		loadError: paperRes.error ?? workspace.loadError
	};
};

export const actions: Actions = {
	updatePaper: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updatePaper' as const, message: 'Unauthorized' });
		return updatePaperAction(locals.supabase, await request.formData());
	},
	softDeletePaper: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'softDeletePaper' as const, message: 'Unauthorized' });
		return softDeletePaperAction(locals.supabase, await request.formData());
	},
	addPaperSource: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'addPaperSource' as const, message: 'Unauthorized' });
		return addPaperSourceAction(locals.supabase, user.id, await request.formData());
	},
	updatePaperSourceNotes: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(401, { kind: 'updatePaperSourceNotes' as const, message: 'Unauthorized' });
		}
		return updatePaperSourceNotesAction(locals.supabase, await request.formData());
	},
	removePaperSource: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'removePaperSource' as const, message: 'Unauthorized' });
		return removePaperSourceAction(locals.supabase, await request.formData());
	},
	createNotOwnedSource: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(401, { kind: 'createNotOwnedSource' as const, message: 'Unauthorized' });
		}
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
		if (!user) {
			return fail(401, { kind: 'reorderPaperGroups' as const, message: 'Unauthorized' });
		}
		return reorderPaperGroupsAction(locals.supabase, await request.formData());
	},
	softDeletePaperGroup: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(401, { kind: 'softDeletePaperGroup' as const, message: 'Unauthorized' });
		}
		return softDeletePaperGroupAction(locals.supabase, await request.formData());
	},
	setPaperSourceGroup: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(401, { kind: 'setPaperSourceGroup' as const, message: 'Unauthorized' });
		}
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
	setPaperStatus: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'setPaperStatus' as const, message: 'Unauthorized' });
		return setPaperStatusAction(locals.supabase, await request.formData());
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
	}
};
