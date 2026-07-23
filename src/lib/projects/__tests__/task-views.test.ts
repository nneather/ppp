import { describe, expect, it } from 'vitest';
import { addDaysYmd, nextMondayYmdChicago } from '$lib/invoicing/chicago-date';
import {
	parseTaskSavedViews,
	resolveTaskViewProjectIds,
	truncateTasksToSoftCap,
	type TaskSavedView
} from '$lib/projects/task-views';
import type { ProjectRow, ProjectTaskView, TaskPriority } from '$lib/types/projects';

describe('nextMondayYmdChicago', () => {
	it('from Sunday returns the next day Monday', () => {
		// 2026-07-19 is Sunday
		expect(nextMondayYmdChicago('2026-07-19')).toBe('2026-07-20');
	});

	it('from Monday returns the following Monday', () => {
		expect(nextMondayYmdChicago('2026-07-20')).toBe('2026-07-27');
	});

	it('from Wednesday returns upcoming Monday', () => {
		expect(nextMondayYmdChicago('2026-07-22')).toBe('2026-07-27');
	});

	it('addDaysYmd advances civil dates', () => {
		expect(addDaysYmd('2026-07-22', 1)).toBe('2026-07-23');
		expect(addDaysYmd('2026-07-22', 7)).toBe('2026-07-29');
	});
});

const rootA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const childA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab';
const rootB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const rootC = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function row(id: string, parent_id: string | null, name: string): ProjectRow {
	return {
		id,
		parent_id,
		name,
		description: null,
		lifecycle_status: 'active',
		start_date: null,
		end_date: null,
		sort_order: 0,
		color: null
	};
}

const flatRows: ProjectRow[] = [
	row(rootA, null, 'Work'),
	row(childA, rootA, 'Email Inbox'),
	row(rootB, null, 'Education'),
	row(rootC, null, 'Personal')
];

describe('parseTaskSavedViews', () => {
	it('keeps valid views and drops junk', () => {
		const views = parseTaskSavedViews([
			{ id: 'v1', name: 'No email', mode: 'exclude', projectIds: [rootA] },
			{ id: '', name: 'bad', mode: 'only', projectIds: [rootB] },
			{ name: 'no id', mode: 'include', projectIds: [] },
			null,
			{ id: 'v2', name: 'Edu', mode: 'only', projectIds: [rootB, 'not-a-uuid'] }
		]);
		expect(views).toEqual([
			{ id: 'v1', name: 'No email', mode: 'exclude', projectIds: [rootA] },
			{ id: 'v2', name: 'Edu', mode: 'only', projectIds: [rootB] }
		]);
	});
});

describe('resolveTaskViewProjectIds', () => {
	it('only expands root + descendants', () => {
		const view: TaskSavedView = {
			id: 'v',
			name: 'Work',
			mode: 'only',
			projectIds: [rootA]
		};
		const ids = resolveTaskViewProjectIds(flatRows, view);
		expect(ids.sort()).toEqual([rootA, childA].sort());
	});

	it('exclude removes roots + descendants', () => {
		const view: TaskSavedView = {
			id: 'v',
			name: 'No work',
			mode: 'exclude',
			projectIds: [rootA]
		};
		const ids = resolveTaskViewProjectIds(flatRows, view);
		expect(ids.sort()).toEqual([rootB, rootC].sort());
	});
});

function task(
	id: string,
	priority: TaskPriority,
	start_date: string,
	sort_order = 0
): ProjectTaskView {
	return {
		id,
		project_id: rootA,
		title: id,
		priority,
		start_date,
		completed_at: null,
		sort_order,
		notes: null,
		series_id: null,
		series_occurrence: null,
		project_name: 'Work',
		domain_color: null
	};
}

describe('truncateTasksToSoftCap', () => {
	it('keeps all when under cap', () => {
		const tasks = [task('1', 'critical_now', '2026-07-22')];
		const r = truncateTasksToSoftCap(tasks, 50);
		expect(r.truncated).toBe(false);
		expect(r.kept).toHaveLength(1);
		expect(r.openCount).toBe(1);
	});

	it('hides lowest priority first, then oldest start_date', () => {
		const tasks = [
			task('cn-new', 'critical_now', '2026-07-22'),
			task('on-new', 'opportunity_now', '2026-07-22'),
			task('oth-old', 'over_horizon', '2026-07-01'),
			task('oth-new', 'over_horizon', '2026-07-20'),
			task('on-old', 'opportunity_now', '2026-07-01')
		];
		const r = truncateTasksToSoftCap(tasks, 3);
		expect(r.truncated).toBe(true);
		expect(r.openCount).toBe(5);
		// Evict both OTH first (lowest priority), keep CN + both ON
		expect(r.kept.map((t) => t.id).sort()).toEqual(['cn-new', 'on-new', 'on-old'].sort());
	});

	it('within same priority, hides oldest start_date first', () => {
		const tasks = [
			task('a', 'opportunity_now', '2026-07-01'),
			task('b', 'opportunity_now', '2026-07-10'),
			task('c', 'opportunity_now', '2026-07-20')
		];
		const r = truncateTasksToSoftCap(tasks, 2);
		expect(r.kept.map((t) => t.id).sort()).toEqual(['b', 'c'].sort());
	});
});
