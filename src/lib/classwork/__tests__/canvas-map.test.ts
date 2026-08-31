import { describe, expect, it } from 'vitest';
import {
	canvasInstructors,
	defaultMinDueYmd,
	dueAtToChicagoYmd,
	formatCanvasTerm,
	guessAssignmentKind,
	matchEducationProject,
	parseCanvasCourseName,
	skipAssignment,
	skipCourse
} from '$lib/classwork/canvas-map';

describe('formatCanvasTerm', () => {
	it('maps FA-26 to Fall 2026', () => {
		expect(formatCanvasTerm('FA-26')).toBe('Fall 2026');
	});
	it('returns null for Default Term', () => {
		expect(formatCanvasTerm('Default Term')).toBeNull();
	});
});

describe('defaultMinDueYmd', () => {
	it('uses August 1 for fall terms', () => {
		expect(defaultMinDueYmd('FA-26')).toBe('2026-08-01');
	});
	it('uses January 1 for spring terms', () => {
		expect(defaultMinDueYmd('SP-27')).toBe('2027-01-01');
	});
});

describe('parseCanvasCourseName', () => {
	it('strips Covenant newlines and section codes', () => {
		expect(
			parseCanvasCourseName(
				'AT411 -\n01:\nField Education Practicum\nFall 2026',
				'AT411',
				'FA-26'
			)
		).toBe('Field Education Practicum');
	});
	it('keeps a subtitle after the section', () => {
		expect(
			parseCanvasCourseName(
				'CG515 -\nW:\nChurch Planting Trip: Nashville\nFall 2026',
				'CG515',
				'FA-26'
			)
		).toBe('Church Planting Trip: Nashville');
	});
	it('splits a glued term suffix', () => {
		expect(
			parseCanvasCourseName('OT340 -01:Psalms & Wisdom LiteratureFall 2026', 'OT340', 'FA-26')
		).toBe('Psalms & Wisdom Literature');
	});
});

describe('dueAtToChicagoYmd', () => {
	it('maps 11:59pm CDT to the previous civil date', () => {
		expect(dueAtToChicagoYmd('2026-09-19T04:59:59Z')).toBe('2026-09-18');
	});
	it('keeps a midday UTC instant on the same Chicago date', () => {
		expect(dueAtToChicagoYmd('2026-09-03T15:00:00Z')).toBe('2026-09-03');
	});
});

describe('guessAssignmentKind', () => {
	it('classifies quizzes, exams, papers, sermons', () => {
		expect(guessAssignmentKind({ id: 1, name: 'A1 Check', is_quiz_assignment: true })).toBe(
			'quiz'
		);
		expect(guessAssignmentKind({ id: 2, name: 'Midterm exam - Wisdom books' })).toBe('exam');
		expect(guessAssignmentKind({ id: 3, name: 'Resilient Ministry Paper' })).toBe('paper');
		expect(guessAssignmentKind({ id: 4, name: 'Sermon 1: Expository Sermon from Ecclesiates' })).toBe(
			'presentation'
		);
		expect(guessAssignmentKind({ id: 5, name: 'Sermon 1 Personal Review' })).toBe('other');
		expect(guessAssignmentKind({ id: 6, name: 'Reading Log' })).toBe('reading');
		expect(guessAssignmentKind({ id: 7, name: 'Proverbs 31:1-9 Translation' })).toBe('other');
	});
});

describe('skipCourse / skipAssignment', () => {
	const fa = { termCode: 'FA-26', minDueYmd: '2026-08-01' };

	it('skips Default Term shells', () => {
		expect(
			skipCourse({ id: 1, name: 'Theology Exam', term: { name: 'Default Term' } }, fa)
		).toBe('default_term');
	});
	it('skips attendance, 0-pt, makeup, and stale dues', () => {
		expect(
			skipAssignment(
				{ id: 1, name: 'Attendance and Participation', due_at: '2026-11-01T04:59:59Z', published: true, points_possible: 10 },
				'2026-10-31',
				fa
			)
		).toBe('attendance');
		expect(
			skipAssignment(
				{ id: 2, name: 'A2-A5 Check', due_at: '2026-09-10T15:00:00Z', published: true, points_possible: 0, is_quiz_assignment: true },
				'2026-09-10',
				fa
			)
		).toBe('zero_point');
		expect(
			skipAssignment(
				{ id: 3, name: 'Late Book Reading', due_at: '2026-12-19T05:59:59Z', published: true, points_possible: 0 },
				'2026-12-18',
				fa
			)
		).toBe('makeup');
		expect(
			skipAssignment(
				{ id: 4, name: 'Case Study', due_at: '2025-11-09T05:59:00Z', published: true, points_possible: 100 },
				'2025-11-08',
				fa
			)
		).toBe('stale_due');
	});
	it('keeps a graded fall assignment', () => {
		expect(
			skipAssignment(
				{ id: 5, name: 'A1 Check', due_at: '2026-09-03T15:00:00Z', published: true, points_possible: 10, is_quiz_assignment: true },
				'2026-09-03',
				fa
			)
		).toBeNull();
	});
});

describe('matchEducationProject', () => {
	const projects = [
		{ id: 'p1', name: 'Preaching and Culture' },
		{ id: 'p2', name: 'Psalms and Wisdom Literature' }
	];
	it('matches ampersand to and', () => {
		expect(matchEducationProject('Preaching & Culture', projects)).toBe('p1');
		expect(matchEducationProject('Psalms & Wisdom Literature', projects)).toBe('p2');
	});
	it('returns null when no Education child matches', () => {
		expect(matchEducationProject('Church Planting Trip: Nashville', projects)).toBeNull();
	});
});

describe('canvasInstructors', () => {
	it('joins unique display names', () => {
		expect(
			canvasInstructors([
				{ display_name: 'Aaron Goldstein' },
				{ display_name: 'Tess Merrell' },
				{ name: 'Aaron Goldstein' }
			])
		).toBe('Aaron Goldstein, Tess Merrell');
	});
});
