import type { SupabaseClient } from '@supabase/supabase-js';
import { loadBookListFiltered, loadEssaySearchHits } from '$lib/library/server/loaders';
import {
	buildImportChecklist,
	groupImportSetSections,
	importGroupName,
	parseImportTarget,
	suggestResourceSets,
	type ImportChecklistRow,
	type SetSuggestion
} from '$lib/studies/import-suggest';
import { studyPassageRanges } from '$lib/studies/passage-ranges';
import {
	PASSAGE_SECTION_GROUP_NAME,
	footnotePagesByBook,
	passageSectionImportCandidates
} from '$lib/studies/passage-section-suggest';
import {
	loadOverlappingPassageSections,
	loadPrimaryStudyPassages
} from '$lib/studies/server/passage-section-suggest';
import type { PaperGroupView, PaperSourceView, OrphanPaperSource } from '$lib/studies/paper-sources';
import { citeableSetMembers } from '$lib/studies/resource-sets';
import {
	authorLabelsForRefs,
	loadResourceSetDetail,
	loadResourceSetSummaries
} from '$lib/studies/server/resource-set-loaders';
import { refKey } from '$lib/studies/resource-sets';
import type { StudyParent } from '$lib/studies/study-parent';
import type { BookListRow, EssaySearchHit } from '$lib/types/library';
import {
	loadPaperDetail,
	loadStudyGroups,
	loadStudySourceViews
} from '$lib/studies/server/paper-loaders';
import { loadSystematicsForPassage } from '$lib/library/server/systematics-loaders';
import type { SystematicSetBlock } from '$lib/library/outline';

const SOURCE_SEARCH_LIMIT = 8;

export type StudyWorkspace = {
	sources: PaperSourceView[];
	groups: PaperGroupView[];
	orphanSources: OrphanPaperSource[];
	srcQ: string;
	bookHits: BookListRow[];
	essayHits: EssaySearchHit[];
	suggestions: SetSuggestion[];
	importSets: { label: string; sets: { id: string; name: string }[] }[];
	setNames: { id: string; name: string }[];
	importPapers: { id: string; title: string; passageDisplay: string | null }[];
	importChecklist: {
		key: string;
		groupName: string;
		sourceLabel: string;
		copyNotes: boolean;
		rows: ImportChecklistRow[];
	} | null;
	/** Overlapping passage-section books offered on import (commentary coverage omitted). */
	sectionCandidateCount: number;
	/** Book id → tightest overlapping section pages, for the footnote box. */
	footnotePages: Record<string, string>;
	/** Systematic theology index hits for the study's primary passage ([252]). */
	systematics: SystematicSetBlock[];
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
	const [sourcesRes, groupsRes, setRes, otherPapersRes, passageRows] = await Promise.all([
		loadStudySourceViews(supabase, parent),
		loadStudyGroups(supabase, parent),
		loadResourceSetSummaries(supabase),
		supabase
			.from('papers')
			.select('id, title, passage_display')
			.is('deleted_at', null)
			.neq('status', 'archived')
			.order('created_at', { ascending: false }),
		loadPrimaryStudyPassages(supabase, parent)
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
	const groupedSets = groupImportSetSections(setSummaries);
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

	const ranges = studyPassageRanges(study.passageDisplay, passageRows);
	const primaryRange = ranges[0] ?? null;
	const [sectionOverlap, systematics] = await Promise.all([
		loadOverlappingPassageSections(supabase, ranges),
		primaryRange
			? loadSystematicsForPassage(supabase, {
					bibleBook: primaryRange.bibleBook,
					chapter: primaryRange.chapter,
					verse: primaryRange.verse,
					chapterEnd: primaryRange.chapterEnd,
					verseEnd: primaryRange.verseEnd
				})
			: Promise.resolve([] as SystematicSetBlock[])
	]);
	const sectionCandidates = passageSectionImportCandidates(
		sectionOverlap.sections,
		sectionOverlap.coverages
	);
	const footnotePages = footnotePagesByBook(sectionOverlap.sections);

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
					citeableSetMembers(detail.set.included).map((member) => ({
						bookId: member.bookId,
						essayId: member.essayId,
						title: member.title,
						notes: null,
						authors: member.authors,
						seriesAbbreviation: member.seriesAbbreviation,
						volumeCount: member.volumeCount
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
						priorSources.sources.map((source) => {
							if (source.kind === 'essay') {
								return {
									bookId: null,
									essayId: source.essayId,
									title: source.essay.essay_title,
									notes: source.notes,
									authors: source.authorsLabel,
									seriesAbbreviation: source.volume.series_abbreviation,
									volumeCount:
										source.volume.total_volumes && source.volume.total_volumes > 1
											? source.volume.total_volumes
											: null
								};
							}
							return {
								bookId: source.citation.id,
								essayId: null,
								title: source.citation.title ?? 'Untitled',
								notes: source.notes,
								authors: source.authorsLabel,
								seriesAbbreviation: source.citation.series_abbreviation,
								volumeCount:
									source.citation.total_volumes && source.citation.total_volumes > 1
										? source.citation.total_volumes
										: null
							};
						}),
						attachedBookIds,
						attachedEssayIds
					)
				};
				importError = priorSources.error;
			}
		}
	} else if (importTarget?.kind === 'sections') {
		const authorMap = await authorLabelsForRefs(
			supabase,
			sectionCandidates.map((c) => ({ bookId: c.bookId, essayId: c.essayId }))
		);
		importChecklist = {
			key: 'sections',
			groupName: PASSAGE_SECTION_GROUP_NAME,
			sourceLabel: study.passageDisplay?.trim() || 'this passage',
			copyNotes: false,
			rows: buildImportChecklist(
				sectionCandidates.map((c) => ({
					...c,
					authors: authorMap.get(refKey(c))?.label ?? null
				})),
				attachedBookIds,
				attachedEssayIds
			)
		};
		importError = sectionOverlap.error;
	}

	return {
		sources: sourcesRes.sources,
		groups: groupsRes.groups,
		orphanSources: sourcesRes.orphans,
		srcQ,
		bookHits,
		essayHits,
		suggestions,
		importSets: groupedSets.map((section) => ({
			label: section.label,
			sets: section.sets.map((set) => ({ id: set.id, name: set.name }))
		})),
		setNames: setSummaries.map((set) => ({ id: set.id, name: set.name })),
		importPapers,
		importChecklist,
		sectionCandidateCount: sectionCandidates.length,
		footnotePages,
		systematics,
		importError,
		loadError: sourcesRes.error ?? groupsRes.error ?? setRes.error
	};
}
