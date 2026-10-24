import type { SupabaseClient } from '@supabase/supabase-js';
import { studyLabel } from '$lib/mcp/study';
import type { StudyParent } from '$lib/studies/study-parent';
import { studyParentField } from '$lib/studies/study-parent';
import type { StudyNoteView } from '$lib/studies/study-note';

type NoteRow = {
	id: string;
	source_id: string | null;
	page: string | null;
	passage_display: string | null;
	bible_book: string | null;
	chapter: number | null;
	verse_start: number | null;
	verse_end: number | null;
	body: string;
	created_at: string;
};

export async function loadStudyNotes(
	supabase: SupabaseClient,
	parent: StudyParent
): Promise<{ notes: StudyNoteView[]; error: string | null }> {
	const { data, error } = await supabase
		.from('study_notes')
		.select(
			'id, source_id, page, passage_display, bible_book, chapter, verse_start, verse_end, body, created_at'
		)
		.eq(studyParentField(parent), parent.id)
		.is('deleted_at', null)
		.order('created_at', { ascending: false });

	if (error) {
		console.error('[studies] loadStudyNotes', error);
		return { notes: [], error: error.message };
	}

	const notes = ((data ?? []) as NoteRow[]).map((row) => ({
		id: row.id,
		sourceId: row.source_id,
		page: row.page,
		passageDisplay: row.passage_display,
		bibleBook: row.bible_book,
		chapter: row.chapter,
		verseStart: row.verse_start,
		verseEnd: row.verse_end,
		body: row.body,
		createdAt: row.created_at
	}));

	return { notes, error: null };
}

export type CatalogNoteHit = {
	id: string;
	body: string;
	page: string | null;
	passageDisplay: string | null;
	createdAt: string;
	studyKind: 'paper' | 'sermon';
	studyId: string;
	studyLabel: string;
};

type CatalogNoteRow = {
	id: string;
	body: string;
	page: string | null;
	passage_display: string | null;
	created_at: string;
	paper_id: string | null;
	sermon_id: string | null;
	source_id: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function labelsForNotes(
	supabase: SupabaseClient,
	rows: CatalogNoteRow[]
): Promise<Map<string, string>> {
	const paperIds = [...new Set(rows.map((row) => row.paper_id).filter((id): id is string => !!id))];
	const sermonIds = [...new Set(rows.map((row) => row.sermon_id).filter((id): id is string => !!id))];
	const labels = new Map<string, string>();
	if (paperIds.length > 0) {
		const { data } = await supabase
			.from('papers')
			.select('id, title, passage_display')
			.in('id', paperIds)
			.is('deleted_at', null);
		for (const paper of (data ?? []) as { id: string; title: string | null; passage_display: string | null }[]) {
			labels.set(
				paper.id,
				studyLabel({
					kind: 'paper',
					title: paper.title,
					passage: paper.passage_display,
					topic: null
				})
			);
		}
	}
	if (sermonIds.length > 0) {
		const { data } = await supabase
			.from('sermons')
			.select('id, topic, passage_display')
			.in('id', sermonIds)
			.is('deleted_at', null);
		for (const sermon of (data ?? []) as { id: string; topic: string | null; passage_display: string | null }[]) {
			labels.set(
				sermon.id,
				studyLabel({
					kind: 'sermon',
					title: null,
					passage: sermon.passage_display,
					topic: sermon.topic
				})
			);
		}
	}
	return labels;
}

function hitsFromRows(rows: CatalogNoteRow[], labels: Map<string, string>, excludeStudyId: string | null): CatalogNoteHit[] {
	const hits: CatalogNoteHit[] = [];
	for (const row of rows) {
		const studyId = row.paper_id ?? row.sermon_id;
		if (!studyId || studyId === excludeStudyId) continue;
		const studyLabelText = labels.get(studyId);
		if (!studyLabelText) continue;
		hits.push({
			id: row.id,
			body: row.body,
			page: row.page,
			passageDisplay: row.passage_display,
			createdAt: row.created_at,
			studyKind: row.paper_id ? 'paper' : 'sermon',
			studyId,
			studyLabel: studyLabelText
		});
	}
	return hits;
}

/** Notes on the same book, essay, or article in other studies. */
export async function loadNotesOnCatalog(
	supabase: SupabaseClient,
	filter: { bookId?: string | null; essayId?: string | null; articleId?: string | null; excludeStudyId?: string | null }
): Promise<{ notes: CatalogNoteHit[]; error: string | null }> {
	const column = filter.bookId ? 'book_id' : filter.essayId ? 'essay_id' : filter.articleId ? 'article_id' : null;
	const value = filter.bookId || filter.essayId || filter.articleId || null;
	if (!column || !value || !UUID_RE.test(value)) {
		return { notes: [], error: 'Pick a catalog row.' };
	}
	const { data: sources, error: sourceError } = await supabase
		.from('study_sources')
		.select('id')
		.eq(column, value)
		.is('deleted_at', null);
	if (sourceError) {
		console.error('[studies] loadNotesOnCatalog sources', sourceError);
		return { notes: [], error: sourceError.message };
	}
	const sourceIds = ((sources ?? []) as { id: string }[]).map((row) => row.id);
	if (sourceIds.length === 0) return { notes: [], error: null };
	const { data, error } = await supabase
		.from('study_notes')
		.select('id, body, page, passage_display, created_at, paper_id, sermon_id, source_id')
		.in('source_id', sourceIds)
		.is('deleted_at', null)
		.order('created_at', { ascending: false })
		.limit(40);
	if (error) {
		console.error('[studies] loadNotesOnCatalog notes', error);
		return { notes: [], error: error.message };
	}
	const rows = (data ?? []) as CatalogNoteRow[];
	const labels = await labelsForNotes(supabase, rows);
	return { notes: hitsFromRows(rows, labels, filter.excludeStudyId ?? null), error: null };
}

/** Body search across live notes. Read-only. */
export async function searchStudyNotes(
	supabase: SupabaseClient,
	query: string,
	limit = 20
): Promise<{ notes: CatalogNoteHit[]; error: string | null }> {
	const needle = query.trim().replace(/[%_]/g, '');
	if (needle.length < 2) return { notes: [], error: 'Search needs at least two characters.' };
	const { data, error } = await supabase
		.from('study_notes')
		.select('id, body, page, passage_display, created_at, paper_id, sermon_id, source_id')
		.ilike('body', `%${needle}%`)
		.is('deleted_at', null)
		.order('created_at', { ascending: false })
		.limit(Math.min(Math.max(limit, 1), 40));
	if (error) {
		console.error('[studies] searchStudyNotes', error);
		return { notes: [], error: error.message };
	}
	const rows = (data ?? []) as CatalogNoteRow[];
	const labels = await labelsForNotes(supabase, rows);
	return { notes: hitsFromRows(rows, labels, null), error: null };
}
