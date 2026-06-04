import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	loadProjectTree,
	loadWeekUpdates,
	loadCarryForward,
	flattenProjectTree,
	loadProjectRows,
	loadLatestHealth
} from '$lib/projects/server/loaders';
import { loadLinksByProject } from '$lib/projects/server/task-loaders';
import {
	saveWeeklyCheckinAction,
	createProjectAction,
	updateProjectAction,
	softDeleteProjectAction,
	undoSoftDeleteProjectAction,
	createProjectLinkAction,
	updateProjectLinkAction,
	deleteProjectLinkAction,
	reorderProjectLinksAction
} from '$lib/projects/server/actions';
import { currentSundayChicago, parseYmd, sundayContaining } from '$lib/projects/week';
import type { ProjectUpdateRow, LatestHealth } from '$lib/types/projects';

function parseWeekParam(raw: string | null): string {
	const t = (raw ?? '').trim();
	if (t && parseYmd(t)) return sundayContaining(t);
	return currentSundayChicago();
}

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:projects:tree');

	const weekOf = parseWeekParam(url.searchParams.get('week'));
	const recentlyDeletedId = url.searchParams.get('deleted');

	const supabase = locals.supabase;

	const [tree, weekUpdatesMap, carryForwardMap, flatRows, latestHealthMap, linksByProject] =
		await Promise.all([
			locals.perf.measure('db', () => loadProjectTree(supabase)),
			locals.perf.measure('db', () => loadWeekUpdates(supabase, weekOf)),
			locals.perf.measure('db', () => loadCarryForward(supabase, weekOf)),
			locals.perf.measure('db', () => loadProjectRows(supabase)),
			locals.perf.measure('db', () => loadLatestHealth(supabase)),
			locals.perf.measure('db', () => loadLinksByProject(supabase))
		]);

	const weekUpdates = Object.fromEntries(weekUpdatesMap) as Record<string, ProjectUpdateRow>;
	const carryForward = Object.fromEntries(carryForwardMap) as Record<
		string,
		Pick<
			ProjectUpdateRow,
			| 'health_status'
			| 'reason'
			| 'next_steps'
			| 'progress_value'
			| 'progress_max'
			| 'progress_note'
		>
	>;
	const latestHealth = Object.fromEntries(latestHealthMap) as Record<string, LatestHealth>;

	return {
		tree,
		flatOptions: flattenProjectTree(tree),
		allRows: flatRows,
		weekOf,
		weekUpdates,
		carryForward,
		latestHealth,
		recentlyDeletedId,
		linksByProject
	};
};

export const actions: Actions = {
	saveCheckin: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'saveCheckin' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return saveWeeklyCheckinAction(locals.supabase, user.id, fd);
	},
	createProject: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createProject' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return createProjectAction(locals.supabase, user.id, fd);
	},
	updateProject: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateProject' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return updateProjectAction(locals.supabase, fd);
	},
	softDeleteProject: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'softDeleteProject' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return softDeleteProjectAction(locals.supabase, fd);
	},
	undoSoftDeleteProject: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'undoSoftDeleteProject' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return undoSoftDeleteProjectAction(locals.supabase, fd);
	},
	createProjectLink: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createProjectLink' as const, message: 'Unauthorized' });
		return createProjectLinkAction(locals.supabase, user.id, await request.formData());
	},
	updateProjectLink: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateProjectLink' as const, message: 'Unauthorized' });
		return updateProjectLinkAction(locals.supabase, await request.formData());
	},
	deleteProjectLink: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'deleteProjectLink' as const, message: 'Unauthorized' });
		return deleteProjectLinkAction(locals.supabase, await request.formData());
	},
	reorderProjectLinks: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'reorderProjectLinks' as const, message: 'Unauthorized' });
		return reorderProjectLinksAction(locals.supabase, await request.formData());
	}
};
