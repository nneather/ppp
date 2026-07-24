import { describe, expect, it } from 'vitest';
import {
	daysUntilDue,
	groupAssignmentsByCourse,
	groupAssignmentsByDate
} from '$lib/classwork/server/loaders';
import { parentPickerOptions } from '$lib/classwork/parent-picker';
import type { AssignmentListRow, CourseRow } from '$lib/types/classwork';

function row(partial: Partial<AssignmentListRow> & { id: string }): AssignmentListRow {
	return {
		course_id: 'c1',
		course_name: 'Psalms',
		course_code: 'OT512',
		parent_id: null,
		title: 'Assignment',
		kind: 'paper',
		status: 'not_started',
		due_date: '2026-09-01',
		completed_at: null,
		notes: null,
		sort_order: 0,
		days_until: 0,
		...partial
	};
}

describe('daysUntilDue', () => {
	it('returns negative for overdue', () => {
		expect(daysUntilDue('2026-08-01', '2026-08-10')).toBe(-9);
	});
	it('returns 0 for today', () => {
		expect(daysUntilDue('2026-08-10', '2026-08-10')).toBe(0);
	});
});

describe('groupAssignmentsByDate', () => {
	it('surfaces overdue buckets first', () => {
		const groups = groupAssignmentsByDate([
			row({ id: 'a', due_date: '2026-09-01', days_until: 20 }),
			row({ id: 'b', due_date: '2026-08-01', days_until: -10 })
		]);
		expect(groups.map((g) => g.due_date)).toEqual(['2026-08-01', '2026-09-01']);
		expect(groups[0]!.hasOverdue).toBe(true);
	});
});

describe('groupAssignmentsByCourse', () => {
	it('orders by course list order then due_date', () => {
		const courses: CourseRow[] = [
			{
				id: 'c2',
				name: 'Hebrews',
				code: null,
				instructor: null,
				term: null,
				status: 'active',
				project_id: null,
				notes: null,
				sort_order: 0,
				assignmentCount: 1
			},
			{
				id: 'c1',
				name: 'Psalms',
				code: 'OT512',
				instructor: null,
				term: null,
				status: 'active',
				project_id: null,
				notes: null,
				sort_order: 1,
				assignmentCount: 1
			}
		];
		const groups = groupAssignmentsByCourse(
			[
				row({ id: 'a', course_id: 'c1', due_date: '2026-10-01' }),
				row({
					id: 'b',
					course_id: 'c2',
					course_name: 'Hebrews',
					course_code: null,
					due_date: '2026-09-01'
				})
			],
			courses
		);
		expect(groups.map((g) => g.course_id)).toEqual(['c2', 'c1']);
	});
});

describe('parentPickerOptions', () => {
	it('excludes self and descendants', () => {
		const assignments = [
			row({ id: 'root', title: 'Paper' }),
			row({ id: 'draft', title: 'Draft', parent_id: 'root' }),
			row({ id: 'other', title: 'Quiz' })
		];
		const opts = parentPickerOptions(assignments, 'c1', 'root');
		expect(opts.map((a) => a.id)).toEqual(['other']);
	});
});
