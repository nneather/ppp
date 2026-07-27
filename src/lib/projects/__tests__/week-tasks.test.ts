import { describe, expect, it } from 'vitest';
import {
	clampWeekTaskDays,
	compareWeekHorizonTasks,
	isCarriedOverPriority,
	summarizeWeekTasksByProject,
	WEEK_TASK_DAYS_DEFAULT
} from '../week-tasks';
import { isProjectDeferred } from '../deferred';

describe('clampWeekTaskDays', () => {
	it('defaults to 7', () => {
		expect(clampWeekTaskDays(undefined)).toBe(WEEK_TASK_DAYS_DEFAULT);
	});

	it('clamps to 1–31', () => {
		expect(clampWeekTaskDays(0)).toBe(1);
		expect(clampWeekTaskDays(-3)).toBe(1);
		expect(clampWeekTaskDays(1)).toBe(1);
		expect(clampWeekTaskDays(10)).toBe(10);
		expect(clampWeekTaskDays(31)).toBe(31);
		expect(clampWeekTaskDays(99)).toBe(31);
	});

	it('truncates non-integers', () => {
		expect(clampWeekTaskDays(7.9)).toBe(7);
	});
});

describe('compareWeekHorizonTasks', () => {
	it('sorts by start_date asc then zone', () => {
		const rows = [
			{ id: 'c', start_date: '2026-07-30', priority: 'critical_now' as const },
			{ id: 'a', start_date: '2026-07-24', priority: 'over_horizon' as const },
			{ id: 'b', start_date: '2026-07-24', priority: 'critical_now' as const },
			{ id: 'd', start_date: '2026-07-24', priority: 'opportunity_now' as const }
		];
		rows.sort(compareWeekHorizonTasks);
		expect(rows.map((r) => r.id)).toEqual(['b', 'd', 'a', 'c']);
	});
});

describe('summarizeWeekTasksByProject', () => {
	it('groups by project with count desc', () => {
		const groups = summarizeWeekTasksByProject([
			{ project_id: 'p1', project_name: 'Alpha' },
			{ project_id: 'p2', project_name: 'Beta' },
			{ project_id: 'p1', project_name: 'Alpha' }
		]);
		expect(groups).toEqual([
			{ project_id: 'p1', project_name: 'Alpha', count: 2 },
			{ project_id: 'p2', project_name: 'Beta', count: 1 }
		]);
	});
});

describe('isCarriedOverPriority', () => {
	it('includes Critical and Opportunity only', () => {
		expect(isCarriedOverPriority('critical_now')).toBe(true);
		expect(isCarriedOverPriority('opportunity_now')).toBe(true);
		expect(isCarriedOverPriority('over_horizon')).toBe(false);
	});
});

describe('isProjectDeferred', () => {
	it('is true only when deferred_until is strictly after today', () => {
		expect(isProjectDeferred('2026-08-09', '2026-07-27')).toBe(true);
		expect(isProjectDeferred('2026-07-27', '2026-07-27')).toBe(false);
		expect(isProjectDeferred('2026-07-26', '2026-07-27')).toBe(false);
		expect(isProjectDeferred(null, '2026-07-27')).toBe(false);
	});
});
