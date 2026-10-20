import type { SupabaseClient } from '@supabase/supabase-js';
import { loadBookListFiltered, loadEssaySearchHits } from '$lib/library/server/loaders';
import {
	groupImportSetSections,
	suggestResourceSets,
	type ImportSetSection,
	type SetSuggestion
} from '$lib/studies/import-suggest';
import { studyPassageRanges } from '$lib/studies/passage-ranges';
import {
	footnotePagesByBook,
	passageSectionImportCandidates
} from '$lib/studies/passage-section-suggest';
import {
	loadOverlappingPassageSections,
	loadPrimaryStudyPassages
} from '$lib/studies/server/passage-section-suggest';
import type { PaperGroupView, PaperSourceView, OrphanPaperSource } from '$lib/studies/paper-sources';
import {
	loadImportCreateSections,
	loadResourceSetSummaries
} from '$lib/studies/server/resource-set-loaders';
import type { StudyParent } from '$lib/studies/study-parent';
import type { BookListRow, EssaySearchHit } from '$lib/types/library';
import {
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
	importSets: ImportSetSection[];
	importCreateSections: { id: string; name: string; setKind: 'language' | 'custom' }[];
	setNames: { id: string; name: string }[];
	importPapers: { id: string; title: string; passageDisplay: string | null }[];
	/** Overlapping passage-section books offered on import (commentary coverage omitted). */
	sectionCandidateCount: number;
	/** Book id → tightest overlapping section pages, for the footnote box. */
	footnotePages: Record<string, string>;
	/** Systematic theology index hits for the study's primary passage ([252]). */
	systematics: SystematicSetBlock[];
	loadError: string | null;
};

export async function loadStudyWorkspace(
	supabase: SupabaseClient,
	parent: StudyParent,
	study: { topical: boolean; passageDisplay: string | null; topic: string | null },
	_importParam: string | null,
	srcQ: string
): Promise<StudyWorkspace> {
	const [sourcesRes, groupsRes, setRes, createSectionsRes, otherPapersRes, passageRows] =
		await Promise.all([
			loadStudySourceViews(supabase, parent),
			loadStudyGroups(supabase, parent),
			loadResourceSetSummaries(supabase),
			loadImportCreateSections(supabase),
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
	const importSets = groupImportSetSections(setSummaries);
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

	return {
		sources: sourcesRes.sources,
		groups: groupsRes.groups,
		orphanSources: sourcesRes.orphans,
		srcQ,
		bookHits,
		essayHits,
		suggestions,
		importSets,
		importCreateSections: createSectionsRes.sections,
		setNames: setSummaries.map((set) => ({ id: set.id, name: set.name })),
		importPapers,
		sectionCandidateCount: sectionCandidates.length,
		footnotePages,
		systematics,
		loadError:
			sourcesRes.error ?? groupsRes.error ?? setRes.error ?? createSectionsRes.error
	};
}
