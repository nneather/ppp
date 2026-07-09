import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ymdInChicago } from '$lib/invoicing/chicago-date';
import { TASK_PRIORITIES, type TaskPriority } from '$lib/types/projects';
import { parseYmd } from '$lib/projects/week';

export type TaskActionKind =
	| 'createTask'
	| 'updateTask'
	| 'completeTask'
	| 'uncompleteTask'
	| 'deferTask'
	| 'promoteTask'
	| 'softDeleteTask'
	| 'undoSoftDeleteTask';

const PRIORITY_SET: ReadonlySet<string> = new Set(TASK_PRIORITIES);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUuid(raw: FormDataEntryValue | null): string | null {
	const t = String(raw ?? '').trim();
	return UUID_RE.test(t) ? t : null;
}

function parsePriority(raw: FormDataEntryValue | null): TaskPriority | null {
	const t = String(raw ?? '').trim();
	return PRIORITY_SET.has(t) ? (t as TaskPriority) : null;
}

function parseDateOrNull(raw: FormDataEntryValue | null): string | null {
	const t = String(raw ?? '').trim();
	if (!t) return null;
	return parseYmd(t) ? t : null;
}

function trimTitle(raw: FormDataEntryValue | null): string | null {
	const t = String(raw ?? '').trim();
	if (!t) return null;
	if (t.length > 500) return null;
	return t;
}

const NOTES_MAX = 10_000;

function parseNotes(raw: FormDataEntryValue | null): string | null {
	const t = String(raw ?? '').trim();
	if (!t) return null;
	if (t.length > NOTES_MAX) return t.slice(0, NOTES_MAX);
	return t;
}

export async function createTaskAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const project_id = parseUuid(fd.get('project_id'));
	if (!project_id) {
		return fail(400, { kind: 'createTask' as const, message: 'Project is required.' });
	}

	const title = trimTitle(fd.get('title'));
	if (!title) {
		return fail(400, { kind: 'createTask' as const, message: 'Title is required.' });
	}

	const priority = parsePriority(fd.get('priority')) ?? 'opportunity_now';
	const start_date = parseDateOrNull(fd.get('start_date')) ?? ymdInChicago();
	const notes = parseNotes(fd.get('notes'));

	const { data, error } = await supabase
		.from('project_tasks')
		.insert({
			project_id,
			title,
			priority,
			start_date,
			notes,
			created_by: userId
		} as never)
		.select('id')
		.single();

	if (error || !data) {
		console.error('createTaskAction', error);
		return fail(500, {
			kind: 'createTask' as const,
			message: error?.message ?? 'Could not create task.'
		});
	}

	return { kind: 'createTask' as const, success: true as const, taskId: data.id };
}

export async function updateTaskAction(supabase: SupabaseClient, fd: FormData) {
	const id = parseUuid(fd.get('id'));
	if (!id) return fail(400, { kind: 'updateTask' as const, message: 'Missing task id.' });

	const title = trimTitle(fd.get('title'));
	if (!title) {
		return fail(400, {
			kind: 'updateTask' as const,
			taskId: id,
			message: 'Title is required.'
		});
	}

	const priority = parsePriority(fd.get('priority'));
	if (!priority) {
		return fail(400, {
			kind: 'updateTask' as const,
			taskId: id,
			message: 'Invalid priority zone.'
		});
	}

	const start_date = parseDateOrNull(fd.get('start_date'));
	if (!start_date) {
		return fail(400, {
			kind: 'updateTask' as const,
			taskId: id,
			message: 'Valid start date is required.'
		});
	}

	const project_id = parseUuid(fd.get('project_id'));
	if (!project_id) {
		return fail(400, {
			kind: 'updateTask' as const,
			taskId: id,
			message: 'Project is required.'
		});
	}

	const notes = parseNotes(fd.get('notes'));

	const { error } = await supabase
		.from('project_tasks')
		.update({
			title,
			priority,
			start_date,
			project_id,
			notes
		} as never)
		.eq('id', id);

	if (error) {
		console.error('updateTaskAction', error);
		return fail(500, {
			kind: 'updateTask' as const,
			taskId: id,
			message: error.message ?? 'Could not update task.'
		});
	}

	return { kind: 'updateTask' as const, taskId: id, success: true as const };
}

export async function completeTaskAction(supabase: SupabaseClient, fd: FormData) {
	const id = parseUuid(fd.get('id'));
	if (!id) return fail(400, { kind: 'completeTask' as const, message: 'Missing task id.' });

	const { error } = await supabase
		.from('project_tasks')
		.update({ completed_at: new Date().toISOString() } as never)
		.eq('id', id);

	if (error) {
		console.error('completeTaskAction', error);
		return fail(500, {
			kind: 'completeTask' as const,
			taskId: id,
			message: error.message ?? 'Could not complete task.'
		});
	}

	return { kind: 'completeTask' as const, taskId: id, success: true as const };
}

export async function uncompleteTaskAction(supabase: SupabaseClient, fd: FormData) {
	const id = parseUuid(fd.get('id'));
	if (!id) return fail(400, { kind: 'uncompleteTask' as const, message: 'Missing task id.' });

	const { error } = await supabase
		.from('project_tasks')
		.update({ completed_at: null } as never)
		.eq('id', id);

	if (error) {
		console.error('uncompleteTaskAction', error);
		return fail(500, {
			kind: 'uncompleteTask' as const,
			taskId: id,
			message: error.message ?? 'Could not reopen task.'
		});
	}

	return { kind: 'uncompleteTask' as const, taskId: id, success: true as const };
}

export async function promoteTaskAction(supabase: SupabaseClient, fd: FormData) {
	const id = parseUuid(fd.get('id'));
	if (!id) return fail(400, { kind: 'promoteTask' as const, message: 'Missing task id.' });

	const today = ymdInChicago();
	const { error } = await supabase
		.from('project_tasks')
		.update({ start_date: today } as never)
		.eq('id', id);

	if (error) {
		console.error('promoteTaskAction', error);
		return fail(500, {
			kind: 'promoteTask' as const,
			taskId: id,
			message: error.message ?? 'Could not promote task.'
		});
	}

	return { kind: 'promoteTask' as const, taskId: id, success: true as const };
}

export async function deferTaskAction(supabase: SupabaseClient, fd: FormData) {
	const id = parseUuid(fd.get('id'));
	if (!id) return fail(400, { kind: 'deferTask' as const, message: 'Missing task id.' });

	const priority = parsePriority(fd.get('priority'));
	if (!priority) {
		return fail(400, {
			kind: 'deferTask' as const,
			taskId: id,
			message: 'Invalid priority zone.'
		});
	}

	const start_date = parseDateOrNull(fd.get('start_date'));
	if (!start_date) {
		return fail(400, {
			kind: 'deferTask' as const,
			taskId: id,
			message: 'Valid defer date is required.'
		});
	}

	const today = ymdInChicago();
	if (start_date <= today) {
		return fail(400, {
			kind: 'deferTask' as const,
			taskId: id,
			message: 'Defer date must be in the future.'
		});
	}

	const { error } = await supabase
		.from('project_tasks')
		.update({ priority, start_date, completed_at: null } as never)
		.eq('id', id);

	if (error) {
		console.error('deferTaskAction', error);
		return fail(500, {
			kind: 'deferTask' as const,
			taskId: id,
			message: error.message ?? 'Could not defer task.'
		});
	}

	return { kind: 'deferTask' as const, taskId: id, success: true as const };
}

export async function softDeleteTaskAction(supabase: SupabaseClient, fd: FormData) {
	const id = parseUuid(fd.get('id'));
	if (!id) return fail(400, { kind: 'softDeleteTask' as const, message: 'Missing task id.' });

	const { error } = await supabase
		.from('project_tasks')
		.update({ deleted_at: new Date().toISOString() } as never)
		.eq('id', id);

	if (error) {
		console.error('softDeleteTaskAction', error);
		return fail(500, {
			kind: 'softDeleteTask' as const,
			taskId: id,
			message: error.message ?? 'Could not delete task.'
		});
	}

	return { kind: 'softDeleteTask' as const, taskId: id, success: true as const };
}

export async function undoSoftDeleteTaskAction(supabase: SupabaseClient, fd: FormData) {
	const id = parseUuid(fd.get('id'));
	if (!id) {
		return fail(400, { kind: 'undoSoftDeleteTask' as const, message: 'Missing task id.' });
	}

	const { error } = await supabase
		.from('project_tasks')
		.update({ deleted_at: null } as never)
		.eq('id', id);

	if (error) {
		console.error('undoSoftDeleteTaskAction', error);
		return fail(500, {
			kind: 'undoSoftDeleteTask' as const,
			taskId: id,
			message: error.message ?? 'Could not restore task.'
		});
	}

	return { kind: 'undoSoftDeleteTask' as const, taskId: id, success: true as const };
}
