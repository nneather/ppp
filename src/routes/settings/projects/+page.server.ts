import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	flattenProjectTree,
	loadProjectTree
} from '$lib/projects/server/loaders';
import { parseTaskSavedViews } from '$lib/projects/task-views';
import {
	deleteTaskSavedViewAction,
	setDefaultTaskProjectAction,
	upsertTaskSavedViewAction
} from '$lib/projects/server/task-prefs-actions';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;

	const [profileRes, tree] = await Promise.all([
		supabase
			.from('profiles')
			.select('role, default_task_project_id, task_saved_views')
			.eq('id', user.id)
			.maybeSingle(),
		loadProjectTree(supabase)
	]);

	if (profileRes.error) console.error(profileRes.error);

	const role = (profileRes.data?.role as string | null) ?? null;
	if (role !== 'owner') {
		return {
			notOwner: true as const,
			defaultTaskProjectId: null as string | null,
			savedViews: [],
			projectOptions: [] as { id: string; name: string }[]
		};
	}

	const projectOptions = flattenProjectTree(tree)
		.filter((o) => o.parent_id == null)
		.map((o) => ({ id: o.id, name: o.name }));

	return {
		notOwner: false as const,
		defaultTaskProjectId: profileRes.data?.default_task_project_id ?? null,
		savedViews: parseTaskSavedViews(profileRes.data?.task_saved_views),
		projectOptions
	};
};

export const actions: Actions = {
	setDefaultTaskProject: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'setDefaultTaskProject' as const, message: 'Unauthorized' });
		return setDefaultTaskProjectAction(locals.supabase, user.id, await request.formData());
	},
	upsertTaskSavedView: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'upsertTaskSavedView' as const, message: 'Unauthorized' });
		return upsertTaskSavedViewAction(locals.supabase, user.id, await request.formData());
	},
	deleteTaskSavedView: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'deleteTaskSavedView' as const, message: 'Unauthorized' });
		return deleteTaskSavedViewAction(locals.supabase, user.id, await request.formData());
	}
};
