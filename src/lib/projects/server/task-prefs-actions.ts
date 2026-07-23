import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	parseTaskSavedViews,
	TASK_VIEW_MODES,
	type TaskSavedView,
	type TaskViewMode
} from '$lib/projects/task-views';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUuidOrEmpty(raw: FormDataEntryValue | null): string | null {
	const t = String(raw ?? '').trim();
	if (!t || t === '__none__') return null;
	return UUID_RE.test(t) ? t : null;
}

function isViewMode(v: string): v is TaskViewMode {
	return (TASK_VIEW_MODES as readonly string[]).includes(v);
}

async function loadViews(supabase: SupabaseClient, userId: string): Promise<TaskSavedView[]> {
	const { data, error } = await supabase
		.from('profiles')
		.select('task_saved_views')
		.eq('id', userId)
		.maybeSingle();
	if (error) {
		console.error('loadViews', error);
		return [];
	}
	return parseTaskSavedViews(data?.task_saved_views);
}

async function saveViews(
	supabase: SupabaseClient,
	userId: string,
	views: TaskSavedView[]
): Promise<{ ok: true } | { ok: false; message: string }> {
	const { error } = await supabase
		.from('profiles')
		.update({ task_saved_views: views as unknown as never })
		.eq('id', userId);
	if (error) {
		console.error('saveViews', error);
		return { ok: false, message: error.message ?? 'Could not save views.' };
	}
	return { ok: true };
}

export async function setDefaultTaskProjectAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const projectId = parseUuidOrEmpty(fd.get('default_task_project_id'));
	// Invalid non-empty value
	const raw = String(fd.get('default_task_project_id') ?? '').trim();
	if (raw && raw !== '__none__' && projectId == null) {
		return fail(400, {
			kind: 'setDefaultTaskProject' as const,
			message: 'Invalid project id.'
		});
	}

	const { error } = await supabase
		.from('profiles')
		.update({ default_task_project_id: projectId })
		.eq('id', userId);

	if (error) {
		console.error('setDefaultTaskProjectAction', error);
		return fail(500, {
			kind: 'setDefaultTaskProject' as const,
			message: error.message ?? 'Could not save default project.'
		});
	}

	return { kind: 'setDefaultTaskProject' as const, success: true as const };
}

function parseViewFromForm(fd: FormData): TaskSavedView | { error: string } {
	const idRaw = String(fd.get('id') ?? '').trim();
	const id = idRaw || crypto.randomUUID();
	const name = String(fd.get('name') ?? '').trim();
	if (!name) return { error: 'View name is required.' };
	if (name.length > 80) return { error: 'View name is too long.' };

	const modeRaw = String(fd.get('mode') ?? '').trim();
	if (!isViewMode(modeRaw)) return { error: 'Invalid view mode.' };

	const projectIds = fd
		.getAll('project_ids')
		.map((v) => String(v).trim())
		.filter((v) => UUID_RE.test(v));

	if ((modeRaw === 'include' || modeRaw === 'only') && projectIds.length === 0) {
		return { error: 'Pick at least one project for this view.' };
	}

	return { id, name, mode: modeRaw, projectIds };
}

export async function upsertTaskSavedViewAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const parsed = parseViewFromForm(fd);
	if ('error' in parsed) {
		return fail(400, { kind: 'upsertTaskSavedView' as const, message: parsed.error });
	}

	const views = await loadViews(supabase, userId);
	const idx = views.findIndex((v) => v.id === parsed.id);
	if (idx >= 0) views[idx] = parsed;
	else views.push(parsed);

	const saved = await saveViews(supabase, userId, views);
	if (!saved.ok) {
		return fail(500, { kind: 'upsertTaskSavedView' as const, message: saved.message });
	}

	return {
		kind: 'upsertTaskSavedView' as const,
		success: true as const,
		viewId: parsed.id
	};
}

export async function deleteTaskSavedViewAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const id = String(fd.get('id') ?? '').trim();
	if (!id) {
		return fail(400, { kind: 'deleteTaskSavedView' as const, message: 'Missing view id.' });
	}

	const views = (await loadViews(supabase, userId)).filter((v) => v.id !== id);
	const saved = await saveViews(supabase, userId, views);
	if (!saved.ok) {
		return fail(500, { kind: 'deleteTaskSavedView' as const, message: saved.message });
	}

	return { kind: 'deleteTaskSavedView' as const, success: true as const, viewId: id };
}
