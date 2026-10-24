import type { SupabaseClient } from '@supabase/supabase-js';
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
