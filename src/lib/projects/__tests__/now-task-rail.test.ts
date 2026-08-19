import { describe, expect, it } from 'vitest';
import { isNowTaskRailData, taskFormAction } from '$lib/projects/now-task-rail';

describe('taskFormAction', () => {
	it('uses the current page when prefix is empty', () => {
		expect(taskFormAction('completeTask')).toBe('?/completeTask');
		expect(taskFormAction('createTask', '')).toBe('?/createTask');
	});

	it('posts to /tasks when the rail is mounted on another route', () => {
		expect(taskFormAction('completeTask', '/tasks')).toBe('/tasks?/completeTask');
		expect(taskFormAction('deferTask', '/tasks')).toBe('/tasks?/deferTask');
	});
});

describe('isNowTaskRailData', () => {
	it('accepts a payload with zones and todayYmd', () => {
		expect(
			isNowTaskRailData({
				zones: [],
				todayYmd: '2026-08-19',
				seriesById: {},
				projectOptions: [],
				defaultTaskProjectId: null,
				criticalNowCount: 0,
				opportunityNowCount: 0
			})
		).toBe(true);
	});

	it('rejects missing zones or date', () => {
		expect(isNowTaskRailData(null)).toBe(false);
		expect(isNowTaskRailData({ todayYmd: '2026-08-19' })).toBe(false);
		expect(isNowTaskRailData({ zones: [] })).toBe(false);
	});
});
