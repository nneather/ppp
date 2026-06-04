import { HEALTH_STATUSES, type HealthStatus, type ProjectUpdateRow } from '$lib/types/projects';

export type CarryForwardFields = Pick<
	ProjectUpdateRow,
	| 'health_status'
	| 'reason'
	| 'next_steps'
	| 'progress_value'
	| 'progress_max'
	| 'progress_note'
>;

export type CarryForwardRow = CarryForwardFields & {
	project_id: string;
	week_of: string;
};

function isHealthStatus(v: string): v is HealthStatus {
	return (HEALTH_STATUSES as readonly string[]).includes(v);
}

/**
 * Latest snapshot per project from rows with week_of strictly before the selected week.
 * Input must be ordered by week_of descending (newest first).
 */
export function reduceCarryForwardUpdates(rows: CarryForwardRow[]): Map<string, CarryForwardFields> {
	const map = new Map<string, CarryForwardFields>();
	for (const raw of rows) {
		if (map.has(raw.project_id)) continue;
		if (!isHealthStatus(raw.health_status)) continue;
		map.set(raw.project_id, {
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
