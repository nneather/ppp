import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loadProjectRows, flattenProjectTree, loadProjectTree } from '$lib/projects/server/loaders';
import { loadTasks } from '$lib/projects/server/task-loaders';
import {
	createTaskAction,
	updateTaskAction,
	completeTaskAction,
	uncompleteTaskAction,
	deferTaskAction,
	promoteTaskAction,
	softDeleteTaskAction,
	undoSoftDeleteTaskAction
} from '$lib/projects/server/task-actions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseProjectFilter(raw: string | null): string | null {
	const t = (raw ?? '').trim();
	return UUID_RE.test(t) ? t : null;
}

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:projects:tasks');

	const projectId = parseProjectFilter(url.searchParams.get('project'));
	const includeDeferred = url.searchParams.get('deferred') === '1';
	const includeCompleted = url.searchParams.get('completed') === '1';

	const supabase = locals.supabase;

	const [taskData, tree, flatRows] = await Promise.all([
		loadTasks(supabase, { projectId, includeDeferred, includeCompleted }),
		loadProjectTree(supabase),
		loadProjectRows(supabase)
	]);

	const projectOptions = flattenProjectTree(tree).filter((o) => o.parent_id != null);
	const projectNameById = Object.fromEntries(flatRows.map((r) => [r.id, r.name]));

	return {
		...taskData,
		projectId,
		includeDeferred,
		includeCompleted,
		projectOptions,
		projectNameById,
		filterProjectName: projectId ? (projectNameById[projectId] ?? null) : null
	};
};

export const actions: Actions = {
	createTask: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createTask' as const, message: 'Unauthorized' });
		return createTaskAction(locals.supabase, user.id, await request.formData());
	},
	updateTask: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateTask' as const, message: 'Unauthorized' });
		return updateTaskAction(locals.supabase, await request.formData());
	},
	completeTask: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'completeTask' as const, message: 'Unauthorized' });
		return completeTaskAction(locals.supabase, await request.formData());
	},
	uncompleteTask: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'uncompleteTask' as const, message: 'Unauthorized' });
		return uncompleteTaskAction(locals.supabase, await request.formData());
	},
	deferTask: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'deferTask' as const, message: 'Unauthorized' });
		return deferTaskAction(locals.supabase, await request.formData());
	},
	promoteTask: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'promoteTask' as const, message: 'Unauthorized' });
		return promoteTaskAction(locals.supabase, await request.formData());
	},
	softDeleteTask: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'softDeleteTask' as const, message: 'Unauthorized' });
		return softDeleteTaskAction(locals.supabase, await request.formData());
	},
	undoSoftDeleteTask: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'undoSoftDeleteTask' as const, message: 'Unauthorized' });
		return undoSoftDeleteTaskAction(locals.supabase, await request.formData());
	}
};
