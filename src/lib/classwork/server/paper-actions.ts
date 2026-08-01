import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeTitleKey } from '$lib/library/not-owned-queue';
import { findOrCreatePerson, parseTypedName } from '$lib/library/server/people-actions';
import { PAPER_STATUSES, type PaperStatus } from '$lib/types/classwork';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function trimOrNull(v: FormDataEntryValue | null): string | null {
	if (v === null || v === undefined) return null;
	const t = String(v).trim();
	return t.length > 0 ? t : null;
}

function parsePaperStatus(raw: string | null): PaperStatus | null {
	if (!raw) return null;
	return (PAPER_STATUSES as readonly string[]).includes(raw) ? (raw as PaperStatus) : null;
}

type AssignmentStamp = { course_id: string | null; due_date: string; title: string };

/**
 * P1 stamp + lock: while a paper is linked to an assignment, the assignment's
 * `course_id` / `due_date` are re-stamped on every save; submitted values are
 * ignored. Also enforces the 1:1 (one live paper per assignment).
 */
async function resolveAssignmentStamp(
	supabase: SupabaseClient,
	assignmentId: string,
	excludePaperId: string | null
): Promise<{ ok: true; stamp: AssignmentStamp } | { ok: false; message: string }> {
	if (!UUID_RE.test(assignmentId)) {
		return { ok: false, message: 'Invalid assignment.' };
	}

	const { data: assignment, error } = await supabase
		.from('assignments')
		.select('id, course_id, due_date, title')
		.eq('id', assignmentId)
		.is('deleted_at', null)
		.maybeSingle();

	if (error) {
		console.error('[papers] resolveAssignmentStamp', error);
		return { ok: false, message: error.message };
	}
	if (!assignment) {
		return { ok: false, message: 'Assignment not found.' };
	}

	let linkedQuery = supabase
		.from('papers')
		.select('id')
		.eq('assignment_id', assignmentId)
		.is('deleted_at', null);
	if (excludePaperId) linkedQuery = linkedQuery.neq('id', excludePaperId);
	const { data: linked, error: linkedErr } = await linkedQuery.limit(1);

	if (linkedErr) {
		console.error('[papers] assignment link check', linkedErr);
		return { ok: false, message: linkedErr.message };
	}
	if ((linked ?? []).length > 0) {
		return { ok: false, message: 'That assignment already has a research paper.' };
	}

	const a = assignment as { course_id: string; due_date: string; title: string };
	return {
		ok: true,
		stamp: { course_id: a.course_id, due_date: a.due_date, title: a.title }
	};
}

// ─── Papers ────────────────────────────────────────────────────────────────

export async function createPaperAction(supabase: SupabaseClient, userId: string, fd: FormData) {
	const title = trimOrNull(fd.get('title'));
	if (!title) {
		return fail(400, { kind: 'createPaper' as const, message: 'Title is required.' });
	}

	const statusRaw = trimOrNull(fd.get('status')) ?? 'draft';
	const status = parsePaperStatus(statusRaw);
	if (!status) {
		return fail(400, { kind: 'createPaper' as const, message: 'Invalid status.' });
	}

	const assignment_id = trimOrNull(fd.get('assignment_id'));
	let course_id = trimOrNull(fd.get('course_id'));
	let due_date = trimOrNull(fd.get('due_date'));

	if (course_id && !UUID_RE.test(course_id)) {
		return fail(400, { kind: 'createPaper' as const, message: 'Invalid course.' });
	}
	if (due_date && !DATE_RE.test(due_date)) {
		return fail(400, { kind: 'createPaper' as const, message: 'Invalid due date.' });
	}

	if (assignment_id) {
		const stamp = await resolveAssignmentStamp(supabase, assignment_id, null);
		if (!stamp.ok) {
			return fail(400, { kind: 'createPaper' as const, message: stamp.message });
		}
		course_id = stamp.stamp.course_id;
		due_date = stamp.stamp.due_date;
	}

	const { data: inserted, error: insErr } = await supabase
		.from('papers')
		.insert({
			title,
			status,
			course_id,
			assignment_id,
			due_date,
			topic: trimOrNull(fd.get('topic')),
			passage_display: trimOrNull(fd.get('passage_display')),
			notes: trimOrNull(fd.get('notes')),
			created_by: userId
		} as never)
		.select('id')
		.single();

	if (insErr || !inserted) {
		console.error('[papers] createPaper', insErr);
		return fail(500, {
			kind: 'createPaper' as const,
			message: insErr?.message ?? 'Could not create paper.'
		});
	}

	return {
		kind: 'createPaper' as const,
		success: true as const,
		paperId: (inserted as { id: string }).id
	};
}

export async function updatePaperAction(supabase: SupabaseClient, fd: FormData) {
	const paperId = trimOrNull(fd.get('paper_id'));
	if (!paperId || !UUID_RE.test(paperId)) {
		return fail(400, { kind: 'updatePaper' as const, message: 'Invalid paper.' });
	}

	const title = trimOrNull(fd.get('title'));
	if (!title) {
		return fail(400, { kind: 'updatePaper' as const, paperId, message: 'Title is required.' });
	}

	const statusRaw = trimOrNull(fd.get('status')) ?? 'draft';
	const status = parsePaperStatus(statusRaw);
	if (!status) {
		return fail(400, { kind: 'updatePaper' as const, paperId, message: 'Invalid status.' });
	}

	const assignment_id = trimOrNull(fd.get('assignment_id'));
	let course_id = trimOrNull(fd.get('course_id'));
	let due_date = trimOrNull(fd.get('due_date'));

	if (course_id && !UUID_RE.test(course_id)) {
		return fail(400, { kind: 'updatePaper' as const, paperId, message: 'Invalid course.' });
	}
	if (due_date && !DATE_RE.test(due_date)) {
		return fail(400, { kind: 'updatePaper' as const, paperId, message: 'Invalid due date.' });
	}

	if (assignment_id) {
		const stamp = await resolveAssignmentStamp(supabase, assignment_id, paperId);
		if (!stamp.ok) {
			return fail(400, { kind: 'updatePaper' as const, paperId, message: stamp.message });
		}
		course_id = stamp.stamp.course_id;
		due_date = stamp.stamp.due_date;
	}

	const { error: updErr } = await supabase
		.from('papers')
		.update({
			title,
			status,
			course_id,
			assignment_id,
			due_date,
			topic: trimOrNull(fd.get('topic')),
			passage_display: trimOrNull(fd.get('passage_display')),
			notes: trimOrNull(fd.get('notes'))
		} as never)
		.eq('id', paperId)
		.is('deleted_at', null);

	if (updErr) {
		console.error('[papers] updatePaper', updErr);
		return fail(500, { kind: 'updatePaper' as const, paperId, message: updErr.message });
	}

	return { kind: 'updatePaper' as const, success: true as const, paperId };
}

/** Soft-delete the paper and its live sources + research groups together. */
export async function softDeletePaperAction(supabase: SupabaseClient, fd: FormData) {
	const paperId = trimOrNull(fd.get('paper_id'));
	if (!paperId || !UUID_RE.test(paperId)) {
		return fail(400, { kind: 'softDeletePaper' as const, message: 'Invalid paper.' });
	}

	const now = new Date().toISOString();

	const { error: srcErr } = await supabase
		.from('paper_sources')
		.update({ deleted_at: now } as never)
		.eq('paper_id', paperId)
		.is('deleted_at', null);
	if (srcErr) {
		console.error('[papers] softDeletePaper sources', srcErr);
		return fail(500, { kind: 'softDeletePaper' as const, paperId, message: srcErr.message });
	}

	const { error: grpErr } = await supabase
		.from('paper_research_groups')
		.update({ deleted_at: now } as never)
		.eq('paper_id', paperId)
		.is('deleted_at', null);
	if (grpErr) {
		console.error('[papers] softDeletePaper groups', grpErr);
		return fail(500, { kind: 'softDeletePaper' as const, paperId, message: grpErr.message });
	}

	const { error: delErr } = await supabase
		.from('papers')
		.update({ deleted_at: now } as never)
		.eq('id', paperId)
		.is('deleted_at', null);
	if (delErr) {
		console.error('[papers] softDeletePaper', delErr);
		return fail(500, { kind: 'softDeletePaper' as const, paperId, message: delErr.message });
	}

	return { kind: 'softDeletePaper' as const, success: true as const, paperId };
}

/**
 * Create-or-open the 1:1 research paper for an assignment (Q14 dual entry).
 * Never auto-created elsewhere — this is the only assignment-side path.
 */
export async function openResearchPaperAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const assignmentId = trimOrNull(fd.get('assignment_id'));
	if (!assignmentId || !UUID_RE.test(assignmentId)) {
		return fail(400, { kind: 'openResearchPaper' as const, message: 'Invalid assignment.' });
	}

	const { data: existing, error: existErr } = await supabase
		.from('papers')
		.select('id')
		.eq('assignment_id', assignmentId)
		.is('deleted_at', null)
		.maybeSingle();

	if (existErr) {
		console.error('[papers] openResearchPaper lookup', existErr);
		return fail(500, { kind: 'openResearchPaper' as const, message: existErr.message });
	}
	if (existing) {
		return {
			kind: 'openResearchPaper' as const,
			success: true as const,
			paperId: (existing as { id: string }).id,
			created: false as const
		};
	}

	const stamp = await resolveAssignmentStamp(supabase, assignmentId, null);
	if (!stamp.ok) {
		return fail(400, { kind: 'openResearchPaper' as const, message: stamp.message });
	}

	const { data: inserted, error: insErr } = await supabase
		.from('papers')
		.insert({
			title: stamp.stamp.title,
			status: 'draft',
			course_id: stamp.stamp.course_id,
			assignment_id: assignmentId,
			due_date: stamp.stamp.due_date,
			created_by: userId
		} as never)
		.select('id')
		.single();

	if (insErr || !inserted) {
		console.error('[papers] openResearchPaper create', insErr);
		return fail(500, {
			kind: 'openResearchPaper' as const,
			message: insErr?.message ?? 'Could not create paper.'
		});
	}

	return {
		kind: 'openResearchPaper' as const,
		success: true as const,
		paperId: (inserted as { id: string }).id,
		created: true as const
	};
}

// ─── Sources ───────────────────────────────────────────────────────────────

/**
 * Revive-or-insert per footgun NEW-D: the live partial unique on
 * `(paper_id, book_id|essay_id)` is not an upsert conflict target, so we
 * pre-load any prior row (incl. soft-deleted) and revive by PK.
 */
async function attachSource(
	supabase: SupabaseClient,
	userId: string,
	paperId: string,
	target: { book_id: string | null; essay_id: string | null }
): Promise<{ ok: true; sourceId: string; revived: boolean } | { ok: false; message: string }> {
	const col = target.book_id ? 'book_id' : 'essay_id';
	const val = target.book_id ?? target.essay_id!;

	const { data: existingRows, error: existErr } = await supabase
		.from('paper_sources')
		.select('id, deleted_at')
		.eq('paper_id', paperId)
		.eq(col, val)
		.order('created_at', { ascending: false });

	if (existErr) {
		console.error('[papers] attachSource lookup', existErr);
		return { ok: false, message: existErr.message };
	}

	const rows = (existingRows ?? []) as { id: string; deleted_at: string | null }[];
	const live = rows.find((r) => r.deleted_at === null);
	if (live) {
		return { ok: false, message: 'Already attached to this paper.' };
	}

	const dead = rows[0];
	if (dead) {
		const { error: reviveErr } = await supabase
			.from('paper_sources')
			.update({ deleted_at: null, group_id: null } as never)
			.eq('id', dead.id);
		if (reviveErr) {
			console.error('[papers] attachSource revive', reviveErr);
			return { ok: false, message: reviveErr.message };
		}
		return { ok: true, sourceId: dead.id, revived: true };
	}

	const { data: inserted, error: insErr } = await supabase
		.from('paper_sources')
		.insert({
			paper_id: paperId,
			book_id: target.book_id,
			essay_id: target.essay_id,
			created_by: userId
		} as never)
		.select('id')
		.single();

	if (insErr || !inserted) {
		console.error('[papers] attachSource insert', insErr);
		return { ok: false, message: insErr?.message ?? 'Could not attach source.' };
	}
	return { ok: true, sourceId: (inserted as { id: string }).id, revived: false };
}

async function assertPaperLive(
	supabase: SupabaseClient,
	paperId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
	const { data, error } = await supabase
		.from('papers')
		.select('id')
		.eq('id', paperId)
		.is('deleted_at', null)
		.maybeSingle();
	if (error) {
		console.error('[papers] assertPaperLive', error);
		return { ok: false, message: error.message };
	}
	if (!data) return { ok: false, message: 'Paper not found.' };
	return { ok: true };
}

export async function addPaperSourceAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const paperId = trimOrNull(fd.get('paper_id'));
	if (!paperId || !UUID_RE.test(paperId)) {
		return fail(400, { kind: 'addPaperSource' as const, message: 'Invalid paper.' });
	}

	const book_id = trimOrNull(fd.get('book_id'));
	const essay_id = trimOrNull(fd.get('essay_id'));
	const provided = [book_id, essay_id].filter((v) => v !== null);
	if (provided.length !== 1 || !UUID_RE.test(provided[0]!)) {
		return fail(400, {
			kind: 'addPaperSource' as const,
			paperId,
			message: 'Pick exactly one book or essay.'
		});
	}

	const paperOk = await assertPaperLive(supabase, paperId);
	if (!paperOk.ok) {
		return fail(400, { kind: 'addPaperSource' as const, paperId, message: paperOk.message });
	}

	const table = book_id ? 'books' : 'essays';
	const targetId = book_id ?? essay_id!;
	const { data: target, error: targetErr } = await supabase
		.from(table)
		.select('id')
		.eq('id', targetId)
		.is('deleted_at', null)
		.maybeSingle();
	if (targetErr) {
		console.error('[papers] addPaperSource target', targetErr);
		return fail(500, { kind: 'addPaperSource' as const, paperId, message: targetErr.message });
	}
	if (!target) {
		return fail(404, {
			kind: 'addPaperSource' as const,
			paperId,
			message: book_id ? 'Book not found.' : 'Essay not found.'
		});
	}

	const attached = await attachSource(supabase, userId, paperId, {
		book_id,
		essay_id
	});
	if (!attached.ok) {
		return fail(400, { kind: 'addPaperSource' as const, paperId, message: attached.message });
	}

	return {
		kind: 'addPaperSource' as const,
		success: true as const,
		paperId,
		sourceId: attached.sourceId
	};
}

export async function updatePaperSourceNotesAction(supabase: SupabaseClient, fd: FormData) {
	const sourceId = trimOrNull(fd.get('source_id'));
	if (!sourceId || !UUID_RE.test(sourceId)) {
		return fail(400, { kind: 'updatePaperSourceNotes' as const, message: 'Invalid source.' });
	}

	const { error } = await supabase
		.from('paper_sources')
		.update({ notes: trimOrNull(fd.get('notes')) } as never)
		.eq('id', sourceId)
		.is('deleted_at', null);

	if (error) {
		console.error('[papers] updatePaperSourceNotes', error);
		return fail(500, {
			kind: 'updatePaperSourceNotes' as const,
			sourceId,
			message: error.message
		});
	}

	return { kind: 'updatePaperSourceNotes' as const, success: true as const, sourceId };
}

export async function removePaperSourceAction(supabase: SupabaseClient, fd: FormData) {
	const sourceId = trimOrNull(fd.get('source_id'));
	if (!sourceId || !UUID_RE.test(sourceId)) {
		return fail(400, { kind: 'removePaperSource' as const, message: 'Invalid source.' });
	}

	const { error } = await supabase
		.from('paper_sources')
		.update({ deleted_at: new Date().toISOString() } as never)
		.eq('id', sourceId)
		.is('deleted_at', null);

	if (error) {
		console.error('[papers] removePaperSource', error);
		return fail(500, { kind: 'removePaperSource' as const, sourceId, message: error.message });
	}

	return { kind: 'removePaperSource' as const, success: true as const, sourceId };
}

/**
 * Free-form not-owned stub ([103] pattern, free-text instead of the curated
 * queue): create `books` row with `owned=false`, `needs_review=false`,
 * optional author + year, then attach to the paper. If a live book already
 * matches the normalized title, attach that instead of duplicating.
 */
export async function createNotOwnedSourceAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const paperId = trimOrNull(fd.get('paper_id'));
	if (!paperId || !UUID_RE.test(paperId)) {
		return fail(400, { kind: 'createNotOwnedSource' as const, message: 'Invalid paper.' });
	}

	const title = trimOrNull(fd.get('title'));
	if (!title) {
		return fail(400, {
			kind: 'createNotOwnedSource' as const,
			paperId,
			message: 'Title is required.'
		});
	}

	const yearRaw = trimOrNull(fd.get('year'));
	let year: number | null = null;
	if (yearRaw) {
		const parsed = Number.parseInt(yearRaw, 10);
		if (!Number.isFinite(parsed) || parsed < 1000 || parsed > 2100) {
			return fail(400, {
				kind: 'createNotOwnedSource' as const,
				paperId,
				message: 'Invalid year.'
			});
		}
		year = parsed;
	}

	const paperOk = await assertPaperLive(supabase, paperId);
	if (!paperOk.ok) {
		return fail(400, {
			kind: 'createNotOwnedSource' as const,
			paperId,
			message: paperOk.message
		});
	}

	// Dedupe against live catalog by normalized title (queue-stub precedent).
	const titleNorm = normalizeTitleKey(title);
	const { data: existingBooks, error: existErr } = await supabase
		.from('books')
		.select('id, title')
		.is('deleted_at', null)
		.limit(5000);
	if (existErr) {
		console.error('[papers] createNotOwnedSource existing', existErr);
		return fail(500, {
			kind: 'createNotOwnedSource' as const,
			paperId,
			message: existErr.message
		});
	}
	const already = (existingBooks ?? []).find(
		(r) => normalizeTitleKey(String((r as { title: string | null }).title ?? '')) === titleNorm
	);

	let bookId: string;
	let alreadyExisted = false;

	if (already) {
		bookId = (already as { id: string }).id;
		alreadyExisted = true;
	} else {
		const { data: bookRow, error: insErr } = await supabase
			.from('books')
			.insert({
				title,
				owned: false,
				needs_review: false,
				needs_review_note: null,
				language: 'english',
				reading_status: 'unread',
				work_type: 'monograph',
				copy_count: 1,
				year,
				created_by: userId
			} as never)
			.select('id')
			.single();

		if (insErr || !bookRow) {
			console.error('[papers] createNotOwnedSource insert', insErr);
			return fail(500, {
				kind: 'createNotOwnedSource' as const,
				paperId,
				message: insErr?.message ?? 'Could not create stub.'
			});
		}
		bookId = (bookRow as { id: string }).id;

		const author = trimOrNull(fd.get('author'));
		if (author) {
			const parsed = parseTypedName(author);
			if (parsed) {
				try {
					const { personId } = await findOrCreatePerson(supabase, parsed, userId);
					const { error: authErr } = await supabase.from('book_authors').insert({
						book_id: bookId,
						person_id: personId,
						role: 'author',
						sort_order: 0
					} as never);
					if (authErr) console.error('[papers] createNotOwnedSource author', authErr);
				} catch (e) {
					console.error('[papers] createNotOwnedSource person', e);
				}
			}
		}
	}

	const attached = await attachSource(supabase, userId, paperId, {
		book_id: bookId,
		essay_id: null
	});
	if (!attached.ok) {
		return fail(400, {
			kind: 'createNotOwnedSource' as const,
			paperId,
			message: alreadyExisted
				? `“${title}” is already in the catalog and ${attached.message.toLowerCase()}`
				: attached.message
		});
	}

	return {
		kind: 'createNotOwnedSource' as const,
		success: true as const,
		paperId,
		bookId,
		sourceId: attached.sourceId,
		alreadyExisted
	};
}
