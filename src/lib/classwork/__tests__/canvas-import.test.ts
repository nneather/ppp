import { describe, expect, it } from 'vitest';
import { planCanvasImport } from '$lib/classwork/server/canvas-import';
import type { CanvasAssignmentInput, CanvasCourseInput } from '$lib/classwork/canvas-map';

describe('planCanvasImport', () => {
	it('inserts FA-26 work and skips Default Term plus attendance/zero-pt', () => {
		const courses: CanvasCourseInput[] = [
			{
				id: 3836,
				name: 'CM340 -\n01:\nPreaching & Culture\nFall 2026',
				course_code: 'CM340',
				term: { name: 'FA-26' },
				teachers: [{ display_name: 'Dr. Richard' }]
			},
			{
				id: 3140,
				name: 'MDIV/MABTS Theology Exam #1 (SP-25 CTS130.S)',
				course_code: 'SP-25 CTS130.S',
				term: { name: 'Default Term' }
			}
		];
		const cm340: CanvasAssignmentInput[] = [
			{
				id: 23464,
				name: 'Sermon 1: Expository Sermon from Ecclesiates',
				due_at: '2026-09-18T04:59:59Z',
				published: true,
				points_possible: 100
			},
			{
				id: 1,
				name: 'Attendance and Participation',
				due_at: '2026-11-01T04:59:59Z',
				published: true,
				points_possible: 10
			},
			{
				id: 2,
				name: 'A2-A5 Check',
				due_at: '2026-09-10T15:00:00Z',
				published: true,
				points_possible: 0,
				is_quiz_assignment: true
			}
		];
		const preview = planCanvasImport(
			{
				self: { id: 5812, name: 'Parker Neathery' },
				courses,
				assignmentsByCourseId: new Map([
					[3836, cm340],
					[3140, [{ id: 9, name: 'Theology Exam #1', due_at: '2025-05-03T04:59:59Z', published: true, points_possible: 87 }]]
				])
			},
			{
				courses: [],
				assignments: [],
				projects: [
					{ id: 'edu', name: 'Education', parent_id: null },
					{ id: 'preach', name: 'Preaching and Culture', parent_id: 'edu' }
				]
			},
			{ termCode: 'FA-26' }
		);
		expect(preview.courses).toHaveLength(1);
		expect(preview.courses[0]).toMatchObject({
			action: 'insert',
			name: 'Preaching & Culture',
			code: 'CM340',
			projectId: 'preach'
		});
		expect(preview.assignments.map((a) => a.title)).toEqual([
			'Sermon 1: Expository Sermon from Ecclesiates'
		]);
		expect(preview.assignments[0]?.kind).toBe('presentation');
		expect(preview.assignments[0]?.dueDate).toBe('2026-09-17');
		expect(preview.skipped.map((s) => s.reason).sort()).toEqual(['attendance', 'default_term', 'zero_point']);
	});
});
