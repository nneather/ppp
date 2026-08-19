import type {
	ProjectFlatOption,
	ProjectTaskSeriesView,
	TaskZoneGroup
} from '$lib/types/projects';

/** Lazy JSON for the desktop Now rail — not SW-cached (authenticated, must be fresh). */
export const NOW_TASK_RAIL_JSON = '/tasks/now.json';

export type NowTaskRailData = {
	zones: TaskZoneGroup[];
	todayYmd: string;
	seriesById: Record<string, ProjectTaskSeriesView>;
	projectOptions: ProjectFlatOption[];
	defaultTaskProjectId: string | null;
	criticalNowCount: number;
	opportunityNowCount: number;
};

/** Form action URL for MYN task mutations. Prefix `/tasks` when posting from another route. */
export function taskFormAction(name: string, prefix = ''): string {
	return prefix ? `${prefix}?/${name}` : `?/${name}`;
}

export function isNowTaskRailData(v: unknown): v is NowTaskRailData {
	if (!v || typeof v !== 'object') return false;
	const o = v as Record<string, unknown>;
	return Array.isArray(o.zones) && typeof o.todayYmd === 'string';
}
