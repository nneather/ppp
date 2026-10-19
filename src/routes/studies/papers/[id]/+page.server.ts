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
import {
	loadPaperDetail,
	loadPaperGroups,
	loadPaperSourceViews
} from '$lib/studies/server/paper-loaders';
import { loadResourceSetDetail, loadResourceSetSummaries } from '$lib/studies/server/resource-set-loaders';
import {
	removeSetMemberAction,
	restoreSetMemberAction
} from '$lib/studies/server/resource-set-actions';
import {
	buildImportChecklist,
	groupImportSets,
	importGroupName,
	parseImportTarget,
	suggestResourceSets,
	type ImportChecklistRow,
	type SetSuggestion
} from '$lib/studies/import-suggest';
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
	const [paperRes, sourcesRes, groupsRes, coursesRes, assignmentsRes, linkedRes, profileRes, setRes, otherPapersRes] =
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
			supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
			loadResourceSetSummaries(supabase),
			supabase
				.from('papers')
				.select('id, title, passage_display')
				.is('deleted_at', null)
				.neq('status', 'archived')
				.neq('id', params.id)
				.order('created_at', { ascending: false })
		]);

	if (!paperRes.paper) error(404, 'Paper not found');

	if (linkedRes.error) console.error('[papers] linked ids', linkedRes.error);
	if (profileRes.error) console.error('[papers] profile', profileRes.error);
	if (otherPapersRes.error) console.error('[papers] import papers', otherPapersRes.error);
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

	const setSummaries = setRes.sets;
	const suggestions: SetSuggestion[] = paperRes.paper
		? suggestResourceSets(
				{
					topical: paperRes.paper.topical,
					passageDisplay: paperRes.paper.passage_display,
					topic: paperRes.paper.topic
				},
				setSummaries
			)
		: [];
	const groupedSets = groupImportSets(setSummaries);
	const importPapers = ((otherPapersRes.data ?? []) as {
		id: string;
		title: string;
		passage_display: string | null;
	}[]).map((p) => ({
		id: p.id,
		title: p.title,
		passageDisplay: p.passage_display
	}));

	const attachedBookIds = sourcesRes.sources
		.filter((s) => s.kind === 'book')
		.map((s) => s.citation.id);
	const attachedEssayIds = sourcesRes.sources
		.filter((s) => s.kind === 'essay')
		.map((s) => s.essayId);

	let importChecklist: {
		key: string;
		groupName: string;
		sourceLabel: string;
		copyNotes: boolean;
		rows: ImportChecklistRow[];
	} | null = null;
	let importError: string | null = null;
	const importTarget = parseImportTarget(url.searchParams.get('import'));
	if (importTarget?.kind === 'set') {
		const detail = await loadResourceSetDetail(supabase, importTarget.id);
		if (!detail.set) {
			importError = detail.error ?? 'Set not found.';
		} else {
			importChecklist = {
				key: `set:${detail.set.id}`,
				groupName: importGroupName('set', detail.set.name),
				sourceLabel: detail.set.name,
				copyNotes: false,
				rows: buildImportChecklist(
					detail.set.included.map((m) => ({
						bookId: m.bookId,
						essayId: m.essayId,
						title: m.title,
						notes: null
					})),
					attachedBookIds,
					attachedEssayIds
				)
			};
		}
	} else if (importTarget?.kind === 'paper') {
		if (importTarget.id === params.id) {
			importError = 'Pick a different paper.';
		} else {
			const [priorPaper, priorSources] = await Promise.all([
				loadPaperDetail(supabase, importTarget.id),
				loadPaperSourceViews(supabase, importTarget.id)
			]);
			if (!priorPaper.paper) {
				importError = priorPaper.error ?? 'Paper not found.';
			} else {
				importChecklist = {
					key: `paper:${priorPaper.paper.id}`,
					groupName: importGroupName('paper', priorPaper.paper.title),
					sourceLabel: priorPaper.paper.title,
					copyNotes: true,
					rows: buildImportChecklist(
						priorSources.sources.map((s) => ({
							bookId: s.kind === 'book' ? s.citation.id : null,
							essayId: s.kind === 'essay' ? s.essayId : null,
							title: s.kind === 'book' ? (s.citation.title ?? 'Untitled') : s.essay.essay_title,
							notes: s.notes
						})),
						attachedBookIds,
						attachedEssayIds
					)
				};
				importError = priorSources.error;
			}
		}
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
		suggestions,
		importSets: {
			bibleBooks: groupedSets.bibleBooks.map((s) => ({ id: s.id, name: s.name })),
			language: groupedSets.language.map((s) => ({ id: s.id, name: s.name })),
			custom: groupedSets.custom.map((s) => ({ id: s.id, name: s.name }))
		},
		setNames: setSummaries.map((s) => ({ id: s.id, name: s.name })),
		importPapers,
		importChecklist,
		importError,
		loadError: paperRes.error ?? sourcesRes.error ?? groupsRes.error ?? setRes.error
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
