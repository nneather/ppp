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
import type { SystematicsPassageQuery } from '$lib/library/server/systematics-loaders';
import { uniqueBibleBooks } from '$lib/sermons/commentary-books';
import { loadCommentaryShelves } from '$lib/sermons/server/commentary-shelf';
import type { SermonCommentaryShelf } from '$lib/types/sermons';

const SOURCE_SEARCH_LIMIT = 8;

export type StudyWorkspace = {
	sources: PaperSourceView[];
	groups: PaperGroupView[];
	orphanSources: OrphanPaperSource[];
	srcQ: string;
	bookHits: BookListRow[];
	essayHits: EssaySearchHit[];
	setNames: { id: string; name: string }[];
	/** Overlapping passage-section books offered on import (commentary coverage omitted). */
	sectionCandidateCount: number;
	/** Book id → tightest overlapping section pages, for the footnote box. */
	footnotePages: Record<string, string>;
	/** Passage the streamed systematics promise was loaded for. Null when topical. */
	systematicsQuery: SystematicsPassageQuery | null;
	/** Systematic theology index hits for the study's primary passage ([252]). */
	systematics: Promise<SystematicSetBlock[]>;
	/**
	 * Commentary shelves for the sermon's primary Bible books.
	 * Papers resolve empty. Streamed so the shelf does not block the page.
	 */
	commentaryShelves: Promise<{ shelves: SermonCommentaryShelf[]; error: string | null }>;
	loadError: string | null;
};

export type StudyImportMeta = {
	suggestions: SetSuggestion[];
	importSets: ImportSetSection[];
	importCreateSections: { id: string; name: string; setKind: 'language' | 'custom' }[];
	importPapers: { id: string; title: string; passageDisplay: string | null }[];
};

/** Import dialog payload. Kept off sermon and paper navigation. */
export async function loadStudyImportMeta(
	supabase: SupabaseClient,
	parent: StudyParent,
	study: { topical: boolean; passageDisplay: string | null; topic: string | null }
): Promise<StudyImportMeta> {
	const [setRes, createSectionsRes, otherPapersRes] = await Promise.all([
		loadResourceSetSummaries(supabase),
		loadImportCreateSections(supabase),
		supabase
			.from('papers')
			.select('id, title, passage_display')
			.is('deleted_at', null)
			.neq('status', 'archived')
			.order('created_at', { ascending: false })
	]);
	if (setRes.error) console.error('[studies] import sets', setRes.error);
	if (createSectionsRes.error) console.error('[studies] import sections', createSectionsRes.error);
	if (otherPapersRes.error) console.error('[studies] import papers', otherPapersRes.error);

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

	return {
		suggestions: suggestResourceSets(
			{
				topical: study.topical,
				passageDisplay: study.passageDisplay,
				topic: study.topic
			},
			setRes.sets
		),
		importSets: groupImportSetSections(setRes.sets),
		importCreateSections: createSectionsRes.sections,
		importPapers
	};
}

export async function loadStudyWorkspace(
	supabase: SupabaseClient,
	parent: StudyParent,
	study: { topical: boolean; passageDisplay: string | null; topic: string | null },
	_importParam: string | null,
	srcQ: string
): Promise<StudyWorkspace> {
	const [sourcesRes, groupsRes, setNamesRes, passageRows] = await Promise.all([
		loadStudySourceViews(supabase, parent),
		loadStudyGroups(supabase, parent),
		supabase
			.from('resource_sets')
			.select('id, name')
			.is('deleted_at', null)
			.order('name', { ascending: true }),
		loadPrimaryStudyPassages(supabase, parent)
	]);

	if (setNamesRes.error) console.error('[studies] set names', setNamesRes.error);

	let bookHits: BookListRow[] = [];
	let essayHits: EssaySearchHit[] = [];
	if (srcQ) {
		const [booksRes, essays] = await Promise.all([
			loadBookListFiltered(
				supabase,
				[],
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

	const ranges = studyPassageRanges(study.passageDisplay, passageRows);
	const primaryRange = ranges[0] ?? null;
	const sectionOverlap = await loadOverlappingPassageSections(supabase, ranges);
	const sectionCandidates = passageSectionImportCandidates(
		sectionOverlap.sections,
		sectionOverlap.coverages
	);
	const footnotePages = footnotePagesByBook(sectionOverlap.sections);
	const systematicsQuery: SystematicsPassageQuery | null = primaryRange
		? {
				bibleBook: primaryRange.bibleBook,
				chapter: primaryRange.chapter,
				verse: primaryRange.verse,
				chapterEnd: primaryRange.chapterEnd,
				verseEnd: primaryRange.verseEnd
			}
		: null;
	const systematics = systematicsQuery
		? loadSystematicsForPassage(supabase, systematicsQuery)
		: Promise.resolve([] as SystematicSetBlock[]);
	const commentaryShelves =
		parent.kind === 'sermon'
			? loadCommentaryShelves(
					supabase,
					uniqueBibleBooks(ranges.map((range) => range.bibleBook))
				)
			: Promise.resolve({ shelves: [] as SermonCommentaryShelf[], error: null });

	return {
		sources: sourcesRes.sources,
		groups: groupsRes.groups,
		orphanSources: sourcesRes.orphans,
		srcQ,
		bookHits,
		essayHits,
		setNames: ((setNamesRes.data ?? []) as { id: string; name: string }[]).map((set) => ({
			id: set.id,
			name: set.name
		})),
		sectionCandidateCount: sectionCandidates.length,
		footnotePages,
		systematicsQuery,
		systematics,
		commentaryShelves,
		loadError: sourcesRes.error ?? groupsRes.error
	};
}
