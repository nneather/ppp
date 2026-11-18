import { describe, expect, it } from 'vitest';
import {
	assignmentsForCourse,
	filterPickerOptions,
	reconcileAssignmentForCourse
} from '$lib/classwork/paper-pickers';
import type { AssignmentListRow } from '$lib/types/classwork';

const a = (id: string, course_id: string) => ({ id, course_id }) as AssignmentListRow;
const rows = [a('a1', 'c1'), a('a2', 'c1'), a('a3', 'c2')];

describe('paper-pickers', () => {
	it('filters options by all tokens, case-insensitively, incl. hint', () => {
		const opts = [
			{ value: '1', label: 'Exegesis Paper', hint: 'BIB 501' },
			{ value: '2', label: 'Book Review', hint: 'THE 610' }
		];
		expect(filterPickerOptions(opts, '')).toEqual(opts);
		expect(filterPickerOptions(opts, 'exeg 501').map((o) => o.value)).toEqual(['1']);
		expect(filterPickerOptions(opts, 'zzz')).toEqual([]);
	});

	it('assignmentsForCourse limits to the course; all when none chosen; empty course -> []', () => {
		expect(assignmentsForCourse(rows, 'c1').map((x) => x.id)).toEqual(['a1', 'a2']);
		expect(assignmentsForCourse(rows, '')).toHaveLength(3);
		expect(assignmentsForCourse(rows, 'c9')).toEqual([]);
	});

	it('reconcile keeps matching assignment and clears a mismatched one', () => {
		expect(reconcileAssignmentForCourse('a1', 'c1', rows)).toBe('a1');
		expect(reconcileAssignmentForCourse('a1', 'c2', rows)).toBe('');
		expect(reconcileAssignmentForCourse('a1', '', rows)).toBe('a1');
		expect(reconcileAssignmentForCourse('', 'c2', rows)).toBe('');
	});
});
