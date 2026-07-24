import type { AssignmentListRow } from '$lib/types/classwork';

function collectAssignmentDescendantIds(
	rows: { id: string; parent_id: string | null }[],
	rootId: string
): Set<string> {
	const childrenByParent = new Map<string, string[]>();
	for (const r of rows) {
		if (r.parent_id == null) continue;
		const list = childrenByParent.get(r.parent_id);
		if (list) list.push(r.id);
		else childrenByParent.set(r.parent_id, [r.id]);
	}
	const out = new Set<string>();
	const stack = [...(childrenByParent.get(rootId) ?? [])];
	while (stack.length > 0) {
		const id = stack.pop()!;
		if (out.has(id)) continue;
		out.add(id);
		const kids = childrenByParent.get(id);
		if (kids) stack.push(...kids);
	}
	return out;
}

/** Same-course parent candidates, excluding self + descendants (for sheet picker). */
export function parentPickerOptions(
	assignments: AssignmentListRow[],
	courseId: string,
	excludeId: string | null
): AssignmentListRow[] {
	const sameCourse = assignments.filter((a) => a.course_id === courseId);
	if (!excludeId) return sameCourse;

	const blocked = collectAssignmentDescendantIds(sameCourse, excludeId);
	blocked.add(excludeId);
	return sameCourse.filter((a) => !blocked.has(a.id));
}
