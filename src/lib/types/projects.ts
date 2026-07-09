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
	/** Domain color palette key (e.g. ocean); typically set on roots. */
	color: string | null;
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
	/** NULL = progress tracking off for this week. */
	progress_value: number | null;
	progress_max: number | null;
	progress_note: string | null;
};

export type WeeklyDraftRow = {
	project_id: string;
	/** Existing project_updates row id when re-saving the same week. */
	update_id?: string;
	health_status: HealthStatus;
	reason: string;
	next_steps: string;
	progress_value: number | null;
	progress_max: number | null;
	progress_note: string | null;
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

/** MYN urgency zones (maps to Outlook High / Normal / Low). */
export const TASK_PRIORITIES = [
	'critical_now',
	'opportunity_now',
	'over_horizon'
] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
	critical_now: 'Critical Now',
	opportunity_now: 'Opportunity Now',
	over_horizon: 'Over the Horizon'
};

/** MYN soft caps for visible open tasks per zone. */
export const TASK_ZONE_CAPS: Record<TaskPriority, number | null> = {
	critical_now: 5,
	opportunity_now: 20,
	over_horizon: null
};

/** Zone display order on the MYN task page. */
export const TASK_PRIORITY_ORDER: readonly TaskPriority[] = TASK_PRIORITIES;

export type ProjectTaskRow = {
	id: string;
	project_id: string;
	title: string;
	priority: TaskPriority;
	start_date: string;
	completed_at: string | null;
	sort_order: number;
	notes: string | null;
};

export type ProjectTaskView = ProjectTaskRow & {
	project_name: string;
	/** Root domain palette key (inherited via parent_id walk); null if unset. */
	domain_color: string | null;
};

export type TaskZoneGroup = {
	priority: TaskPriority;
	label: string;
	cap: number | null;
	tasks: ProjectTaskView[];
	count: number;
	overCap: boolean;
};

export type ProjectLinkRow = {
	id: string;
	project_id: string;
	url: string;
	label: string | null;
	sort_order: number;
};
