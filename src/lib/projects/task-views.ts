import {
	TASK_PRIORITIES,
	TASK_PRIORITY_ORDER,
	type ProjectRow,
	type ProjectTaskView,
	type TaskPriority
} from '$lib/types/projects';

export const TASK_VIEW_MODES = ['include', 'exclude', 'only'] as const;
export type TaskViewMode = (typeof TASK_VIEW_MODES)[number];

export type TaskSavedView = {
	id: string;
	name: string;
	mode: TaskViewMode;
	projectIds: string[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isTaskViewMode(v: unknown): v is TaskViewMode {
	return typeof v === 'string' && (TASK_VIEW_MODES as readonly string[]).includes(v);
}

/** Parse + validate `profiles.task_saved_views` JSON. Drops invalid entries. */
export function parseTaskSavedViews(raw: unknown): TaskSavedView[] {
	if (!Array.isArray(raw)) return [];
	const out: TaskSavedView[] = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const rec = item as Record<string, unknown>;
		const id = typeof rec.id === 'string' ? rec.id.trim() : '';
		const name = typeof rec.name === 'string' ? rec.name.trim() : '';
		if (!id || !name || !isTaskViewMode(rec.mode)) continue;
		const projectIdsRaw = rec.projectIds;
		if (!Array.isArray(projectIdsRaw)) continue;
		const projectIds = projectIdsRaw
			.filter((x): x is string => typeof x === 'string' && UUID_RE.test(x.trim()))
			.map((x) => x.trim());
		out.push({ id, name, mode: rec.mode, projectIds });
	}
	return out;
}

/** Descendant ids of `rootId` (not including root) — mirrors server `collectDescendantIds`. */
function collectDescendantIds(rows: ProjectRow[], rootId: string): Set<string> {
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

/** Expand selected roots to root + all descendants. */
export function expandProjectIdsWithDescendants(
	rows: ProjectRow[],
	rootIds: readonly string[]
): string[] {
	const set = new Set<string>();
	for (const rootId of rootIds) {
		set.add(rootId);
		for (const id of collectDescendantIds(rows, rootId)) set.add(id);
	}
	return [...set];
}

/**
 * Resolve a saved view to the project_id allow-list for `loadTasks`.
 * - include / only: those roots + descendants
 * - exclude: all live project ids minus excluded roots + descendants
 */
export function resolveTaskViewProjectIds(rows: ProjectRow[], view: TaskSavedView): string[] {
	const expanded = expandProjectIdsWithDescendants(rows, view.projectIds);
	if (view.mode === 'include' || view.mode === 'only') {
		return expanded;
	}
	const exclude = new Set(expanded);
	return rows.map((r) => r.id).filter((id) => !exclude.has(id));
}

/** Priority order for soft-cap eviction: hide lowest urgency first. */
const EVICT_PRIORITY_RANK: Record<TaskPriority, number> = {
	over_horizon: 0,
	opportunity_now: 1,
	critical_now: 2
};

/**
 * Soft-cap truncate: keep highest-priority / newest (FRESH) tasks up to `cap`.
 * Hides lowest priority first, then oldest `start_date` (ASC = reverse FRESH).
 * Returns kept tasks preserving input relative order among survivors.
 */
export function truncateTasksToSoftCap(
	tasks: readonly ProjectTaskView[],
	cap: number
): { kept: ProjectTaskView[]; truncated: boolean; openCount: number } {
	const openCount = tasks.length;
	if (openCount <= cap) {
		return { kept: [...tasks], truncated: false, openCount };
	}

	const ranked = [...tasks].sort((a, b) => {
		const pr = EVICT_PRIORITY_RANK[a.priority] - EVICT_PRIORITY_RANK[b.priority];
		if (pr !== 0) return pr;
		const sd = a.start_date.localeCompare(b.start_date);
		if (sd !== 0) return sd;
		if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
		return a.id.localeCompare(b.id);
	});

	const hideCount = openCount - cap;
	const hideIds = new Set(ranked.slice(0, hideCount).map((t) => t.id));
	const kept = tasks.filter((t) => !hideIds.has(t.id));
	return { kept, truncated: true, openCount };
}

export function isTaskPriority(v: string): v is TaskPriority {
	return (TASK_PRIORITIES as readonly string[]).includes(v);
}

export { TASK_PRIORITY_ORDER };
