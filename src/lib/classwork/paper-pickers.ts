import type { AssignmentListRow } from '$lib/types/classwork';

export type PickerOption = { value: string; label: string; hint?: string };

/** Case-insensitive, whitespace-tokenised AND filter over label + hint. */
export function filterPickerOptions(options: PickerOption[], query: string): PickerOption[] {
	const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return options;
	return options.filter((o) => {
		const hay = `${o.label} ${o.hint ?? ''}`.toLowerCase();
		return tokens.every((t) => hay.includes(t));
	});
}

/** Assignments to offer: only the chosen course's, or all when no course is chosen. */
export function assignmentsForCourse(
	assignments: AssignmentListRow[],
	courseId: string
): AssignmentListRow[] {
	return courseId ? assignments.filter((a) => a.course_id === courseId) : assignments;
}

/** Keep the chosen assignment only if it belongs to the (new) course; else clear it. */
export function reconcileAssignmentForCourse(
	assignmentId: string,
	courseId: string,
	assignments: AssignmentListRow[]
): string {
	if (!assignmentId || !courseId) return assignmentId;
	const a = assignments.find((x) => x.id === assignmentId);
	return a && a.course_id === courseId ? assignmentId : '';
}
