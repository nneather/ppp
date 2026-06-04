/** Closed enums and view-models for the projects module. */

export const LIFECYCLE_STATUSES = [
	'not_started',
	'idea',
	'active',
	'paused',
	'done',
	'archived'
] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export const LIFECYCLE_STATUS_LABELS: Record<LifecycleStatus, string> = {
	not_started: 'Not Started',
	idea: 'Idea',
	active: 'Active',
	paused: 'Paused',
	done: 'Done',
	archived: 'Archived'
};

/** Default visible lifecycles on /projects when no lifecycle filter is in the URL. */
export const DEFAULT_VISIBLE_LIFECYCLES = new Set<LifecycleStatus>(['active', 'paused', 'idea']);

export const HEALTH_STATUSES = [
	'excellent',
	'satisfactory',
	'watch',
	'serious',
	'critical'
] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = {
	excellent: 'Excellent',
	satisfactory: 'Satisfactory',
	watch: 'Watch',
	serious: 'Serious',
	critical: 'Critical'
};

/** Display order left → right on the inline 5-segment picker. */
export const HEALTH_STATUS_ORDER: readonly HealthStatus[] = HEALTH_STATUSES;

export type ProjectRow = {
	id: string;
	parent_id: string | null;
	name: string;
	description: string | null;
	lifecycle_status: LifecycleStatus;
	start_date: string | null;
	end_date: string | null;
	sort_order: number;
};

export type ProjectNode = ProjectRow & {
	children: ProjectNode[];
	depth: number;
};

export type ProjectUpdateRow = {
	id: string;
	project_id: string;
	week_of: string;
	health_status: HealthStatus;
	reason: string | null;
	next_steps: string | null;
};

export type WeeklyDraftRow = {
	project_id: string;
	/** Existing project_updates row id when re-saving the same week. */
	update_id?: string;
	health_status: HealthStatus;
	reason: string;
	next_steps: string;
};

export type ProjectFlatOption = {
	id: string;
	name: string;
	parent_id: string | null;
	depth: number;
};

export type LatestHealth = {
	health_status: HealthStatus;
	week_of: string;
	previous: HealthStatus | null;
};

export type TrendDirection = 'up' | 'down' | 'flat' | 'none';

export type ProjectFilters = {
	lifecycle: Set<LifecycleStatus>;
	health: HealthStatus | 'attention' | null;
	domain: string | null;
};
