import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	loadProjectRows,
	flattenProjectTree,
	loadProjectTree,
	collectDescendantIds
} from '$lib/projects/server/loaders';
import { attachTaskDomainColors, loadTasks, loadTaskSeriesByIds } from '$lib/projects/server/task-loaders';
import { buildDomainColorByProjectId } from '$lib/projects/project-colors';
import {
	parseTaskSavedViews,
	resolveTaskViewProjectIds
} from '$lib/projects/task-views';
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
	const viewId = (url.searchParams.get('view') ?? '').trim() || null;
	const includeDeferred = url.searchParams.get('deferred') === '1';
	const includeCompleted = url.searchParams.get('completed') === '1';
	const showAll = url.searchParams.get('all') === '1';

	const supabase = locals.supabase;

	const [tree, flatRows, profileRes] = await Promise.all([
		loadProjectTree(supabase),
		loadProjectRows(supabase),
		supabase
			.from('profiles')
			.select('default_task_project_id, task_saved_views')
			.eq('id', user.id)
			.maybeSingle()
	]);

	if (profileRes.error) console.error(profileRes.error);

	const savedViews = parseTaskSavedViews(profileRes.data?.task_saved_views);
	const defaultTaskProjectId = profileRes.data?.default_task_project_id ?? null;

	// Domain roots only (Personal, Education, …) — not leaf children.
	const projectOptions = flattenProjectTree(tree).filter((o) => o.parent_id == null);

	let projectIds: string[] | null = null;
	let activeViewId: string | null = null;
	let activeViewName: string | null = null;

	// Explicit ?project= wins over ?view=
	if (projectId) {
		projectIds = [projectId, ...collectDescendantIds(flatRows, projectId)];
	} else if (viewId) {
		const view = savedViews.find((v) => v.id === viewId) ?? null;
		if (view) {
			activeViewId = view.id;
			activeViewName = view.name;
			projectIds = resolveTaskViewProjectIds(flatRows, view);
		}
	}

	const taskData = await loadTasks(supabase, {
		projectIds,
		includeDeferred,
		includeCompleted,
		showAll
	});

	const projectNameById = Object.fromEntries(flatRows.map((r) => [r.id, r.name]));
	const colored = attachTaskDomainColors(taskData, buildDomainColorByProjectId(flatRows));

	const seriesIds = [
		...new Set(
			[...colored.zones.flatMap((z) => z.tasks), ...colored.deferred, ...colored.completed]
				.map((t) => t.series_id)
				.filter((id): id is string => id != null)
		)
	];
	const seriesById = await loadTaskSeriesByIds(supabase, seriesIds);

	return {
		...colored,
		seriesById,
		projectId,
		activeViewId,
		activeViewName,
		savedViews,
		defaultTaskProjectId,
		includeDeferred,
		includeCompleted,
		showAll,
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
