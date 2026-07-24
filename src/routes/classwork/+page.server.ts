import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ymdInChicago } from '$lib/invoicing/chicago-date';
import {
	createAssignmentAction,
	createCourseAction,
	softDeleteAssignmentAction,
	softDeleteCourseAction,
	updateAssignmentAction,
	updateCourseAction
} from '$lib/classwork/server/actions';
import {
	groupAssignmentsByCourse,
	groupAssignmentsByDate,
	loadAssignments,
	loadClassworkProjectOptions,
	loadCourses,
	parseClassworkListFilters
} from '$lib/classwork/server/loaders';

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:classwork:list');

	const filters = parseClassworkListFilters(url);
	const todayYmd = ymdInChicago();
	const supabase = locals.supabase;

	const [coursesRes, assignmentsRes, projectsRes, profileRes] = await Promise.all([
		loadCourses(supabase),
		loadAssignments(supabase, { todayYmd, courseId: filters.courseId }),
		loadClassworkProjectOptions(supabase),
		supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
	]);

	if (profileRes.error) console.error('[classwork] profile', profileRes.error);
	const role = (profileRes.data?.role as string | null) ?? null;
	const isOwner = role === 'owner';

	const dateGroups =
		filters.group === 'date' ? groupAssignmentsByDate(assignmentsRes.assignments) : [];
	const courseGroups =
		filters.group === 'course'
			? groupAssignmentsByCourse(assignmentsRes.assignments, coursesRes.courses)
			: [];

	return {
		courses: coursesRes.courses,
		assignments: assignmentsRes.assignments,
		projectOptions: projectsRes.options,
		filters,
		todayYmd,
		dateGroups,
		courseGroups,
		isOwner,
		loadError: coursesRes.error ?? assignmentsRes.error ?? projectsRes.error
	};
};

export const actions: Actions = {
	createCourse: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createCourse' as const, message: 'Unauthorized' });
		return createCourseAction(locals.supabase, user.id, await request.formData());
	},
	updateCourse: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateCourse' as const, message: 'Unauthorized' });
		return updateCourseAction(locals.supabase, await request.formData());
	},
	softDeleteCourse: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'softDeleteCourse' as const, message: 'Unauthorized' });
		return softDeleteCourseAction(locals.supabase, await request.formData());
	},
	createAssignment: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createAssignment' as const, message: 'Unauthorized' });
		return createAssignmentAction(locals.supabase, user.id, await request.formData());
	},
	updateAssignment: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateAssignment' as const, message: 'Unauthorized' });
		return updateAssignmentAction(locals.supabase, await request.formData());
	},
	softDeleteAssignment: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'softDeleteAssignment' as const, message: 'Unauthorized' });
		return softDeleteAssignmentAction(locals.supabase, await request.formData());
	}
};
