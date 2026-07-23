import type { SupabaseClient } from '@supabase/supabase-js';
import { ymdInChicago } from '$lib/invoicing/chicago-date';
import { truncateTasksToSoftCap } from '$lib/projects/task-views';
import {
	TASK_PRIORITIES,
	TASK_PRIORITY_LABELS,
	TASK_PRIORITY_ORDER,
	TASK_SOFT_CAP_TOTAL,
	type TaskPriority,
	type ProjectTaskView,
	type ProjectTaskSeriesView,
	type TaskZoneGroup,
	type ProjectLinkRow
} from '$lib/types/projects';

const TASK_COLUMNS =
	'id, project_id, title, priority, start_date, completed_at, sort_order, notes, series_id, series_occurrence, created_at';

function isTaskPriority(v: string): v is TaskPriority {
	return (TASK_PRIORITIES as readonly string[]).includes(v);
}

function compareTasksFresh(a: ProjectTaskView, b: ProjectTaskView): number {
	const sd = b.start_date.localeCompare(a.start_date);
	if (sd !== 0) return sd;
	if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
	return a.id.localeCompare(b.id);
}

function mapTaskRow(raw: {
	id: string;
	project_id: string;
	title: string;
	priority: string;
	start_date: string;
	completed_at: string | null;
	sort_order: number;
	notes: string | null;
	series_id: string | null;
	series_occurrence: number | null;
	projects: { name: string } | { name: string }[] | null;
}): ProjectTaskView | null {
	if (!isTaskPriority(raw.priority)) return null;
	const proj = raw.projects;
	const project_name = Array.isArray(proj) ? proj[0]?.name : proj?.name;
	if (!project_name) return null;
	return {
		id: raw.id,
		project_id: raw.project_id,
		title: raw.title,
		priority: raw.priority,
		start_date: raw.start_date,
		completed_at: raw.completed_at,
		sort_order: raw.sort_order,
		notes: raw.notes,
		series_id: raw.series_id,
		series_occurrence: raw.series_occurrence,
		project_name,
		domain_color: null
	};
}

export type LoadTasksOptions = {
	/** Exact project_id match. Prefer `projectIds` when filtering a domain + descendants. */
	projectId?: string | null;
	/** Match any of these project ids (e.g. domain root + collectDescendantIds). */
	projectIds?: readonly string[] | null;
	includeDeferred?: boolean;
	includeCompleted?: boolean;
	/** When true, skip soft-cap truncation (`?all=1`). */
	showAll?: boolean;
	todayYmd?: string;
	softCap?: number;
};

export type LoadTasksResult = {
	zones: TaskZoneGroup[];
	deferred: ProjectTaskView[];
	completed: ProjectTaskView[];
	todayYmd: string;
	/** Open non-deferred count before soft-cap truncate. */
	openCount: number;
	/** Visible open tasks after soft-cap (equals openCount when not truncated). */
	visibleCount: number;
	/** True when openCount >= soft cap (banner even if showAll). */
	atCap: boolean;
	/** True when list was truncated (not showAll and openCount > soft cap). */
	truncated: boolean;
};

/** Attach root-domain palette keys after load (from `buildDomainColorByProjectId`). */
export function attachTaskDomainColors(
	result: LoadTasksResult,
	domainColorByProjectId: Record<string, string | null>
): LoadTasksResult {
	const paint = (t: ProjectTaskView): ProjectTaskView => ({
		...t,
		domain_color: domainColorByProjectId[t.project_id] ?? null
	});
	return {
		...result,
		zones: result.zones.map((z) => ({
			...z,
			tasks: z.tasks.map(paint)
		})),
		deferred: result.deferred.map(paint),
		completed: result.completed.map(paint)
	};
}

function groupOpenIntoZones(open: ProjectTaskView[]): TaskZoneGroup[] {
	const byZone = new Map<TaskPriority, ProjectTaskView[]>();
	for (const p of TASK_PRIORITY_ORDER) {
		byZone.set(p, []);
	}
	for (const task of open) {
		const list = byZone.get(task.priority);
		if (list) list.push(task);
	}
	return TASK_PRIORITY_ORDER.map((priority) => {
		const tasks = (byZone.get(priority) ?? []).sort(compareTasksFresh);
		return {
			priority,
			label: TASK_PRIORITY_LABELS[priority],
			tasks,
			count: tasks.length
		};
	});
}

export async function loadTasks(
	supabase: SupabaseClient,
	opts: LoadTasksOptions = {}
): Promise<LoadTasksResult> {
	const todayYmd = opts.todayYmd ?? ymdInChicago();
	const includeDeferred = opts.includeDeferred ?? false;
	const includeCompleted = opts.includeCompleted ?? false;
	const showAll = opts.showAll ?? false;
	const softCap = opts.softCap ?? TASK_SOFT_CAP_TOTAL;

	let q = supabase
		.from('project_tasks')
		.select(`${TASK_COLUMNS}, projects!project_tasks_project_id_fkey ( name )`)
		.is('deleted_at', null)
		.order('start_date', { ascending: false })
		.order('sort_order', { ascending: true })
		.order('created_at', { ascending: true });

	if (opts.projectIds != null) {
		if (opts.projectIds.length === 0) {
			return {
				zones: emptyZones(),
				deferred: [],
				completed: [],
				todayYmd,
				openCount: 0,
				visibleCount: 0,
				atCap: false,
				truncated: false
			};
		}
		q = q.in('project_id', [...opts.projectIds]);
	} else if (opts.projectId) {
		q = q.eq('project_id', opts.projectId);
	}

	const { data, error } = await q;
	if (error) {
		console.error('loadTasks', error);
		return {
			zones: emptyZones(),
			deferred: [],
			completed: [],
			todayYmd,
			openCount: 0,
			visibleCount: 0,
			atCap: false,
			truncated: false
		};
	}

	const all: ProjectTaskView[] = [];
	for (const raw of data ?? []) {
		const row = mapTaskRow(
			raw as {
				id: string;
				project_id: string;
				title: string;
				priority: string;
				start_date: string;
				completed_at: string | null;
				sort_order: number;
				notes: string | null;
				series_id: string | null;
				series_occurrence: number | null;
				projects: { name: string } | { name: string }[] | null;
			}
		);
		if (row) all.push(row);
	}

	const deferred: ProjectTaskView[] = [];
	const completed: ProjectTaskView[] = [];
	const open: ProjectTaskView[] = [];

	for (const task of all) {
		if (task.completed_at != null) {
			if (includeCompleted) completed.push(task);
			continue;
		}
		if (task.start_date > todayYmd) {
			if (includeDeferred) deferred.push(task);
			continue;
		}
		open.push(task);
	}

	open.sort(compareTasksFresh);
	deferred.sort(compareTasksFresh);
	completed.sort((a, b) => {
		const ca = a.completed_at ?? '';
		const cb = b.completed_at ?? '';
		return cb.localeCompare(ca);
	});

	const openCount = open.length;
	const atCap = openCount >= softCap;
	let visibleOpen = open;
	let truncated = false;
	if (!showAll && openCount > softCap) {
		const result = truncateTasksToSoftCap(open, softCap);
		visibleOpen = result.kept;
		truncated = result.truncated;
	}

	return {
		zones: groupOpenIntoZones(visibleOpen),
		deferred,
		completed,
		todayYmd,
		openCount,
		visibleCount: visibleOpen.length,
		atCap,
		truncated
	};
}

function emptyZones(): TaskZoneGroup[] {
	return TASK_PRIORITY_ORDER.map((priority) => ({
		priority,
		label: TASK_PRIORITY_LABELS[priority],
		tasks: [],
		count: 0
	}));
}

const NOW_PRIORITIES: readonly TaskPriority[] = ['critical_now', 'opportunity_now'];

export type LoadDashboardNowTasksResult = {
	zones: TaskZoneGroup[];
	todayYmd: string;
	criticalNowCount: number;
	opportunityNowCount: number;
};

/**
 * Critical + Opportunity Now only (visible / non-deferred) for the desktop dashboard pane.
 * Skips OTH, deferred, completed, and soft-cap truncation.
 */
export async function loadDashboardNowTasks(
	supabase: SupabaseClient,
	opts: { todayYmd?: string } = {}
): Promise<LoadDashboardNowTasksResult> {
	const todayYmd = opts.todayYmd ?? ymdInChicago();

	const { data, error } = await supabase
		.from('project_tasks')
		.select(`${TASK_COLUMNS}, projects!project_tasks_project_id_fkey ( name )`)
		.is('deleted_at', null)
		.is('completed_at', null)
		.in('priority', [...NOW_PRIORITIES])
		.lte('start_date', todayYmd)
		.order('start_date', { ascending: false })
		.order('sort_order', { ascending: true })
		.order('created_at', { ascending: true });

	if (error) {
		console.error('loadDashboardNowTasks', error);
		return {
			zones: NOW_PRIORITIES.map((priority) => ({
				priority,
				label: TASK_PRIORITY_LABELS[priority],
				tasks: [],
				count: 0
			})),
			todayYmd,
			criticalNowCount: 0,
			opportunityNowCount: 0
		};
	}

	const open: ProjectTaskView[] = [];
	for (const raw of data ?? []) {
		const row = mapTaskRow(
			raw as {
				id: string;
				project_id: string;
				title: string;
				priority: string;
				start_date: string;
				completed_at: string | null;
				sort_order: number;
				notes: string | null;
				series_id: string | null;
				series_occurrence: number | null;
				projects: { name: string } | { name: string }[] | null;
			}
		);
		if (row) open.push(row);
	}

	const byZone = new Map<TaskPriority, ProjectTaskView[]>();
	for (const p of NOW_PRIORITIES) byZone.set(p, []);
	for (const task of open) {
		const list = byZone.get(task.priority);
		if (list) list.push(task);
	}

	const zones: TaskZoneGroup[] = NOW_PRIORITIES.map((priority) => {
		const tasks = (byZone.get(priority) ?? []).sort(compareTasksFresh);
		return {
			priority,
			label: TASK_PRIORITY_LABELS[priority],
			tasks,
			count: tasks.length
		};
	});

	return {
		zones,
		todayYmd,
		criticalNowCount: zones[0]?.count ?? 0,
		opportunityNowCount: zones[1]?.count ?? 0
	};
}

const LINK_COLUMNS = 'id, project_id, url, label, sort_order';

export async function loadProjectLinks(
	supabase: SupabaseClient,
	projectId: string
): Promise<ProjectLinkRow[]> {
	const { data, error } = await supabase
		.from('project_links')
		.select(LINK_COLUMNS)
		.eq('project_id', projectId)
		.order('sort_order', { ascending: true })
		.order('created_at', { ascending: true });

	if (error) {
		console.error('loadProjectLinks', error);
		return [];
	}

	return (data ?? []).map((r) => ({
		id: r.id,
		project_id: r.project_id,
		url: r.url,
		label: r.label,
		sort_order: r.sort_order
	}));
}

/** All links keyed by project_id — for the metadata sheet editor. */
export async function loadLinksByProject(
	supabase: SupabaseClient
): Promise<Record<string, ProjectLinkRow[]>> {
	const { data, error } = await supabase
		.from('project_links')
		.select(LINK_COLUMNS)
		.order('sort_order', { ascending: true })
		.order('created_at', { ascending: true });

	if (error) {
		console.error('loadLinksByProject', error);
		return {};
	}

	const map: Record<string, ProjectLinkRow[]> = {};
	for (const r of data ?? []) {
		const row: ProjectLinkRow = {
			id: r.id,
			project_id: r.project_id,
			url: r.url,
			label: r.label,
			sort_order: r.sort_order
		};
		const list = map[row.project_id];
		if (list) list.push(row);
		else map[row.project_id] = [row];
	}
	return map;
}

const SERIES_COLUMNS =
	'id, project_id, title, priority, notes, freq, interval, byweekday, bymonthday, ends, ends_count, ends_on, occurrence_seq, stopped_at';

export async function loadTaskSeriesByIds(
	supabase: SupabaseClient,
	ids: readonly string[]
): Promise<Record<string, ProjectTaskSeriesView>> {
	if (ids.length === 0) return {};
	const { data, error } = await supabase
		.from('project_task_series')
		.select(SERIES_COLUMNS)
		.in('id', [...ids])
		.is('deleted_at', null);

	if (error) {
		console.error('loadTaskSeriesByIds', error);
		return {};
	}

	const map: Record<string, ProjectTaskSeriesView> = {};
	for (const row of data ?? []) {
		if (!isTaskPriority(row.priority)) continue;
		if (row.freq !== 'weekly' && row.freq !== 'monthly') continue;
		if (row.ends !== 'never' && row.ends !== 'after_count' && row.ends !== 'on_date') continue;
		map[row.id] = {
			id: row.id,
			project_id: row.project_id,
			title: row.title,
			priority: row.priority,
			notes: row.notes,
			freq: row.freq,
			interval: row.interval,
			byweekday: row.byweekday,
			bymonthday: row.bymonthday,
			ends: row.ends,
			ends_count: row.ends_count,
			ends_on: row.ends_on,
			occurrence_seq: row.occurrence_seq,
			stopped_at: row.stopped_at
		};
	}
	return map;
}
