/**
 * One-set / one-paper / passage-section import checklist for the dialog JSON
 * endpoint. Kept off the paper page load so opening a set does not reload the study.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	buildImportChecklist,
	importGroupName,
	type ImportChecklistRow
} from '$lib/studies/import-suggest';
import {
	PASSAGE_SECTION_GROUP_NAME,
	passageSectionImportCandidates
} from '$lib/studies/passage-section-suggest';
import { studyPassageRanges } from '$lib/studies/passage-ranges';
import {
	loadOverlappingPassageSections,
	loadPrimaryStudyPassages
} from '$lib/studies/server/passage-section-suggest';
import {
	authorLabelsForRefs,
	loadResourceSetDetail
} from '$lib/studies/server/resource-set-loaders';
import { loadPaperDetail, loadStudySourceViews } from '$lib/studies/server/paper-loaders';
import { citeableSetMembers, refKey } from '$lib/studies/resource-sets';
import type { StudyParent } from '$lib/studies/study-parent';

export type ImportChecklistPayload = {
	key: string;
	groupName: string;
	sourceLabel: string;
	copyNotes: boolean;
	rows: ImportChecklistRow[];
	/** Set exclude overrides — opt-in only; Select all ignores these. */
	notIncludedRows: ImportChecklistRow[];
	error: string | null;
};

function attachedIds(sources: { kind: string; citation?: { id: string }; essayId?: string }[]) {
	const attachedBookIds = sources
		.filter((source) => source.kind === 'book')
		.map((source) => source.citation!.id);
	const attachedEssayIds = sources
		.filter((source) => source.kind === 'essay')
		.map((source) => source.essayId!);
	return { attachedBookIds, attachedEssayIds };
}

export async function loadImportChecklistPayload(
	supabase: SupabaseClient,
	parent: StudyParent,
	target: { kind: 'set' | 'paper' | 'sections'; id: string },
	passageDisplay: string | null
): Promise<ImportChecklistPayload> {
	const sourcesRes = await loadStudySourceViews(supabase, parent);
	const { attachedBookIds, attachedEssayIds } = attachedIds(sourcesRes.sources);

	if (target.kind === 'set') {
		const detail = await loadResourceSetDetail(supabase, target.id);
		if (!detail.set) {
			return {
				key: `set:${target.id}`,
				groupName: '',
				sourceLabel: '',
				copyNotes: false,
				rows: [],
				notIncludedRows: [],
				error: detail.error ?? 'Set not found.'
			};
		}
		const rows = buildImportChecklist(
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
		);
		const notIncludedRows = buildImportChecklist(
			detail.set.excluded.map((member) => ({
				bookId: member.bookId,
				essayId: member.essayId,
				title: member.title,
				notes: null,
				authors: member.authors,
				seriesAbbreviation: member.seriesAbbreviation,
				volumeCount: member.volumeCount,
				hint: 'Not included in this set'
			})),
			attachedBookIds,
			attachedEssayIds
		);
		return {
			key: `set:${detail.set.id}`,
			groupName: importGroupName('set', detail.set.name),
			sourceLabel: detail.set.name,
			copyNotes: false,
			rows,
			notIncludedRows,
			error: null
		};
	}

	if (target.kind === 'paper') {
		if (parent.kind === 'paper' && target.id === parent.id) {
			return {
				key: `paper:${target.id}`,
				groupName: '',
				sourceLabel: '',
				copyNotes: true,
				rows: [],
				notIncludedRows: [],
				error: 'Pick a different paper.'
			};
		}
		const [priorPaper, priorSources] = await Promise.all([
			loadPaperDetail(supabase, target.id),
			loadStudySourceViews(supabase, { kind: 'paper', id: target.id })
		]);
		if (!priorPaper.paper) {
			return {
				key: `paper:${target.id}`,
				groupName: '',
				sourceLabel: '',
				copyNotes: true,
				rows: [],
				notIncludedRows: [],
				error: priorPaper.error ?? 'Paper not found.'
			};
		}
		const rows = buildImportChecklist(
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
		);
		return {
			key: `paper:${priorPaper.paper.id}`,
			groupName: importGroupName('paper', priorPaper.paper.title),
			sourceLabel: priorPaper.paper.title,
			copyNotes: true,
			rows,
			notIncludedRows: [],
			error: priorSources.error
		};
	}

	const passageRows = await loadPrimaryStudyPassages(supabase, parent);
	const ranges = studyPassageRanges(passageDisplay, passageRows);
	const sectionOverlap = await loadOverlappingPassageSections(supabase, ranges);
	const sectionCandidates = passageSectionImportCandidates(
		sectionOverlap.sections,
		sectionOverlap.coverages
	);
	const authorMap = await authorLabelsForRefs(
		supabase,
		sectionCandidates.map((c) => ({ bookId: c.bookId, essayId: c.essayId }))
	);
	const rows = buildImportChecklist(
		sectionCandidates.map((c) => ({
			...c,
			authors: authorMap.get(refKey(c))?.label ?? null
		})),
		attachedBookIds,
		attachedEssayIds
	);
	return {
		key: 'sections',
		groupName: PASSAGE_SECTION_GROUP_NAME,
		sourceLabel: passageDisplay?.trim() || 'this passage',
		copyNotes: false,
		rows,
		notIncludedRows: [],
		error: sectionOverlap.error
	};
}
