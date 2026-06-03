import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	LIFECYCLE_STATUSES,
	HEALTH_STATUSES,
	type LifecycleStatus,
	type HealthStatus,
	type WeeklyDraftRow
} from '$lib/types/projects';
import {
	collectDescendantIds,
	loadProjectRows,
	loadWeekUpdatesForSave
} from '$lib/projects/server/loaders';
import { parseYmd, sundayContaining } from '$lib/projects/week';

export type ProjectsActionKind =
	| 'saveCheckin'
	| 'createProject'
	| 'updateProject'
	| 'softDeleteProject'
	| 'undoSoftDeleteProject';

const LIFECYCLE_SET: ReadonlySet<string> = new Set(LIFECYCLE_STATUSES);
const HEALTH_SET: ReadonlySet<string> = new Set(HEALTH_STATUSES);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trimOrNull(raw: FormDataEntryValue | null): string | null {
	const t = String(raw ?? '').trim();
	return t.length > 0 ? t : null;
}

function parseUuid(raw: FormDataEntryValue | null): string | null {
	const t = String(raw ?? '').trim();
	return UUID_RE.test(t) ? t : null;
}

function parseLifecycle(raw: FormDataEntryValue | null): LifecycleStatus | null {
	const t = String(raw ?? '').trim();
	return LIFECYCLE_SET.has(t) ? (t as LifecycleStatus) : null;
}

function parseHealth(raw: string): HealthStatus | null {
	return HEALTH_SET.has(raw) ? (raw as HealthStatus) : null;
}

function parseDateOrNull(raw: FormDataEntryValue | null): string | null {
	const t = String(raw ?? '').trim();
	if (!t) return null;
	return parseYmd(t) ? t : null;
}

function parseCheckinPayload(raw: string): WeeklyDraftRow[] | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!Array.isArray(parsed)) return null;
	const rows: WeeklyDraftRow[] = [];
	for (const item of parsed) {
		if (typeof item !== 'object' || item == null) return null;
		const o = item as Record<string, unknown>;
		const project_id = typeof o.project_id === 'string' ? o.project_id : '';
		if (!UUID_RE.test(project_id)) return null;
		const health_status = parseHealth(String(o.health_status ?? ''));
		if (!health_status) return null;
		rows.push({
			project_id,
			health_status,
			reason: typeof o.reason === 'string' ? o.reason : '',
			next_steps: typeof o.next_steps === 'string' ? o.next_steps : ''
		});
	}
	return rows;
}

async function assertNoCycle(
	supabase: SupabaseClient,
	projectId: string,
	newParentId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
	if (newParentId == null) return { ok: true };
	if (newParentId === projectId) {
		return { ok: false, message: 'A project cannot be its own parent.' };
	}
	const rows = await loadProjectRows(supabase);
	const descendants = collectDescendantIds(rows, projectId);
	if (descendants.has(newParentId)) {
		return {
			ok: false,
			message: 'Cannot set parent to a descendant — that would create a cycle.'
		};
	}
	return { ok: true };
}

export async function saveWeeklyCheckinAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const weekRaw = String(fd.get('week_of') ?? '').trim();
	const week_of = parseYmd(weekRaw);
	if (!week_of) {
		return fail(400, { kind: 'saveCheckin' as const, message: 'Invalid week.' });
	}
	if (sundayContaining(week_of) !== week_of) {
		return fail(400, {
			kind: 'saveCheckin' as const,
			message: 'Week must be a Sunday (Chicago civil date).'
		});
	}

	const drafts = parseCheckinPayload(String(fd.get('rows_json') ?? ''));
	if (!drafts) {
		return fail(400, { kind: 'saveCheckin' as const, message: 'Invalid check-in payload.' });
	}
	if (drafts.length === 0) {
		return fail(400, {
			kind: 'saveCheckin' as const,
			message: 'No rows to save — include active or paused projects.'
		});
	}

	const existingByProject = await loadWeekUpdatesForSave(supabase, week_of);

	const payload = drafts.map((d) => {
		const existing = existingByProject.get(d.project_id);
		const row: Record<string, unknown> = {
			project_id: d.project_id,
			week_of,
			health_status: d.health_status,
			reason: trimOrNull(d.reason) ?? null,
			next_steps: trimOrNull(d.next_steps) ?? null,
			deleted_at: null,
			created_by: userId
		};
		if (existing) row.id = existing.id;
		return row;
	});

	const { error } = await supabase.from('project_updates').upsert(payload as never, {
		onConflict: 'id'
	});

	if (error) {
		console.error('saveWeeklyCheckinAction', error);
		return fail(500, {
			kind: 'saveCheckin' as const,
			message: error.message ?? 'Could not save weekly check-in.'
		});
	}

	return { kind: 'saveCheckin' as const, success: true as const };
}

export async function createProjectAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const name = String(fd.get('name') ?? '').trim();
	if (!name) {
		return fail(400, { kind: 'createProject' as const, message: 'Name is required.' });
	}
	if (name.length > 300) {
		return fail(400, { kind: 'createProject' as const, message: 'Name is too long.' });
	}

	const lifecycle_status = parseLifecycle(fd.get('lifecycle_status')) ?? 'active';
	const parent_id = parseUuid(fd.get('parent_id'));

	const { data, error } = await supabase
		.from('projects')
		.insert({
			name,
			parent_id,
			lifecycle_status,
			description: trimOrNull(fd.get('description')),
			start_date: parseDateOrNull(fd.get('start_date')),
			end_date: parseDateOrNull(fd.get('end_date')),
			created_by: userId
		} as never)
		.select('id')
		.single();

	if (error || !data) {
		console.error('createProjectAction', error);
		return fail(500, {
			kind: 'createProject' as const,
			message: error?.message ?? 'Could not create project.'
		});
	}

	return {
		kind: 'createProject' as const,
		success: true as const,
		projectId: data.id
	};
}

export async function updateProjectAction(supabase: SupabaseClient, fd: FormData) {
	const id = parseUuid(fd.get('id'));
	if (!id) return fail(400, { kind: 'updateProject' as const, message: 'Missing project id.' });

	const name = String(fd.get('name') ?? '').trim();
	if (!name) {
		return fail(400, {
			kind: 'updateProject' as const,
			projectId: id,
			message: 'Name is required.'
		});
	}

	const lifecycle_status = parseLifecycle(fd.get('lifecycle_status'));
	if (!lifecycle_status) {
		return fail(400, {
			kind: 'updateProject' as const,
			projectId: id,
			message: 'Invalid lifecycle status.'
		});
	}

	const parentRaw = fd.get('parent_id');
	const parent_id =
		parentRaw == null || String(parentRaw).trim() === ''
			? null
			: parseUuid(parentRaw);

	if (parentRaw != null && String(parentRaw).trim() !== '' && parent_id == null) {
		return fail(400, {
			kind: 'updateProject' as const,
			projectId: id,
			message: 'Invalid parent.'
		});
	}

	const cycle = await assertNoCycle(supabase, id, parent_id);
	if (!cycle.ok) {
		return fail(400, {
			kind: 'updateProject' as const,
			projectId: id,
			message: cycle.message
		});
	}

	const { error } = await supabase
		.from('projects')
		.update({
			name,
			parent_id,
			lifecycle_status,
			description: trimOrNull(fd.get('description')),
			start_date: parseDateOrNull(fd.get('start_date')),
			end_date: parseDateOrNull(fd.get('end_date'))
		} as never)
		.eq('id', id);

	if (error) {
		console.error('updateProjectAction', error);
		return fail(500, {
			kind: 'updateProject' as const,
			projectId: id,
			message: error.message ?? 'Could not update project.'
		});
	}

	return { kind: 'updateProject' as const, projectId: id, success: true as const };
}

export async function softDeleteProjectAction(supabase: SupabaseClient, fd: FormData) {
	const id = parseUuid(fd.get('id'));
	if (!id) {
		return fail(400, { kind: 'softDeleteProject' as const, message: 'Missing project id.' });
	}

	const { count, error: countErr } = await supabase
		.from('projects')
		.select('id', { count: 'exact', head: true })
		.eq('parent_id', id)
		.is('deleted_at', null);

	if (countErr) {
		console.error('softDeleteProjectAction count', countErr);
		return fail(500, {
			kind: 'softDeleteProject' as const,
			projectId: id,
			message: countErr.message ?? 'Could not verify children.'
		});
	}

	if ((count ?? 0) > 0) {
		return fail(400, {
			kind: 'softDeleteProject' as const,
			projectId: id,
			message: 'Reparent or remove children first.'
		});
	}

	const { error } = await supabase
		.from('projects')
		.update({ deleted_at: new Date().toISOString() } as never)
		.eq('id', id);

	if (error) {
		console.error('softDeleteProjectAction', error);
		return fail(500, {
			kind: 'softDeleteProject' as const,
			projectId: id,
			message: error.message ?? 'Could not delete project.'
		});
	}

	return { kind: 'softDeleteProject' as const, projectId: id, success: true as const };
}

export async function undoSoftDeleteProjectAction(supabase: SupabaseClient, fd: FormData) {
	const id = parseUuid(fd.get('id'));
	if (!id) {
		return fail(400, { kind: 'undoSoftDeleteProject' as const, message: 'Missing project id.' });
	}

	const { error } = await supabase
		.from('projects')
		.update({ deleted_at: null } as never)
		.eq('id', id);

	if (error) {
		console.error('undoSoftDeleteProjectAction', error);
		return fail(500, {
			kind: 'undoSoftDeleteProject' as const,
			projectId: id,
			message: error.message ?? 'Could not restore project.'
		});
	}

	return { kind: 'undoSoftDeleteProject' as const, projectId: id, success: true as const };
}
