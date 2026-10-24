import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	attachStudyNoteSourceAction,
	createStudyNoteAction,
	markSourceCitedAction,
	softDeleteStudyNoteAction,
	updateStudyNoteAction
} from '$lib/studies/server/note-actions';

const NOTE_ACTIONS = [
	'createStudyNote',
	'updateStudyNote',
	'softDeleteStudyNote',
	'attachStudyNoteSource',
	'markSourceCited'
] as const;

export type StudyNoteActionName = (typeof NOTE_ACTIONS)[number];

type NoteEvent = {
	request: Request;
	locals: {
		safeGetSession: () => Promise<{ user: { id: string } | null }>;
		supabase: SupabaseClient;
	};
};

export async function runStudyNoteAction(kind: StudyNoteActionName, event: NoteEvent) {
	const { user } = await event.locals.safeGetSession();
	if (!user) return fail(401, { kind, message: 'Unauthorized' });
	const fd = await event.request.formData();
	const supabase = event.locals.supabase;
	if (kind === 'createStudyNote') return createStudyNoteAction(supabase, user.id, fd);
	if (kind === 'updateStudyNote') return updateStudyNoteAction(supabase, fd);
	if (kind === 'softDeleteStudyNote') return softDeleteStudyNoteAction(supabase, fd);
	if (kind === 'attachStudyNoteSource') return attachStudyNoteSourceAction(supabase, fd);
	return markSourceCitedAction(supabase, fd);
}
