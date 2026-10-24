/**
 * Read-only study tools. Wrap the studies loaders; no writes.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { ymdInChicago } from '../../src/lib/invoicing/chicago-date.ts';
import {
	resolveStudy,
	studyLabel,
	studySuggestions,
	type StudyResolveInput
} from '../../src/lib/mcp/study.ts';
import { loadSermonById, loadSermons, loadUpcomingSermons } from '../../src/lib/sermons/server/loaders.ts';
import {
	SUGGESTION_REASON_LABELS,
	suggestResourceSets
} from '../../src/lib/studies/import-suggest.ts';
import { studyPassageRanges } from '../../src/lib/studies/passage-ranges.ts';
import { passageSectionImportCandidates } from '../../src/lib/studies/passage-section-suggest.ts';
import {
	loadOverlappingPassageSections,
	loadPrimaryStudyPassages
} from '../../src/lib/studies/server/passage-section-suggest.ts';
import {
	compilePaperBibliography,
	compileSectionedBibliography,
	formatPaperBibliographyEntries
} from '../../src/lib/studies/paper-bibliography.ts';
import {
	paperSourceTitle,
	type PaperGroupView,
	type PaperSourceView
} from '../../src/lib/studies/paper-sources.ts';
import {
	loadPaperDetail,
	loadPapers,
	loadStudyGroups,
	loadStudySourceViews
} from '../../src/lib/studies/server/paper-loaders.ts';
import { loadResourceSetSummaries } from '../../src/lib/studies/server/resource-set-loaders.ts';
import { searchStudyNotes as searchStudyNoteRows } from '../../src/lib/studies/server/note-loaders.ts';
import type { StudyParent } from '../../src/lib/studies/study-parent.ts';
import type { PaperStatus } from '../../src/lib/types/classwork.ts';
import type { Database } from '../../src/lib/types/database.ts';
import type { SermonListRow } from '../../src/lib/types/sermons.ts';

type Sb = SupabaseClient<Database>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StudyHit = StudyResolveInput & {
	topical: boolean;
	status: PaperStatus | null;
	due_date: string | null;
	preached_on: string | null;
	venue_name: string | null;
	source_count: number | null;
};

function jsonText(data: unknown): { content: { type: 'text'; text: string }[] } {
	return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function fromPaper(paper: {
	id: string;
	title: string;
	passage_display: string | null;
	topic: string | null;
	topical: boolean;
	status: PaperStatus;
	due_date: string | null;
	assignment_due_date?: string | null;
	sourceCount?: number;
}): StudyHit {
	return {
		id: paper.id,
		kind: 'paper',
		label: studyLabel({
			kind: 'paper',
			title: paper.title,
			passage: paper.passage_display,
			topic: paper.topic
		}),
		title: paper.title,
		passage: paper.passage_display,
		topic: paper.topic,
		topical: paper.topical,
		status: paper.status,
		due_date: paper.assignment_due_date ?? paper.due_date,
		preached_on: null,
		venue_name: null,
		source_count: paper.sourceCount ?? null
	};
}

function fromSermon(sermon: SermonListRow): StudyHit {
	return {
		id: sermon.id,
		kind: 'sermon',
		label: studyLabel({
			kind: 'sermon',
			title: null,
			passage: sermon.passage_display,
			topic: sermon.topic
		}),
		title: null,
		passage: sermon.passage_display,
		topic: sermon.topic,
		topical: sermon.topical,
		status: null,
		due_date: null,
		preached_on: sermon.preached_on,
		venue_name: sermon.venue_name,
		source_count: null
	};
}

function summarize(study: StudyHit) {
	return {
		id: study.id,
		kind: study.kind,
		label: study.label,
		title: study.title,
		passage_display: study.passage,
		topic: study.topic,
		topical: study.topical,
		status: study.status,
		due_date: study.due_date,
		preached_on: study.preached_on,
		venue_name: study.venue_name,
		source_count: study.source_count,
		href: study.kind === 'paper' ? `/studies/papers/${study.id}` : `/studies/sermons/${study.id}`
	};
}

async function loadCatalog(supabase: Sb): Promise<{ studies: StudyHit[]; error: string | null }> {
	const [active, archived, sermons] = await Promise.all([
		loadPapers(supabase, 'active'),
		loadPapers(supabase, 'archived'),
		loadSermons(supabase)
	]);
	return {
		studies: [
			...active.papers.map(fromPaper),
			...archived.papers.map(fromPaper),
			...sermons.sermons.map(fromSermon)
		],
		error: active.error ?? archived.error ?? sermons.error
	};
}

async function resolveArg(
	supabase: Sb,
	raw: string
): Promise<{ study: StudyHit } | { error: string; suggestions?: string[] }> {
	const query = raw.trim();
	if (!query) return { error: 'study is required (title, passage, or id)' };
	if (UUID_RE.test(query)) {
		const [paperRes, sermonRes] = await Promise.all([
			loadPaperDetail(supabase, query),
			loadSermonById(supabase, query)
		]);
		const error = paperRes.error ?? sermonRes.error;
		if (error) return { error };
		if (paperRes.paper) return { study: fromPaper(paperRes.paper) };
		if (sermonRes.sermon) return { study: fromSermon(sermonRes.sermon) };
		return { error: 'Study not found', suggestions: [] };
	}

	const catalog = await loadCatalog(supabase);
	if (catalog.error) return { error: catalog.error };
	const resolved = resolveStudy(query, catalog.studies);
	if (!resolved) {
		return {
			error: `Unknown or ambiguous study: ${query}`,
			suggestions: studySuggestions(query, catalog.studies)
		};
	}
	const study = catalog.studies.find((row) => row.id === resolved.id && row.kind === resolved.kind);
	if (!study) return { error: 'Study not found', suggestions: [] };
	return { study };
}

export async function listStudies(
	supabase: Sb,
	args: {
		limit?: number;
		include_published?: boolean;
		include_archived?: boolean;
		kind?: 'paper' | 'sermon';
	} = {}
) {
	const todayYmd = ymdInChicago();
	const limit = args.limit ?? 20;
	const wantPapers = args.kind !== 'sermon';
	const wantSermons = args.kind !== 'paper';
	const statuses = new Set<PaperStatus>(['researching', 'drafting', 'submitted']);
	if (args.include_published) statuses.add('published');

	const [active, archived, sermonsRes] = await Promise.all([
		wantPapers ? loadPapers(supabase, 'active') : Promise.resolve(null),
		wantPapers && args.include_archived ? loadPapers(supabase, 'archived') : Promise.resolve(null),
		wantSermons ? loadUpcomingSermons(supabase, { todayYmd, limit }) : Promise.resolve(null)
	]);

	const papers = [
		...(active?.papers.filter((paper) => statuses.has(paper.status)) ?? []),
		...(archived?.papers ?? [])
	].slice(0, limit);
	const sermons = sermonsRes?.sermons ?? [];
	const lastNotes = await lastNoteAt(supabase, {
		paperIds: papers.map((paper) => paper.id),
		sermonIds: sermons.map((sermon) => sermon.id)
	});

	return jsonText({
		todayYmd,
		error: active?.error ?? archived?.error ?? sermonsRes?.error ?? null,
		paper_count: papers.length,
		sermon_count: sermons.length,
		papers: papers.map((paper) => withLastNote(summarize(fromPaper(paper)), lastNotes.get(paper.id) ?? null, todayYmd)),
		sermons: sermons.map((sermon) => withLastNote({
			id: sermon.id,
			kind: 'sermon' as const,
			label: studyLabel({
				kind: 'sermon',
				title: null,
				passage: sermon.passage_display,
				topic: sermon.topic
			}),
			passage_display: sermon.passage_display,
			topic: sermon.topic,
			topical: sermon.topical,
			preached_on: sermon.preached_on,
			venue_name: sermon.venue_name,
			venue_logistics: sermon.venue_logistics,
			href: `/studies/sermons/${sermon.id}`
		}, lastNotes.get(sermon.id) ?? null, todayYmd))
	});
}

function chicagoYmd(iso: string): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Chicago',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date(iso));
}

function daysSince(noteYmd: string, todayYmd: string): number {
	const ms = Date.parse(`${todayYmd}T00:00:00Z`) - Date.parse(`${noteYmd}T00:00:00Z`);
	return Math.round(ms / 86_400_000);
}

function withLastNote<T extends object>(row: T, lastNoteAt: string | null, todayYmd: string) {
	return {
		...row,
		last_note_at: lastNoteAt,
		days_since_note: lastNoteAt ? daysSince(chicagoYmd(lastNoteAt), todayYmd) : null
	};
}

async function lastNoteAt(
	supabase: Sb,
	ids: { paperIds: string[]; sermonIds: string[] }
): Promise<Map<string, string>> {
	const latest = new Map<string, string>();
	const fold = (rows: { parentId: string | null; created_at: string }[]) => {
		for (const row of rows) {
			if (!row.parentId) continue;
			const prev = latest.get(row.parentId);
			if (!prev || row.created_at > prev) latest.set(row.parentId, row.created_at);
		}
	};
	if (ids.paperIds.length > 0) {
		const { data } = await supabase
			.from('study_notes')
			.select('paper_id, created_at')
			.in('paper_id', ids.paperIds)
			.is('deleted_at', null);
		fold(
			((data ?? []) as { paper_id: string | null; created_at: string }[]).map((row) => ({
				parentId: row.paper_id,
				created_at: row.created_at
			}))
		);
	}
	if (ids.sermonIds.length > 0) {
		const { data } = await supabase
			.from('study_notes')
			.select('sermon_id, created_at')
			.in('sermon_id', ids.sermonIds)
			.is('deleted_at', null);
		fold(
			((data ?? []) as { sermon_id: string | null; created_at: string }[]).map((row) => ({
				parentId: row.sermon_id,
				created_at: row.created_at
			}))
		);
	}
	return latest;
}

export async function searchStudyNotes(supabase: Sb, args: { query?: string; limit?: number }) {
	const result = await searchStudyNoteRows(supabase, args.query ?? '', args.limit ?? 20);
	return jsonText({
		error: result.error,
		count: result.notes.length,
		notes: result.notes.map((note) => ({
			id: note.id,
			body: note.body,
			page: note.page,
			passage_display: note.passageDisplay,
			created_at: note.createdAt,
			study_kind: note.studyKind,
			study_id: note.studyId,
			study_label: note.studyLabel,
			href: note.studyKind === 'paper' ? `/studies/papers/${note.studyId}` : `/studies/sermons/${note.studyId}`
		}))
	});
}

function mapSource(source: PaperSourceView, groups: PaperGroupView[]) {
	const group = groups.find((row) => row.id === source.groupId);
	const entry = formatPaperBibliographyEntries([source])[0] ?? null;
	return {
		id: source.sourceId,
		usage: source.usage,
		group: group?.name ?? null,
		kind: source.kind,
		title: paperSourceTitle(source),
		book_id: source.kind === 'book' ? source.citation.id : source.parentBookId,
		essay_id: source.kind === 'essay' ? source.essayId : null,
		notes: source.notes,
		bibliography: entry?.plain ?? null
	};
}

export async function getStudySources(
	supabase: Sb,
	args: { study: string; include_candidates?: boolean }
) {
	const resolved = await resolveArg(supabase, args.study ?? '');
	if (!('study' in resolved)) return jsonText(resolved);

	const parent: StudyParent =
		resolved.study.kind === 'paper'
			? { kind: 'paper', id: resolved.study.id }
			: { kind: 'sermon', id: resolved.study.id };
	const [sourcesRes, groupsRes] = await Promise.all([
		loadStudySourceViews(supabase, parent),
		loadStudyGroups(supabase, parent)
	]);
	const error = sourcesRes.error ?? groupsRes.error;
	const includeCandidates = args.include_candidates === true;
	return jsonText({
		study: summarize(resolved.study),
		error,
		source_count: sourcesRes.sources.length,
		sources: sourcesRes.sources.map((source) => mapSource(source, groupsRes.groups)),
		bibliography: compilePaperBibliography(sourcesRes.sources, { includeCandidates }).plain,
		bibliography_by_group: compileSectionedBibliography(sourcesRes.sources, groupsRes.groups, {
			includeCandidates
		}).plain
	});
}

export async function suggestSources(supabase: Sb, args: { study: string }) {
	const resolved = await resolveArg(supabase, args.study ?? '');
	if (!('study' in resolved)) return jsonText(resolved);

	const parent: StudyParent =
		resolved.study.kind === 'paper'
			? { kind: 'paper', id: resolved.study.id }
			: { kind: 'sermon', id: resolved.study.id };
	const [setRes, passageRows, sourcesRes] = await Promise.all([
		loadResourceSetSummaries(supabase),
		loadPrimaryStudyPassages(supabase, parent),
		loadStudySourceViews(supabase, parent)
	]);
	const ranges = studyPassageRanges(resolved.study.passage, passageRows);
	const overlap = await loadOverlappingPassageSections(supabase, ranges);
	const sectionCandidates = passageSectionImportCandidates(overlap.sections, overlap.coverages);
	const attachedBooks = new Set(
		sourcesRes.sources.filter((source) => source.kind === 'book').map((source) => source.citation.id)
	);
	const suggestions = suggestResourceSets(
		{
			topical: resolved.study.topical,
			passageDisplay: resolved.study.passage,
			topic: resolved.study.topic
		},
		setRes.sets
	);
	return jsonText({
		study: summarize(resolved.study),
		error: setRes.error ?? overlap.error ?? sourcesRes.error,
		suggestions: suggestions.map((suggestion) => ({
			id: suggestion.id,
			name: suggestion.name,
			reason: suggestion.reason,
			reason_label: SUGGESTION_REASON_LABELS[suggestion.reason]
		})),
		passage_sections: sectionCandidates.map((candidate) => ({
			book_id: candidate.bookId,
			title: candidate.title,
			hint: candidate.hint ?? null,
			attached: candidate.bookId != null && attachedBooks.has(candidate.bookId)
		}))
	});
}
