import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	addPaperSourceAction,
	createNotOwnedSourceAction,
	createPaperGroupAction,
	removePaperSourceAction,
	renamePaperGroupAction,
	reorderPaperGroupsAction,
	setPaperSourceGroupAction,
	softDeletePaperAction,
	softDeletePaperGroupAction,
	updatePaperAction,
	updatePaperSourceNotesAction
} from '$lib/classwork/server/paper-actions';
import {
	loadPaperDetail,
	loadPaperGroups,
	loadPaperSourceViews
} from '$lib/classwork/server/paper-loaders';
import { loadAssignments, loadCourses } from '$lib/classwork/server/loaders';
import { loadBookListFiltered, loadEssaySearchHits } from '$lib/library/server/loaders';
import { ymdInChicago } from '$lib/invoicing/chicago-date';
import type { BookListRow, EssaySearchHit } from '$lib/types/library';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SOURCE_SEARCH_LIMIT = 8;

export const load: PageServerLoad = async ({ locals, params, url, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	if (!UUID_RE.test(params.id)) error(404, 'Paper not found');

	depends(`app:classwork:paper:${params.id}`);

	const supabase = locals.supabase;
	const todayYmd = ymdInChicago();

	// Sources hydrate one loadBookDetail per distinct book (parallel) —
	// documented round-trip exception for the research surface (decision 189).
	const [paperRes, sourcesRes, groupsRes, coursesRes, assignmentsRes, linkedRes, profileRes] =
		await Promise.all([
			loadPaperDetail(supabase, params.id),
			loadPaperSourceViews(supabase, params.id),
			loadPaperGroups(supabase, params.id),
			loadCourses(supabase),
			loadAssignments(supabase, { todayYmd }),
			supabase
				.from('papers')
				.select('assignment_id')
				.not('assignment_id', 'is', null)
				.is('deleted_at', null),
			supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
		]);

	if (!paperRes.paper) error(404, 'Paper not found');

	if (linkedRes.error) console.error('[papers] linked ids', linkedRes.error);
	if (profileRes.error) console.error('[papers] profile', profileRes.error);
	const isOwner = ((profileRes.data?.role as string | null) ?? null) === 'owner';

	const linkedAssignmentIds = ((linkedRes.data ?? []) as { assignment_id: string | null }[])
		.map((r) => r.assignment_id)
		.filter((v): v is string => !!v);

	const srcQ = url.searchParams.get('src_q')?.trim() ?? '';
	let bookHits: BookListRow[] = [];
	let essayHits: EssaySearchHit[] = [];
	if (srcQ) {
		const [booksRes, essays] = await Promise.all([
			loadBookListFiltered(
				supabase,
				sourcesRes.people,
				{ q: srcQ, includeUnowned: true },
				{ limit: SOURCE_SEARCH_LIMIT }
			),
			loadEssaySearchHits(supabase, srcQ, {
				limit: SOURCE_SEARCH_LIMIT,
				includeUnowned: true
			})
		]);
		bookHits = booksRes.books;
		essayHits = essays;
	}

	return {
		paper: paperRes.paper,
		sources: sourcesRes.sources,
		groups: groupsRes.groups,
		orphanSources: sourcesRes.orphans,
		courses: coursesRes.courses,
		assignments: assignmentsRes.assignments,
		linkedAssignmentIds,
		srcQ,
		bookHits,
		essayHits,
		isOwner,
		loadError: paperRes.error ?? sourcesRes.error ?? groupsRes.error
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
	}
};
