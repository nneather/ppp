import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ymdInChicago } from '$lib/invoicing/chicago-date';
import {
	createPaperAction,
	openResearchPaperAction,
	softDeletePaperAction,
	updatePaperAction
} from '$lib/classwork/server/paper-actions';
import { loadPapers } from '$lib/classwork/server/paper-loaders';
import { loadAssignments, loadCourses } from '$lib/classwork/server/loaders';

export const load: PageServerLoad = async ({ locals, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:classwork:papers');

	const todayYmd = ymdInChicago();
	const supabase = locals.supabase;

	const [papersRes, coursesRes, assignmentsRes, profileRes] = await Promise.all([
		loadPapers(supabase),
		loadCourses(supabase),
		loadAssignments(supabase, { todayYmd }),
		supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
	]);

	if (profileRes.error) console.error('[papers] profile', profileRes.error);
	const isOwner = ((profileRes.data?.role as string | null) ?? null) === 'owner';

	const linkedAssignmentIds = papersRes.papers
		.map((p) => p.assignment_id)
		.filter((v): v is string => !!v);

	return {
		papers: papersRes.papers,
		courses: coursesRes.courses,
		assignments: assignmentsRes.assignments,
		linkedAssignmentIds,
		isOwner,
		loadError: papersRes.error ?? coursesRes.error ?? assignmentsRes.error
	};
};

export const actions: Actions = {
	createPaper: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createPaper' as const, message: 'Unauthorized' });
		return createPaperAction(locals.supabase, user.id, await request.formData());
	},
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
	// Assignment-side "Open research paper" (create-or-open 1:1) posts here
	// from the assignment sheet on /classwork, then lands on the detail page.
	openResearchPaper: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(401, { kind: 'openResearchPaper' as const, message: 'Unauthorized' });
		}
		const result = await openResearchPaperAction(
			locals.supabase,
			user.id,
			await request.formData()
		);
		if ('success' in result && result.success) {
			redirect(303, `/classwork/papers/${result.paperId}`);
		}
		return result;
	}
};
