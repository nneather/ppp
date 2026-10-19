import type { SupabaseClient } from '@supabase/supabase-js';
import { loadBookListFiltered, loadEssaySearchHits } from '$lib/library/server/loaders';
import {
	buildImportChecklist,
	groupImportSets,
	importGroupName,
	parseImportTarget,
	suggestResourceSets,
	type ImportChecklistRow,
	type SetSuggestion
} from '$lib/studies/import-suggest';
import type { PaperGroupView, PaperSourceView, OrphanPaperSource } from '$lib/studies/paper-sources';
import { loadResourceSetDetail, loadResourceSetSummaries } from '$lib/studies/server/resource-set-loaders';
import type { StudyParent } from '$lib/studies/study-parent';
import type { BookListRow, EssaySearchHit } from '$lib/types/library';
import {
	loadPaperDetail,
	loadStudyGroups,
	loadStudySourceViews
} from '$lib/studies/server/paper-loaders';

const SOURCE_SEARCH_LIMIT = 8;

export type StudyWorkspace = {
	sources: PaperSourceView[];
	groups: PaperGroupView[];
	orphanSources: OrphanPaperSource[];
	srcQ: string;
	bookHits: BookListRow[];
	essayHits: EssaySearchHit[];
	suggestions: SetSuggestion[];
	importSets: {
		bibleBooks: { id: string; name: string }[];
		language: { id: string; name: string }[];
		custom: { id: string; name: string }[];
	};
	setNames: { id: string; name: string }[];
	importPapers: { id: string; title: string; passageDisplay: string | null }[];
	importChecklist: {
		key: string;
		groupName: string;
		sourceLabel: string;
		copyNotes: boolean;
		rows: ImportChecklistRow[];
	} | null;
	importError: string | null;
	loadError: string | null;
};

export async function loadStudyWorkspace(
	supabase: SupabaseClient,
	parent: StudyParent,
	study: { topical: boolean; passageDisplay: string | null; topic: string | null },
	importParam: string | null,
	srcQ: string
): Promise<StudyWorkspace> {
	const [sourcesRes, groupsRes, setRes, otherPapersRes] = await Promise.all([
		loadStudySourceViews(supabase, parent),
		loadStudyGroups(supabase, parent),
		loadResourceSetSummaries(supabase),
		supabase
			.from('papers')
			.select('id, title, passage_display')
			.is('deleted_at', null)
			.neq('status', 'archived')
			.order('created_at', { ascending: false })
	]);

	if (otherPapersRes.error) console.error('[studies] import papers', otherPapersRes.error);

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
	const suggestions = suggestResourceSets(
		{
			topical: study.topical,
			passageDisplay: study.passageDisplay,
			topic: study.topic
		},
		setSummaries
	);
	const groupedSets = groupImportSets(setSummaries);
	const importPapers = ((otherPapersRes.data ?? []) as {
		id: string;
		title: string;
		passage_display: string | null;
	}[])
		.filter((paper) => parent.kind !== 'paper' || paper.id !== parent.id)
		.map((paper) => ({
			id: paper.id,
			title: paper.title,
			passageDisplay: paper.passage_display
		}));

	const attachedBookIds = sourcesRes.sources
		.filter((source) => source.kind === 'book')
		.map((source) => source.citation.id);
	const attachedEssayIds = sourcesRes.sources
		.filter((source) => source.kind === 'essay')
		.map((source) => source.essayId);

	let importChecklist: StudyWorkspace['importChecklist'] = null;
	let importError: string | null = null;
	const importTarget = parseImportTarget(importParam);
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
					detail.set.included.map((member) => ({
						bookId: member.bookId,
						essayId: member.essayId,
						title: member.title,
						notes: null
					})),
					attachedBookIds,
					attachedEssayIds
				)
			};
		}
	} else if (importTarget?.kind === 'paper') {
		if (parent.kind === 'paper' && importTarget.id === parent.id) {
			importError = 'Pick a different paper.';
		} else {
			const [priorPaper, priorSources] = await Promise.all([
				loadPaperDetail(supabase, importTarget.id),
				loadStudySourceViews(supabase, { kind: 'paper', id: importTarget.id })
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
						priorSources.sources.map((source) => ({
							bookId: source.kind === 'book' ? source.citation.id : null,
							essayId: source.kind === 'essay' ? source.essayId : null,
							title:
								source.kind === 'book'
									? (source.citation.title ?? 'Untitled')
									: source.essay.essay_title,
							notes: source.notes
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
		sources: sourcesRes.sources,
		groups: groupsRes.groups,
		orphanSources: sourcesRes.orphans,
		srcQ,
		bookHits,
		essayHits,
		suggestions,
		importSets: {
			bibleBooks: groupedSets.bibleBooks.map((set) => ({ id: set.id, name: set.name })),
			language: groupedSets.language.map((set) => ({ id: set.id, name: set.name })),
			custom: groupedSets.custom.map((set) => ({ id: set.id, name: set.name }))
		},
		setNames: setSummaries.map((set) => ({ id: set.id, name: set.name })),
		importPapers,
		importChecklist,
		importError,
		loadError: sourcesRes.error ?? groupsRes.error ?? setRes.error
	};
}
