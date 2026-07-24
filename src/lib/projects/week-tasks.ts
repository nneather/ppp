/**
 * Pure helpers for the week-horizon task window (MCP `list_week_tasks`).
 * Window is inclusive Chicago civil days: [todayYmd .. todayYmd + days].
 */

import {
	TASK_PRIORITY_ORDER,
	type TaskPriority
} from '$lib/types/projects';

export const WEEK_TASK_DAYS_DEFAULT = 7;
export const WEEK_TASK_DAYS_MIN = 1;
export const WEEK_TASK_DAYS_MAX = 31;

/** Clamp `days` to 1–31 (default 7). Truncates non-integers toward zero. */
export function clampWeekTaskDays(days: number | undefined): number {
	const raw = days === undefined || Number.isNaN(days) ? WEEK_TASK_DAYS_DEFAULT : days;
	const n = Math.trunc(raw);
	return Math.min(Math.max(n, WEEK_TASK_DAYS_MIN), WEEK_TASK_DAYS_MAX);
}

export type WeekHorizonTaskSortable = {
	start_date: string;
	priority: TaskPriority;
	id?: string;
};

/** start_date asc, then MYN zone order (Critical → Opportunity → OTH), then id. */
export function compareWeekHorizonTasks(
	a: WeekHorizonTaskSortable,
	b: WeekHorizonTaskSortable
): number {
	const byDate = a.start_date.localeCompare(b.start_date);
	if (byDate !== 0) return byDate;
	const ai = TASK_PRIORITY_ORDER.indexOf(a.priority);
	const bi = TASK_PRIORITY_ORDER.indexOf(b.priority);
	if (ai !== bi) return ai - bi;
	return (a.id ?? '').localeCompare(b.id ?? '');
}

export type WeekTaskProjectGroup = {
	project_id: string;
	project_name: string;
	count: number;
};

/** Project spread summary — count desc, then name asc. */
export function summarizeWeekTasksByProject(
	tasks: readonly { project_id: string; project_name: string }[]
): WeekTaskProjectGroup[] {
	const map = new Map<string, WeekTaskProjectGroup>();
	for (const t of tasks) {
		const existing = map.get(t.project_id);
		if (existing) {
			existing.count += 1;
		} else {
			map.set(t.project_id, {
				project_id: t.project_id,
				project_name: t.project_name,
				count: 1
			});
		}
	}
	return [...map.values()].sort((a, b) => {
		if (b.count !== a.count) return b.count - a.count;
		return a.project_name.localeCompare(b.project_name);
	});
}
