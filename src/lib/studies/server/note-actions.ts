import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BIBLE_BOOK_NAMES } from '$lib/library/bible-book-names';
import type { StudyNoteAnchorFields } from '$lib/studies/study-note';
import type { StudyParent } from '$lib/studies/study-parent';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trimOrNull(v: FormDataEntryValue | null): string | null {
	if (v === null || v === undefined) return null;
	const t = String(v).trim();
	return t.length > 0 ? t : null;
}

function readParent(fd: FormData): StudyParent | null {
	const paperId = trimOrNull(fd.get('paper_id'));
	const sermonId = trimOrNull(fd.get('sermon_id'));
	if (paperId && UUID_RE.test(paperId) && !sermonId) return { kind: 'paper', id: paperId };
	if (sermonId && UUID_RE.test(sermonId) && !paperId) return { kind: 'sermon', id: sermonId };
	return null;
}

function parentColumn(parent: StudyParent): { paper_id: string | null; sermon_id: string | null } {
	return parent.kind === 'paper'
		? { paper_id: parent.id, sermon_id: null }
		: { paper_id: null, sermon_id: parent.id };
}

function parsePositiveInt(raw: string | null): number | null | 'bad' {
	if (!raw) return null;
	if (!/^\d+$/.test(raw)) return 'bad';
	const n = Number.parseInt(raw, 10);
	return n > 0 ? n : 'bad';
}

function readAnchor(fd: FormData): { anchor: StudyNoteAnchorFields } | { message: string } {
	const bibleBook = trimOrNull(fd.get('bible_book'));
	const chapter = parsePositiveInt(trimOrNull(fd.get('chapter')));
	const verseStart = parsePositiveInt(trimOrNull(fd.get('verse_start')));
	const verseEnd = parsePositiveInt(trimOrNull(fd.get('verse_end')));
	if (chapter === 'bad' || verseStart === 'bad' || verseEnd === 'bad') {
		return { message: 'Verse anchor is not a passage.' };
	}
	if (bibleBook && !(BIBLE_BOOK_NAMES as readonly string[]).includes(bibleBook)) {
		return { message: 'Verse anchor is not a Bible book.' };
	}
	if (verseEnd != null && (verseStart == null || verseEnd < verseStart)) {
		return { message: 'Verse range is out of order.' };
	}
	return {
		anchor: {
			passage_display: trimOrNull(fd.get('passage_display')),
			bible_book: bibleBook,
			chapter,
			verse_start: verseStart,
			verse_end: verseEnd
		}
	};
}

type SourceRow = {
	id: string;
	paper_id: string | null;
	sermon_id: string | null;
	usage: string;
};

async function loadLiveSource(
	supabase: SupabaseClient,
	sourceId: string
): Promise<{ source: SourceRow | null; error: string | null }> {
	const { data, error } = await supabase
		.from('study_sources')
		.select('id, paper_id, sermon_id, usage')
		.eq('id', sourceId)
		.is('deleted_at', null)
		.maybeSingle();
	if (error) return { source: null, error: error.message };
	return { source: (data as SourceRow | null) ?? null, error: null };
}

function sourceOnParent(source: SourceRow, parent: StudyParent): boolean {
	return parent.kind === 'paper' ? source.paper_id === parent.id : source.sermon_id === parent.id;
}

async function promoteCandidate(supabase: SupabaseClient, sourceId: string): Promise<string | null> {
	const { error } = await supabase
		.from('study_sources')
		.update({ usage: 'consulted' } as never)
		.eq('id', sourceId)
		.eq('usage', 'candidate')
		.is('deleted_at', null);
	if (error) {
		console.error('[studies] promote note source', error);
		return error.message;
	}
	return null;
}

export async function createStudyNoteAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const parent = readParent(fd);
	if (!parent) return fail(400, { kind: 'createStudyNote' as const, message: 'Invalid study.' });

	const body = trimOrNull(fd.get('body'));
	if (!body) return fail(400, { kind: 'createStudyNote' as const, message: 'Write a note first.' });

	const anchor = readAnchor(fd);
	if ('message' in anchor) {
		return fail(400, { kind: 'createStudyNote' as const, message: anchor.message });
	}

	const sourceId = trimOrNull(fd.get('source_id'));
	if (sourceId && !UUID_RE.test(sourceId)) {
		return fail(400, { kind: 'createStudyNote' as const, message: 'Invalid source.' });
	}
	if (sourceId) {
		const loaded = await loadLiveSource(supabase, sourceId);
		if (loaded.error) {
			return fail(500, { kind: 'createStudyNote' as const, message: loaded.error });
		}
		if (!loaded.source || !sourceOnParent(loaded.source, parent)) {
			return fail(400, { kind: 'createStudyNote' as const, message: 'That source is not on this study.' });
		}
	}

	const { data, error } = await supabase
		.from('study_notes')
		.insert({
			...parentColumn(parent),
			source_id: sourceId,
			page: trimOrNull(fd.get('page')),
			body,
			...anchor.anchor,
			created_by: userId
		} as never)
		.select('id')
		.single();

	if (error || !data) {
		console.error('[studies] createStudyNote', error);
		return fail(500, {
			kind: 'createStudyNote' as const,
			message: error?.message ?? 'Could not save the note.'
		});
	}

	if (sourceId) {
		const promoteError = await promoteCandidate(supabase, sourceId);
		if (promoteError) {
			return fail(500, { kind: 'createStudyNote' as const, message: promoteError });
		}
	}

	return {
		kind: 'createStudyNote' as const,
		success: true as const,
		noteId: (data as { id: string }).id
	};
}

export async function updateStudyNoteAction(supabase: SupabaseClient, fd: FormData) {
	const noteId = trimOrNull(fd.get('note_id'));
	if (!noteId || !UUID_RE.test(noteId)) {
		return fail(400, { kind: 'updateStudyNote' as const, message: 'Invalid note.' });
	}
	const body = trimOrNull(fd.get('body'));
	if (!body) return fail(400, { kind: 'updateStudyNote' as const, noteId, message: 'Write a note first.' });

	const anchor = readAnchor(fd);
	if ('message' in anchor) {
		return fail(400, { kind: 'updateStudyNote' as const, noteId, message: anchor.message });
	}

	const { error } = await supabase
		.from('study_notes')
		.update({
			body,
			page: trimOrNull(fd.get('page')),
			...anchor.anchor
		} as never)
		.eq('id', noteId)
		.is('deleted_at', null);

	if (error) {
		console.error('[studies] updateStudyNote', error);
		return fail(500, { kind: 'updateStudyNote' as const, noteId, message: error.message });
	}
	return { kind: 'updateStudyNote' as const, success: true as const, noteId };
}

export async function softDeleteStudyNoteAction(supabase: SupabaseClient, fd: FormData) {
	const noteId = trimOrNull(fd.get('note_id'));
	if (!noteId || !UUID_RE.test(noteId)) {
		return fail(400, { kind: 'softDeleteStudyNote' as const, message: 'Invalid note.' });
	}
	const { error } = await supabase
		.from('study_notes')
		.update({ deleted_at: new Date().toISOString() } as never)
		.eq('id', noteId)
		.is('deleted_at', null);
	if (error) {
		console.error('[studies] softDeleteStudyNote', error);
		return fail(500, { kind: 'softDeleteStudyNote' as const, noteId, message: error.message });
	}
	return { kind: 'softDeleteStudyNote' as const, success: true as const, noteId };
}

export async function attachStudyNoteSourceAction(supabase: SupabaseClient, fd: FormData) {
	const noteId = trimOrNull(fd.get('note_id'));
	const sourceId = trimOrNull(fd.get('source_id'));
	if (!noteId || !UUID_RE.test(noteId) || !sourceId || !UUID_RE.test(sourceId)) {
		return fail(400, { kind: 'attachStudyNoteSource' as const, message: 'Invalid note or source.' });
	}

	const { data: note, error: noteErr } = await supabase
		.from('study_notes')
		.select('id, paper_id, sermon_id')
		.eq('id', noteId)
		.is('deleted_at', null)
		.maybeSingle();
	if (noteErr) {
		return fail(500, { kind: 'attachStudyNoteSource' as const, message: noteErr.message });
	}
	const noteRow = note as { id: string; paper_id: string | null; sermon_id: string | null } | null;
	if (!noteRow) return fail(404, { kind: 'attachStudyNoteSource' as const, message: 'Note not found.' });

	const parent: StudyParent = noteRow.paper_id
		? { kind: 'paper', id: noteRow.paper_id }
		: { kind: 'sermon', id: noteRow.sermon_id ?? '' };
	if (!parent.id) {
		return fail(400, { kind: 'attachStudyNoteSource' as const, message: 'Note has no study.' });
	}

	const loaded = await loadLiveSource(supabase, sourceId);
	if (loaded.error) return fail(500, { kind: 'attachStudyNoteSource' as const, message: loaded.error });
	if (!loaded.source || !sourceOnParent(loaded.source, parent)) {
		return fail(400, {
			kind: 'attachStudyNoteSource' as const,
			message: 'That source is not on this study.'
		});
	}

	const { error } = await supabase
		.from('study_notes')
		.update({ source_id: sourceId } as never)
		.eq('id', noteId)
		.is('deleted_at', null);
	if (error) {
		console.error('[studies] attachStudyNoteSource', error);
		return fail(500, { kind: 'attachStudyNoteSource' as const, noteId, message: error.message });
	}

	const promoteError = await promoteCandidate(supabase, sourceId);
	if (promoteError) {
		return fail(500, { kind: 'attachStudyNoteSource' as const, noteId, message: promoteError });
	}
	return { kind: 'attachStudyNoteSource' as const, success: true as const, noteId, sourceId };
}

/** Footnote or short-form copy. Never moves a source backwards. */
export async function markSourceCitedAction(supabase: SupabaseClient, fd: FormData) {
	const sourceId = trimOrNull(fd.get('source_id'));
	if (!sourceId || !UUID_RE.test(sourceId)) {
		return fail(400, { kind: 'markSourceCited' as const, message: 'Invalid source.' });
	}
	const { error } = await supabase
		.from('study_sources')
		.update({ usage: 'cited' } as never)
		.eq('id', sourceId)
		.in('usage', ['candidate', 'consulted'])
		.is('deleted_at', null);
	if (error) {
		console.error('[studies] markSourceCited', error);
		return fail(500, { kind: 'markSourceCited' as const, sourceId, message: error.message });
	}
	return { kind: 'markSourceCited' as const, success: true as const, sourceId };
}
