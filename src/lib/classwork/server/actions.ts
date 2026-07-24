import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	ASSIGNMENT_KINDS,
	ASSIGNMENT_STATUSES,
	COURSE_STATUSES,
	type AssignmentKind,
	type AssignmentStatus,
	type CourseStatus
} from '$lib/types/classwork';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function trimOrNull(v: FormDataEntryValue | null): string | null {
	if (v === null || v === undefined) return null;
	const t = String(v).trim();
	return t.length > 0 ? t : null;
}

function parseCourseStatus(raw: string | null): CourseStatus | null {
	if (!raw) return null;
	return (COURSE_STATUSES as readonly string[]).includes(raw) ? (raw as CourseStatus) : null;
}

function parseAssignmentKind(raw: string | null): AssignmentKind | null {
	if (!raw) return null;
	return (ASSIGNMENT_KINDS as readonly string[]).includes(raw) ? (raw as AssignmentKind) : null;
}

function parseAssignmentStatus(raw: string | null): AssignmentStatus | null {
	if (!raw) return null;
	return (ASSIGNMENT_STATUSES as readonly string[]).includes(raw)
		? (raw as AssignmentStatus)
		: null;
}

type AssignmentParentRow = {
	id: string;
	course_id: string;
	parent_id: string | null;
};

async function loadLiveAssignments(
	supabase: SupabaseClient,
	courseId?: string
): Promise<AssignmentParentRow[]> {
	let q = supabase
		.from('assignments')
		.select('id, course_id, parent_id')
		.is('deleted_at', null);
	if (courseId) q = q.eq('course_id', courseId);
	const { data, error } = await q;
	if (error) {
		console.error('[classwork] loadLiveAssignments', error);
		return [];
	}
	return (data ?? []) as AssignmentParentRow[];
}

function collectAssignmentDescendantIds(
	rows: AssignmentParentRow[],
	rootId: string
): Set<string> {
	const childrenByParent = new Map<string, string[]>();
	for (const r of rows) {
		if (r.parent_id == null) continue;
		const list = childrenByParent.get(r.parent_id);
		if (list) list.push(r.id);
		else childrenByParent.set(r.parent_id, [r.id]);
	}
	const out = new Set<string>();
	const stack = [...(childrenByParent.get(rootId) ?? [])];
	while (stack.length > 0) {
		const id = stack.pop()!;
		if (out.has(id)) continue;
		out.add(id);
		const kids = childrenByParent.get(id);
		if (kids) stack.push(...kids);
	}
	return out;
}

async function assertParentOk(
	supabase: SupabaseClient,
	opts: {
		assignmentId: string | null;
		courseId: string;
		parentId: string | null;
	}
): Promise<{ ok: true } | { ok: false; message: string }> {
	if (opts.parentId == null) return { ok: true };
	if (!UUID_RE.test(opts.parentId)) {
		return { ok: false, message: 'Invalid parent assignment.' };
	}
	if (opts.assignmentId && opts.parentId === opts.assignmentId) {
		return { ok: false, message: 'An assignment cannot be its own parent.' };
	}

	const { data: parent, error } = await supabase
		.from('assignments')
		.select('id, course_id, parent_id')
		.eq('id', opts.parentId)
		.is('deleted_at', null)
		.maybeSingle();

	if (error) {
		console.error('[classwork] assertParentOk load', error);
		return { ok: false, message: error.message };
	}
	if (!parent) {
		return { ok: false, message: 'Parent assignment not found.' };
	}
	const p = parent as AssignmentParentRow;
	if (p.course_id !== opts.courseId) {
		return { ok: false, message: 'Parent must be in the same course.' };
	}

	if (opts.assignmentId) {
		const rows = await loadLiveAssignments(supabase, opts.courseId);
		const descendants = collectAssignmentDescendantIds(rows, opts.assignmentId);
		if (descendants.has(opts.parentId)) {
			return {
				ok: false,
				message: 'Cannot set parent to a descendant — that would create a cycle.'
			};
		}
	}

	return { ok: true };
}

function completedAtForStatus(
	status: AssignmentStatus,
	previousStatus: AssignmentStatus | null
): string | null | undefined {
	if (status === 'done') {
		if (previousStatus === 'done') return undefined; // keep existing stamp
		return new Date().toISOString();
	}
	if (previousStatus === 'done') return null; // clear when leaving done
	return undefined;
}

// ─── Courses ───────────────────────────────────────────────────────────────

export async function createCourseAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const name = trimOrNull(fd.get('name'));
	if (!name) {
		return fail(400, { kind: 'createCourse' as const, message: 'Course name is required.' });
	}

	const statusRaw = trimOrNull(fd.get('status')) ?? 'active';
	const status = parseCourseStatus(statusRaw);
	if (!status) {
		return fail(400, { kind: 'createCourse' as const, message: 'Invalid status.' });
	}

	const project_id = trimOrNull(fd.get('project_id'));
	if (project_id && !UUID_RE.test(project_id)) {
		return fail(400, { kind: 'createCourse' as const, message: 'Invalid project.' });
	}

	const { data: inserted, error: insErr } = await supabase
		.from('courses')
		.insert({
			name,
			code: trimOrNull(fd.get('code')),
			instructor: trimOrNull(fd.get('instructor')),
			term: trimOrNull(fd.get('term')),
			status,
			project_id,
			notes: trimOrNull(fd.get('notes')),
			created_by: userId
		} as never)
		.select('id')
		.single();

	if (insErr || !inserted) {
		console.error('[classwork] createCourse', insErr);
		return fail(500, {
			kind: 'createCourse' as const,
			message: insErr?.message ?? 'Could not create course.'
		});
	}

	return {
		kind: 'createCourse' as const,
		success: true as const,
		courseId: (inserted as { id: string }).id
	};
}

export async function updateCourseAction(
	supabase: SupabaseClient,
	fd: FormData
) {
	const courseId = trimOrNull(fd.get('course_id'));
	if (!courseId || !UUID_RE.test(courseId)) {
		return fail(400, { kind: 'updateCourse' as const, message: 'Invalid course.' });
	}

	const name = trimOrNull(fd.get('name'));
	if (!name) {
		return fail(400, {
			kind: 'updateCourse' as const,
			courseId,
			message: 'Course name is required.'
		});
	}

	const statusRaw = trimOrNull(fd.get('status')) ?? 'active';
	const status = parseCourseStatus(statusRaw);
	if (!status) {
		return fail(400, {
			kind: 'updateCourse' as const,
			courseId,
			message: 'Invalid status.'
		});
	}

	const project_id = trimOrNull(fd.get('project_id'));
	if (project_id && !UUID_RE.test(project_id)) {
		return fail(400, {
			kind: 'updateCourse' as const,
			courseId,
			message: 'Invalid project.'
		});
	}

	const { error: updErr } = await supabase
		.from('courses')
		.update({
			name,
			code: trimOrNull(fd.get('code')),
			instructor: trimOrNull(fd.get('instructor')),
			term: trimOrNull(fd.get('term')),
			status,
			project_id,
			notes: trimOrNull(fd.get('notes'))
		} as never)
		.eq('id', courseId)
		.is('deleted_at', null);

	if (updErr) {
		console.error('[classwork] updateCourse', updErr);
		return fail(500, {
			kind: 'updateCourse' as const,
			courseId,
			message: updErr.message
		});
	}

	return { kind: 'updateCourse' as const, success: true as const, courseId };
}

export async function softDeleteCourseAction(supabase: SupabaseClient, fd: FormData) {
	const courseId = trimOrNull(fd.get('course_id'));
	if (!courseId || !UUID_RE.test(courseId)) {
		return fail(400, { kind: 'softDeleteCourse' as const, message: 'Invalid course.' });
	}

	const { count, error: countErr } = await supabase
		.from('assignments')
		.select('id', { count: 'exact', head: true })
		.eq('course_id', courseId)
		.is('deleted_at', null);

	if (countErr) {
		console.error('[classwork] softDeleteCourse count', countErr);
		return fail(500, {
			kind: 'softDeleteCourse' as const,
			courseId,
			message: countErr.message
		});
	}
	if ((count ?? 0) > 0) {
		return fail(400, {
			kind: 'softDeleteCourse' as const,
			courseId,
			message: 'Delete or move assignments before deleting this course.'
		});
	}

	const now = new Date().toISOString();
	const { error: delErr } = await supabase
		.from('courses')
		.update({ deleted_at: now } as never)
		.eq('id', courseId)
		.is('deleted_at', null);

	if (delErr) {
		console.error('[classwork] softDeleteCourse', delErr);
		return fail(500, {
			kind: 'softDeleteCourse' as const,
			courseId,
			message: delErr.message
		});
	}

	return { kind: 'softDeleteCourse' as const, success: true as const, courseId };
}

// ─── Assignments ───────────────────────────────────────────────────────────

export async function createAssignmentAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const course_id = trimOrNull(fd.get('course_id'));
	if (!course_id || !UUID_RE.test(course_id)) {
		return fail(400, { kind: 'createAssignment' as const, message: 'Course is required.' });
	}

	const title = trimOrNull(fd.get('title'));
	if (!title) {
		return fail(400, { kind: 'createAssignment' as const, message: 'Title is required.' });
	}

	const due_date = trimOrNull(fd.get('due_date'));
	if (!due_date || !DATE_RE.test(due_date)) {
		return fail(400, { kind: 'createAssignment' as const, message: 'Due date is required.' });
	}

	const kindRaw = trimOrNull(fd.get('kind')) ?? 'other';
	const kind = parseAssignmentKind(kindRaw);
	if (!kind) {
		return fail(400, { kind: 'createAssignment' as const, message: 'Invalid kind.' });
	}

	const statusRaw = trimOrNull(fd.get('status')) ?? 'not_started';
	const status = parseAssignmentStatus(statusRaw);
	if (!status) {
		return fail(400, { kind: 'createAssignment' as const, message: 'Invalid status.' });
	}

	const parent_id = trimOrNull(fd.get('parent_id'));
	const parentOk = await assertParentOk(supabase, {
		assignmentId: null,
		courseId: course_id,
		parentId: parent_id
	});
	if (!parentOk.ok) {
		return fail(400, { kind: 'createAssignment' as const, message: parentOk.message });
	}

	const completed_at = status === 'done' ? new Date().toISOString() : null;

	const { data: inserted, error: insErr } = await supabase
		.from('assignments')
		.insert({
			course_id,
			parent_id,
			title,
			kind,
			status,
			due_date,
			completed_at,
			notes: trimOrNull(fd.get('notes')),
			created_by: userId
		} as never)
		.select('id')
		.single();

	if (insErr || !inserted) {
		console.error('[classwork] createAssignment', insErr);
		return fail(500, {
			kind: 'createAssignment' as const,
			message: insErr?.message ?? 'Could not create assignment.'
		});
	}

	return {
		kind: 'createAssignment' as const,
		success: true as const,
		assignmentId: (inserted as { id: string }).id
	};
}

export async function updateAssignmentAction(supabase: SupabaseClient, fd: FormData) {
	const assignmentId = trimOrNull(fd.get('assignment_id'));
	if (!assignmentId || !UUID_RE.test(assignmentId)) {
		return fail(400, { kind: 'updateAssignment' as const, message: 'Invalid assignment.' });
	}

	const { data: existing, error: loadErr } = await supabase
		.from('assignments')
		.select('id, course_id, status')
		.eq('id', assignmentId)
		.is('deleted_at', null)
		.maybeSingle();

	if (loadErr) {
		console.error('[classwork] updateAssignment load', loadErr);
		return fail(500, {
			kind: 'updateAssignment' as const,
			assignmentId,
			message: loadErr.message
		});
	}
	if (!existing) {
		return fail(404, {
			kind: 'updateAssignment' as const,
			assignmentId,
			message: 'Assignment not found.'
		});
	}

	const prev = existing as { id: string; course_id: string; status: string };
	const previousStatus = parseAssignmentStatus(prev.status);

	const course_id = trimOrNull(fd.get('course_id')) ?? prev.course_id;
	if (!UUID_RE.test(course_id)) {
		return fail(400, {
			kind: 'updateAssignment' as const,
			assignmentId,
			message: 'Invalid course.'
		});
	}

	const title = trimOrNull(fd.get('title'));
	if (!title) {
		return fail(400, {
			kind: 'updateAssignment' as const,
			assignmentId,
			message: 'Title is required.'
		});
	}

	const due_date = trimOrNull(fd.get('due_date'));
	if (!due_date || !DATE_RE.test(due_date)) {
		return fail(400, {
			kind: 'updateAssignment' as const,
			assignmentId,
			message: 'Due date is required.'
		});
	}

	const kindRaw = trimOrNull(fd.get('kind')) ?? 'other';
	const kind = parseAssignmentKind(kindRaw);
	if (!kind) {
		return fail(400, {
			kind: 'updateAssignment' as const,
			assignmentId,
			message: 'Invalid kind.'
		});
	}

	const statusRaw = trimOrNull(fd.get('status')) ?? 'not_started';
	const status = parseAssignmentStatus(statusRaw);
	if (!status) {
		return fail(400, {
			kind: 'updateAssignment' as const,
			assignmentId,
			message: 'Invalid status.'
		});
	}

	const parent_id = trimOrNull(fd.get('parent_id'));
	const parentOk = await assertParentOk(supabase, {
		assignmentId,
		courseId: course_id,
		parentId: parent_id
	});
	if (!parentOk.ok) {
		return fail(400, {
			kind: 'updateAssignment' as const,
			assignmentId,
			message: parentOk.message
		});
	}

	const patch: Record<string, unknown> = {
		course_id,
		parent_id,
		title,
		kind,
		status,
		due_date,
		notes: trimOrNull(fd.get('notes'))
	};
	const completedPatch = completedAtForStatus(status, previousStatus);
	if (completedPatch !== undefined) {
		patch.completed_at = completedPatch;
	}

	const { error: updErr } = await supabase
		.from('assignments')
		.update(patch as never)
		.eq('id', assignmentId)
		.is('deleted_at', null);

	if (updErr) {
		console.error('[classwork] updateAssignment', updErr);
		return fail(500, {
			kind: 'updateAssignment' as const,
			assignmentId,
			message: updErr.message
		});
	}

	return { kind: 'updateAssignment' as const, success: true as const, assignmentId };
}

export async function softDeleteAssignmentAction(supabase: SupabaseClient, fd: FormData) {
	const assignmentId = trimOrNull(fd.get('assignment_id'));
	if (!assignmentId || !UUID_RE.test(assignmentId)) {
		return fail(400, { kind: 'softDeleteAssignment' as const, message: 'Invalid assignment.' });
	}

	const { count, error: countErr } = await supabase
		.from('assignments')
		.select('id', { count: 'exact', head: true })
		.eq('parent_id', assignmentId)
		.is('deleted_at', null);

	if (countErr) {
		console.error('[classwork] softDeleteAssignment children', countErr);
		return fail(500, {
			kind: 'softDeleteAssignment' as const,
			assignmentId,
			message: countErr.message
		});
	}
	if ((count ?? 0) > 0) {
		return fail(400, {
			kind: 'softDeleteAssignment' as const,
			assignmentId,
			message: 'Clear child milestones before deleting this assignment.'
		});
	}

	const now = new Date().toISOString();
	const { error: delErr } = await supabase
		.from('assignments')
		.update({ deleted_at: now } as never)
		.eq('id', assignmentId)
		.is('deleted_at', null);

	if (delErr) {
		console.error('[classwork] softDeleteAssignment', delErr);
		return fail(500, {
			kind: 'softDeleteAssignment' as const,
			assignmentId,
			message: delErr.message
		});
	}

	return { kind: 'softDeleteAssignment' as const, success: true as const, assignmentId };
}
