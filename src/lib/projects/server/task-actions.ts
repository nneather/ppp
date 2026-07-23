import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ymdInChicago } from '$lib/invoicing/chicago-date';
import { TASK_PRIORITIES, type TaskPriority } from '$lib/types/projects';
import { parseYmd } from '$lib/projects/week';
import {
	nextStartDate,
	parseRecurrenceFormData,
	parseSeriesScope,
	ruleFromSeriesRow,
	seriesHasEnded,
	type RecurrenceRule
} from '$lib/projects/task-recurrence';

export type TaskActionKind =
	| 'createTask'
	| 'updateTask'
	| 'completeTask'
	| 'uncompleteTask'
	| 'deferTask'
	| 'promoteTask'
	| 'raisePriority'
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

type SeriesRow = {
	id: string;
	project_id: string;
	title: string;
	priority: string;
	notes: string | null;
	freq: string;
	interval: number;
	byweekday: number[] | null;
	bymonthday: number | null;
	ends: string;
	ends_count: number | null;
	ends_on: string | null;
	occurrence_seq: number;
	stopped_at: string | null;
	deleted_at: string | null;
};

type TaskRow = {
	id: string;
	project_id: string;
	title: string;
	priority: string;
	start_date: string;
	notes: string | null;
	series_id: string | null;
	series_occurrence: number | null;
	completed_at: string | null;
	deleted_at: string | null;
	created_by: string | null;
};

async function fetchTask(supabase: SupabaseClient, id: string): Promise<TaskRow | null> {
	const { data, error } = await supabase
		.from('project_tasks')
		.select(
			'id, project_id, title, priority, start_date, notes, series_id, series_occurrence, completed_at, deleted_at, created_by'
		)
		.eq('id', id)
		.maybeSingle();
	if (error) {
		console.error('fetchTask', error);
		return null;
	}
	return data as TaskRow | null;
}

async function fetchSeries(supabase: SupabaseClient, id: string): Promise<SeriesRow | null> {
	const { data, error } = await supabase
		.from('project_task_series')
		.select(
			'id, project_id, title, priority, notes, freq, interval, byweekday, bymonthday, ends, ends_count, ends_on, occurrence_seq, stopped_at, deleted_at'
		)
		.eq('id', id)
		.maybeSingle();
	if (error) {
		console.error('fetchSeries', error);
		return null;
	}
	return data as SeriesRow | null;
}

function seriesRule(series: SeriesRow): RecurrenceRule | null {
	return ruleFromSeriesRow(series);
}

async function spawnNextOccurrence(
	supabase: SupabaseClient,
	userId: string | null,
	series: SeriesRow,
	fromStartDate: string
): Promise<{ ok: true } | { ok: false; message: string }> {
	if (series.stopped_at || series.deleted_at) return { ok: true };

	const rule = seriesRule(series);
	if (!rule) return { ok: false, message: 'Invalid series recurrence rule.' };

	const nextOccurrence = series.occurrence_seq + 1;
	const candidate = nextStartDate(rule, fromStartDate);
	if (!candidate) return { ok: false, message: 'Could not compute next occurrence date.' };

	if (seriesHasEnded(rule, nextOccurrence, candidate, series.stopped_at)) {
		return { ok: true };
	}

	if (!PRIORITY_SET.has(series.priority)) {
		return { ok: false, message: 'Series has invalid priority.' };
	}

	const { error: insertError } = await supabase.from('project_tasks').insert({
		project_id: series.project_id,
		title: series.title,
		priority: series.priority,
		start_date: candidate,
		notes: series.notes,
		series_id: series.id,
		series_occurrence: nextOccurrence,
		created_by: userId
	} as never);

	if (insertError) {
		console.error('spawnNextOccurrence insert', insertError);
		return { ok: false, message: insertError.message ?? 'Could not create next occurrence.' };
	}

	const { error: bumpError } = await supabase
		.from('project_task_series')
		.update({ occurrence_seq: nextOccurrence } as never)
		.eq('id', series.id);

	if (bumpError) {
		console.error('spawnNextOccurrence bump', bumpError);
		return { ok: false, message: bumpError.message ?? 'Could not update series sequence.' };
	}

	return { ok: true };
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

	const recurrence = parseRecurrenceFormData(fd);
	if (recurrence && 'error' in recurrence) {
		return fail(400, { kind: 'createTask' as const, message: recurrence.error });
	}

	if (recurrence) {
		const { data: series, error: seriesError } = await supabase
			.from('project_task_series')
			.insert({
				project_id,
				title,
				priority,
				notes,
				freq: recurrence.freq,
				interval: recurrence.interval,
				byweekday: recurrence.byweekday,
				bymonthday: recurrence.bymonthday,
				ends: recurrence.ends,
				ends_count: recurrence.ends_count,
				ends_on: recurrence.ends_on,
				occurrence_seq: 1,
				created_by: userId
			} as never)
			.select('id')
			.single();

		if (seriesError || !series) {
			console.error('createTaskAction series', seriesError);
			return fail(500, {
				kind: 'createTask' as const,
				message: seriesError?.message ?? 'Could not create recurring series.'
			});
		}

		const { data, error } = await supabase
			.from('project_tasks')
			.insert({
				project_id,
				title,
				priority,
				start_date,
				notes,
				series_id: series.id,
				series_occurrence: 1,
				created_by: userId
			} as never)
			.select('id')
			.single();

		if (error || !data) {
			console.error('createTaskAction task', error);
			await supabase
				.from('project_task_series')
				.update({ deleted_at: new Date().toISOString() } as never)
				.eq('id', series.id);
			return fail(500, {
				kind: 'createTask' as const,
				message: error?.message ?? 'Could not create task.'
			});
		}

		return { kind: 'createTask' as const, success: true as const, taskId: data.id };
	}

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

	const task = await fetchTask(supabase, id);
	if (!task || task.deleted_at) {
		return fail(404, {
			kind: 'updateTask' as const,
			taskId: id,
			message: 'Task not found.'
		});
	}

	if (task.series_id) {
		const scope = parseSeriesScope(fd.get('scope'));
		if (!scope) {
			return fail(400, {
				kind: 'updateTask' as const,
				taskId: id,
				message: 'Choose This task or Entire series.'
			});
		}

		if (scope === 'this') {
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
				console.error('updateTaskAction this', error);
				return fail(500, {
					kind: 'updateTask' as const,
					taskId: id,
					message: error.message ?? 'Could not update task.'
				});
			}
			return { kind: 'updateTask' as const, taskId: id, success: true as const };
		}

		// Entire series: update template + this instance; optional rule change
		const series = await fetchSeries(supabase, task.series_id);
		if (!series || series.deleted_at) {
			return fail(404, {
				kind: 'updateTask' as const,
				taskId: id,
				message: 'Series not found.'
			});
		}

		const recurrence = parseRecurrenceFormData(fd);
		if (recurrence && 'error' in recurrence) {
			return fail(400, {
				kind: 'updateTask' as const,
				taskId: id,
				message: recurrence.error
			});
		}

		const seriesPatch: Record<string, unknown> = {
			project_id,
			title,
			priority,
			notes
		};
		if (recurrence) {
			seriesPatch.freq = recurrence.freq;
			seriesPatch.interval = recurrence.interval;
			seriesPatch.byweekday = recurrence.byweekday;
			seriesPatch.bymonthday = recurrence.bymonthday;
			seriesPatch.ends = recurrence.ends;
			seriesPatch.ends_count = recurrence.ends_count;
			seriesPatch.ends_on = recurrence.ends_on;
		}

		const { error: seriesError } = await supabase
			.from('project_task_series')
			.update(seriesPatch as never)
			.eq('id', series.id);

		if (seriesError) {
			console.error('updateTaskAction series', seriesError);
			return fail(500, {
				kind: 'updateTask' as const,
				taskId: id,
				message: seriesError.message ?? 'Could not update series.'
			});
		}

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
			console.error('updateTaskAction series instance', error);
			return fail(500, {
				kind: 'updateTask' as const,
				taskId: id,
				message: error.message ?? 'Could not update task.'
			});
		}

		return { kind: 'updateTask' as const, taskId: id, success: true as const };
	}

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

	const task = await fetchTask(supabase, id);
	if (!task || task.deleted_at) {
		return fail(404, {
			kind: 'completeTask' as const,
			taskId: id,
			message: 'Task not found.'
		});
	}

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

	if (task.series_id) {
		const series = await fetchSeries(supabase, task.series_id);
		if (series && !series.deleted_at) {
			const spawned = await spawnNextOccurrence(
				supabase,
				task.created_by,
				series,
				task.start_date
			);
			if (!spawned.ok) {
				return fail(500, {
					kind: 'completeTask' as const,
					taskId: id,
					message: spawned.message
				});
			}
		}
	}

	return { kind: 'completeTask' as const, taskId: id, success: true as const };
}

export async function uncompleteTaskAction(supabase: SupabaseClient, fd: FormData) {
	const id = parseUuid(fd.get('id'));
	if (!id) return fail(400, { kind: 'uncompleteTask' as const, message: 'Missing task id.' });

	const task = await fetchTask(supabase, id);
	if (!task || task.deleted_at) {
		return fail(404, {
			kind: 'uncompleteTask' as const,
			taskId: id,
			message: 'Task not found.'
		});
	}

	if (task.series_id && task.series_occurrence != null) {
		const now = new Date().toISOString();
		const { error: siblingError } = await supabase
			.from('project_tasks')
			.update({ deleted_at: now } as never)
			.eq('series_id', task.series_id)
			.is('deleted_at', null)
			.is('completed_at', null)
			.gt('series_occurrence', task.series_occurrence);

		if (siblingError) {
			console.error('uncompleteTaskAction siblings', siblingError);
			return fail(500, {
				kind: 'uncompleteTask' as const,
				taskId: id,
				message: siblingError.message ?? 'Could not clear later occurrence.'
			});
		}

		const series = await fetchSeries(supabase, task.series_id);
		if (series && series.occurrence_seq > task.series_occurrence) {
			await supabase
				.from('project_task_series')
				.update({ occurrence_seq: task.series_occurrence } as never)
				.eq('id', task.series_id);
		}
	}

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

/** One-step zone raise: OTH → Opportunity Now, Opportunity → Critical. Also sets start_date = today. */
export async function raisePriorityAction(supabase: SupabaseClient, fd: FormData) {
	const id = parseUuid(fd.get('id'));
	if (!id) return fail(400, { kind: 'raisePriority' as const, message: 'Missing task id.' });

	const { data: row, error: loadError } = await supabase
		.from('project_tasks')
		.select('id, priority, completed_at, deleted_at')
		.eq('id', id)
		.maybeSingle();

	if (loadError) {
		console.error('raisePriorityAction load', loadError);
		return fail(500, {
			kind: 'raisePriority' as const,
			taskId: id,
			message: loadError.message ?? 'Could not load task.'
		});
	}
	if (!row || row.deleted_at != null) {
		return fail(404, { kind: 'raisePriority' as const, taskId: id, message: 'Task not found.' });
	}
	if (row.completed_at != null) {
		return fail(400, {
			kind: 'raisePriority' as const,
			taskId: id,
			message: 'Completed tasks cannot be raised.'
		});
	}

	const current = row.priority as string;
	let next: TaskPriority | null = null;
	if (current === 'over_horizon') next = 'opportunity_now';
	else if (current === 'opportunity_now') next = 'critical_now';
	else {
		return fail(400, {
			kind: 'raisePriority' as const,
			taskId: id,
			message: 'Already Critical Now.'
		});
	}

	const today = ymdInChicago();
	const { error } = await supabase
		.from('project_tasks')
		.update({ priority: next, start_date: today } as never)
		.eq('id', id);

	if (error) {
		console.error('raisePriorityAction', error);
		return fail(500, {
			kind: 'raisePriority' as const,
			taskId: id,
			message: error.message ?? 'Could not raise priority.'
		});
	}

	return { kind: 'raisePriority' as const, taskId: id, success: true as const };
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

	const task = await fetchTask(supabase, id);
	if (!task || task.deleted_at) {
		return fail(404, {
			kind: 'softDeleteTask' as const,
			taskId: id,
			message: 'Task not found.'
		});
	}

	const now = new Date().toISOString();

	if (task.series_id) {
		const scope = parseSeriesScope(fd.get('scope'));
		if (!scope) {
			return fail(400, {
				kind: 'softDeleteTask' as const,
				taskId: id,
				message: 'Choose This task or Entire series.'
			});
		}

		const series = await fetchSeries(supabase, task.series_id);
		if (!series || series.deleted_at) {
			return fail(404, {
				kind: 'softDeleteTask' as const,
				taskId: id,
				message: 'Series not found.'
			});
		}

		if (scope === 'series') {
			const { error: stopError } = await supabase
				.from('project_task_series')
				.update({ stopped_at: now } as never)
				.eq('id', series.id);

			if (stopError) {
				console.error('softDeleteTaskAction stop series', stopError);
				return fail(500, {
					kind: 'softDeleteTask' as const,
					taskId: id,
					message: stopError.message ?? 'Could not stop series.'
				});
			}

			const { error } = await supabase
				.from('project_tasks')
				.update({ deleted_at: now } as never)
				.eq('id', id);

			if (error) {
				console.error('softDeleteTaskAction series', error);
				return fail(500, {
					kind: 'softDeleteTask' as const,
					taskId: id,
					message: error.message ?? 'Could not delete task.'
				});
			}

			return { kind: 'softDeleteTask' as const, taskId: id, success: true as const };
		}

		// This occurrence only: delete + spawn next (skip)
		const { error } = await supabase
			.from('project_tasks')
			.update({ deleted_at: now } as never)
			.eq('id', id);

		if (error) {
			console.error('softDeleteTaskAction this', error);
			return fail(500, {
				kind: 'softDeleteTask' as const,
				taskId: id,
				message: error.message ?? 'Could not delete task.'
			});
		}

		if (!task.completed_at) {
			const spawned = await spawnNextOccurrence(
				supabase,
				task.created_by,
				series,
				task.start_date
			);
			if (!spawned.ok) {
				return fail(500, {
					kind: 'softDeleteTask' as const,
					taskId: id,
					message: spawned.message
				});
			}
		}

		return { kind: 'softDeleteTask' as const, taskId: id, success: true as const };
	}

	const { error } = await supabase
		.from('project_tasks')
		.update({ deleted_at: now } as never)
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
