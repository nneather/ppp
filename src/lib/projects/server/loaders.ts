import type { SupabaseClient } from '@supabase/supabase-js';
import {
	reduceCarryForwardUpdates,
	type CarryForwardFields,
	type CarryForwardRow
} from '$lib/projects/carry-forward';
import {
	LIFECYCLE_STATUSES,
	HEALTH_STATUSES,
	type LifecycleStatus,
	type HealthStatus,
	type ProjectNode,
	type ProjectRow,
	type ProjectUpdateRow,
	type ProjectFlatOption,
	type LatestHealth
} from '$lib/types/projects';

const MAX_TREE_DEPTH = 32;

const PROJECT_COLUMNS =
	'id, parent_id, name, description, lifecycle_status, start_date, end_date, sort_order, color';

const UPDATE_COLUMNS =
	'id, project_id, week_of, health_status, reason, next_steps, progress_value, progress_max, progress_note';

function isLifecycleStatus(v: string): v is LifecycleStatus {
	return (LIFECYCLE_STATUSES as readonly string[]).includes(v);
}

function isHealthStatus(v: string): v is HealthStatus {
	return (HEALTH_STATUSES as readonly string[]).includes(v);
}

function mapProjectRow(row: {
	id: string;
	parent_id: string | null;
	name: string;
	description: string | null;
	lifecycle_status: string;
	start_date: string | null;
	end_date: string | null;
	sort_order: number;
	color: string | null;
}): ProjectRow | null {
	if (!isLifecycleStatus(row.lifecycle_status)) return null;
	return {
		id: row.id,
		parent_id: row.parent_id,
		name: row.name,
		description: row.description,
		lifecycle_status: row.lifecycle_status,
		start_date: row.start_date,
		end_date: row.end_date,
		sort_order: row.sort_order,
		color: row.color
	};
}

export function buildProjectTree(rows: ProjectRow[]): ProjectNode[] {
	const byParent = new Map<string | null, ProjectRow[]>();
	for (const row of rows) {
		const key = row.parent_id;
		const list = byParent.get(key);
		if (list) list.push(row);
		else byParent.set(key, [row]);
	}
	for (const list of byParent.values()) {
		list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
	}

	function walk(parentId: string | null, depth: number): ProjectNode[] {
		if (depth > MAX_TREE_DEPTH) return [];
		const kids = byParent.get(parentId) ?? [];
		return kids.map((row) => ({
			...row,
			depth,
			children: walk(row.id, depth + 1)
		}));
	}

	return walk(null, 0);
}

export function flattenProjectTree(nodes: ProjectNode[]): ProjectFlatOption[] {
	const out: ProjectFlatOption[] = [];
	function visit(list: ProjectNode[]) {
		for (const n of list) {
			out.push({ id: n.id, name: n.name, parent_id: n.parent_id, depth: n.depth });
			visit(n.children);
		}
	}
	visit(nodes);
	return out;
}

/** All descendant ids of `rootId` (not including root). */
export function collectDescendantIds(rows: ProjectRow[], rootId: string): Set<string> {
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

export async function loadProjectRows(supabase: SupabaseClient): Promise<ProjectRow[]> {
	const { data, error } = await supabase
		.from('projects')
		.select(PROJECT_COLUMNS)
		.is('deleted_at', null)
		.order('sort_order', { ascending: true })
		.order('name', { ascending: true });

	if (error) {
		console.error('loadProjectRows', error);
		return [];
	}

	const rows: ProjectRow[] = [];
	for (const raw of data ?? []) {
		const mapped = mapProjectRow(raw);
		if (mapped) rows.push(mapped);
	}
	return rows;
}

export async function loadProjectTree(supabase: SupabaseClient): Promise<ProjectNode[]> {
	const rows = await loadProjectRows(supabase);
	return buildProjectTree(rows);
}

export async function loadWeekUpdates(
	supabase: SupabaseClient,
	weekOf: string
): Promise<Map<string, ProjectUpdateRow>> {
	const { data, error } = await supabase
		.from('project_updates')
		.select(UPDATE_COLUMNS)
		.eq('week_of', weekOf)
		.is('deleted_at', null);

	if (error) {
		console.error('loadWeekUpdates', error);
		return new Map();
	}

	const map = new Map<string, ProjectUpdateRow>();
	for (const raw of data ?? []) {
		if (!isHealthStatus(raw.health_status)) continue;
		map.set(raw.project_id, {
			id: raw.id,
			project_id: raw.project_id,
			week_of: raw.week_of,
			health_status: raw.health_status,
			reason: raw.reason,
			next_steps: raw.next_steps,
			progress_value: raw.progress_value ?? null,
			progress_max: raw.progress_max ?? null,
			progress_note: raw.progress_note ?? null
		});
	}
	return map;
}

/** Most recent update per project with week_of strictly before the selected week (carry-forward defaults). */
export async function loadCarryForward(
	supabase: SupabaseClient,
	weekOf: string
): Promise<Map<string, CarryForwardFields>> {
	const { data, error } = await supabase
		.from('project_updates')
		.select(
			'project_id, week_of, health_status, reason, next_steps, progress_value, progress_max, progress_note'
		)
		.lt('week_of', weekOf)
		.is('deleted_at', null)
		.order('week_of', { ascending: false });

	if (error) {
		console.error('loadCarryForward', error);
		return new Map();
	}

	return reduceCarryForwardUpdates((data ?? []) as CarryForwardRow[]);
}

/** Includes soft-deleted rows for upsert revive (footgun NEW-D). */
export async function loadWeekUpdatesForSave(
	supabase: SupabaseClient,
	weekOf: string
): Promise<Map<string, { id: string; deleted_at: string | null }>> {
	const { data, error } = await supabase
		.from('project_updates')
		.select('id, project_id, deleted_at')
		.eq('week_of', weekOf);

	if (error) {
		console.error('loadWeekUpdatesForSave', error);
		return new Map();
	}

	const map = new Map<string, { id: string; deleted_at: string | null }>();
	for (const raw of data ?? []) {
		map.set(raw.project_id, { id: raw.id, deleted_at: raw.deleted_at });
	}
	return map;
}

export async function countLiveChildren(
	supabase: SupabaseClient,
	projectId: string
): Promise<number> {
	const { count, error } = await supabase
		.from('projects')
		.select('id', { count: 'exact', head: true })
		.eq('parent_id', projectId)
		.is('deleted_at', null);

	if (error) {
		console.error('countLiveChildren', error);
		return 0;
	}
	return count ?? 0;
}

/** Latest + previous health per project (flat query, no recursion). */
export async function loadLatestHealth(
	supabase: SupabaseClient
): Promise<Map<string, LatestHealth>> {
	const { data, error } = await supabase
		.from('project_updates')
		.select('project_id, week_of, health_status')
		.is('deleted_at', null)
		.order('project_id', { ascending: true })
		.order('week_of', { ascending: false });

	if (error) {
		console.error('loadLatestHealth', error);
		return new Map();
	}

	const map = new Map<string, LatestHealth>();
	for (const raw of data ?? []) {
		if (!isHealthStatus(raw.health_status)) continue;
		const existing = map.get(raw.project_id);
		if (!existing) {
			map.set(raw.project_id, {
				health_status: raw.health_status,
				week_of: raw.week_of,
				previous: null
			});
		} else if (existing.previous == null) {
			map.set(raw.project_id, {
				...existing,
				previous: raw.health_status
			});
		}
	}
	return map;
}
