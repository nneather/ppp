import type { SupabaseClient } from '@supabase/supabase-js';
import { addDaysYmd } from '$lib/invoicing/chicago-date';
import { findDomainRootId } from '$lib/projects/filter';
import {
	collectDescendantIds,
	flattenProjectTree,
	loadProjectRows,
	loadProjectTree
} from '$lib/projects/server/loaders';
import {
	ASSIGNMENT_KINDS,
	ASSIGNMENT_STATUSES,
	CLASSWORK_GROUPS,
	COURSE_STATUSES,
	type AssignmentKind,
	type AssignmentListRow,
	type AssignmentStatus,
	type ClassworkGroup,
	type ClassworkListFilters,
	type ClassworkProjectOption,
	type CourseRow,
	type CourseStatus,
	type DueSoonAssignment
} from '$lib/types/classwork';

const COURSE_COLUMNS =
	'id, name, code, instructor, term, status, project_id, notes, sort_order';

const ASSIGNMENT_COLUMNS =
	'id, course_id, parent_id, title, kind, status, due_date, completed_at, notes, sort_order';

type CourseDb = {
	id: string;
	name: string;
	code: string | null;
	instructor: string | null;
	term: string | null;
	status: string;
	project_id: string | null;
	notes: string | null;
	sort_order: number;
};

type AssignmentDb = {
	id: string;
	course_id: string;
	parent_id: string | null;
	title: string;
	kind: string;
	status: string;
	due_date: string;
	completed_at: string | null;
	notes: string | null;
	sort_order: number;
};

function asCourseStatus(v: string): CourseStatus | null {
	return (COURSE_STATUSES as readonly string[]).includes(v) ? (v as CourseStatus) : null;
}

function asAssignmentKind(v: string): AssignmentKind | null {
	return (ASSIGNMENT_KINDS as readonly string[]).includes(v) ? (v as AssignmentKind) : null;
}

function asAssignmentStatus(v: string): AssignmentStatus | null {
	return (ASSIGNMENT_STATUSES as readonly string[]).includes(v) ? (v as AssignmentStatus) : null;
}

/** Days until due_date vs Chicago todayYmd. Negative = overdue. */
export function daysUntilDue(dueYmd: string, todayYmd: string): number {
	const due = Date.parse(`${dueYmd}T12:00:00Z`);
	const today = Date.parse(`${todayYmd}T12:00:00Z`);
	if (!Number.isFinite(due) || !Number.isFinite(today)) return 0;
	return Math.round((due - today) / 86_400_000);
}

/**
 * Open assignments with due_date on/before today+horizon (overdue first via date asc).
 * Pure helper for unit tests; loader applies the same filter in SQL.
 */
export function selectDueSoon(
	assignments: AssignmentListRow[],
	opts: { todayYmd: string; horizonDays: number }
): DueSoonAssignment[] {
	const horizon = Math.max(0, Math.floor(opts.horizonDays));
	const out: DueSoonAssignment[] = [];
	for (const a of assignments) {
		if (a.status === 'done') continue;
		const days = a.days_until ?? daysUntilDue(a.due_date, opts.todayYmd);
		if (days > horizon) continue;
		out.push({ ...a, days_until: days });
	}
	out.sort(
		(a, b) =>
			a.due_date.localeCompare(b.due_date) ||
			a.title.localeCompare(b.title) ||
			a.id.localeCompare(b.id)
	);
	return out;
}

/**
 * Open assignments due within `horizonDays` of Chicago today (default 14).
 * Overdue rows included; ordered by due_date ascending (most overdue first).
 */
export async function loadDueSoonAssignments(
	supabase: SupabaseClient,
	opts: { todayYmd: string; horizonDays?: number; limit?: number }
): Promise<{
	assignments: DueSoonAssignment[];
	horizonDays: number;
	horizonEnd: string;
	error: string | null;
}> {
	const todayYmd = opts.todayYmd;
	const horizonDays = Math.max(0, Math.floor(opts.horizonDays ?? 14));
	const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
	const horizonEnd = addDaysYmd(todayYmd, horizonDays) ?? todayYmd;

	const assignmentsRes = await supabase
		.from('assignments')
		.select(ASSIGNMENT_COLUMNS)
		.is('deleted_at', null)
		.neq('status', 'done')
		.lte('due_date', horizonEnd)
		.order('due_date', { ascending: true })
		.order('title', { ascending: true })
		.limit(limit);

	if (assignmentsRes.error) {
		console.error('[classwork] loadDueSoonAssignments', assignmentsRes.error);
		return {
			assignments: [],
			horizonDays,
			horizonEnd,
			error: assignmentsRes.error.message
		};
	}

	const rows = (assignmentsRes.data ?? []) as AssignmentDb[];
	const courseIds = [...new Set(rows.map((r) => r.course_id))];
	const coursesRes = courseIds.length
		? await supabase
				.from('courses')
				.select('id, name, code')
				.in('id', courseIds)
				.is('deleted_at', null)
		: { data: [] as { id: string; name: string; code: string | null }[], error: null };

	if (coursesRes.error) {
		console.error('[classwork] due-soon courses', coursesRes.error);
	}

	const courseById = new Map<string, { name: string; code: string | null }>();
	for (const c of coursesRes.data ?? []) {
		const row = c as { id: string; name: string; code: string | null };
		courseById.set(row.id, { name: row.name, code: row.code });
	}

	const assignments: DueSoonAssignment[] = [];
	for (const raw of rows) {
		const kind = asAssignmentKind(raw.kind);
		const status = asAssignmentStatus(raw.status);
		if (!kind || !status || status === 'done') continue;
		const course = courseById.get(raw.course_id);
		assignments.push({
			id: raw.id,
			course_id: raw.course_id,
			course_name: course?.name ?? 'Unknown course',
			course_code: course?.code ?? null,
			parent_id: raw.parent_id,
			title: raw.title,
			kind,
			status,
			due_date: raw.due_date,
			completed_at: raw.completed_at,
			notes: raw.notes,
			sort_order: raw.sort_order,
			days_until: daysUntilDue(raw.due_date, todayYmd)
		});
	}

	return { assignments, horizonDays, horizonEnd, error: null };
}

export function parseClassworkListFilters(url: URL): ClassworkListFilters {
	const groupRaw = url.searchParams.get('group');
	const group: ClassworkGroup =
		groupRaw && (CLASSWORK_GROUPS as readonly string[]).includes(groupRaw)
			? (groupRaw as ClassworkGroup)
			: 'date';

	const courseId = url.searchParams.get('course');
	return {
		group,
		courseId: courseId && courseId.length > 0 ? courseId : null
	};
}

export async function loadCourses(supabase: SupabaseClient): Promise<{
	courses: CourseRow[];
	error: string | null;
}> {
	const [coursesRes, countsRes] = await Promise.all([
		supabase
			.from('courses')
			.select(COURSE_COLUMNS)
			.is('deleted_at', null)
			.order('sort_order', { ascending: true })
			.order('name', { ascending: true }),
		supabase.from('assignments').select('course_id').is('deleted_at', null)
	]);

	if (coursesRes.error) {
		console.error('[classwork] loadCourses', coursesRes.error);
		return { courses: [], error: coursesRes.error.message };
	}
	if (countsRes.error) {
		console.error('[classwork] assignment counts', countsRes.error);
	}

	const countByCourse = new Map<string, number>();
	for (const row of countsRes.data ?? []) {
		const cid = (row as { course_id: string }).course_id;
		countByCourse.set(cid, (countByCourse.get(cid) ?? 0) + 1);
	}

	const courses: CourseRow[] = [];
	for (const raw of (coursesRes.data ?? []) as CourseDb[]) {
		const status = asCourseStatus(raw.status);
		if (!status) continue;
		courses.push({
			id: raw.id,
			name: raw.name,
			code: raw.code,
			instructor: raw.instructor,
			term: raw.term,
			status,
			project_id: raw.project_id,
			notes: raw.notes,
			sort_order: raw.sort_order,
			assignmentCount: countByCourse.get(raw.id) ?? 0
		});
	}

	return { courses, error: null };
}

export async function loadAssignments(
	supabase: SupabaseClient,
	opts: { todayYmd: string; courseId?: string | null }
): Promise<{
	assignments: AssignmentListRow[];
	error: string | null;
}> {
	let q = supabase
		.from('assignments')
		.select(ASSIGNMENT_COLUMNS)
		.is('deleted_at', null)
		.order('due_date', { ascending: true })
		.order('title', { ascending: true });

	if (opts.courseId) {
		q = q.eq('course_id', opts.courseId);
	}

	const assignmentsRes = await q;
	if (assignmentsRes.error) {
		console.error('[classwork] loadAssignments', assignmentsRes.error);
		return { assignments: [], error: assignmentsRes.error.message };
	}

	const rows = (assignmentsRes.data ?? []) as AssignmentDb[];
	const courseIds = [...new Set(rows.map((r) => r.course_id))];
	const coursesRes = courseIds.length
		? await supabase
				.from('courses')
				.select('id, name, code')
				.in('id', courseIds)
				.is('deleted_at', null)
		: { data: [] as { id: string; name: string; code: string | null }[], error: null };

	if (coursesRes.error) {
		console.error('[classwork] assignment courses', coursesRes.error);
	}

	const courseById = new Map<string, { name: string; code: string | null }>();
	for (const c of coursesRes.data ?? []) {
		const row = c as { id: string; name: string; code: string | null };
		courseById.set(row.id, { name: row.name, code: row.code });
	}

	const assignments: AssignmentListRow[] = [];
	for (const raw of rows) {
		const kind = asAssignmentKind(raw.kind);
		const status = asAssignmentStatus(raw.status);
		if (!kind || !status) continue;
		const course = courseById.get(raw.course_id);
		assignments.push({
			id: raw.id,
			course_id: raw.course_id,
			course_name: course?.name ?? 'Unknown course',
			course_code: course?.code ?? null,
			parent_id: raw.parent_id,
			title: raw.title,
			kind,
			status,
			due_date: raw.due_date,
			completed_at: raw.completed_at,
			notes: raw.notes,
			sort_order: raw.sort_order,
			days_until: status === 'done' ? null : daysUntilDue(raw.due_date, opts.todayYmd)
		});
	}

	return { assignments, error: null };
}

/**
 * Project picker options: Education subtree first (`suggested`), then the rest.
 * C2: suggest-only — caller may still pick a non-suggested id.
 */
export async function loadClassworkProjectOptions(supabase: SupabaseClient): Promise<{
	options: ClassworkProjectOption[];
	error: string | null;
}> {
	const [tree, rows] = await Promise.all([loadProjectTree(supabase), loadProjectRows(supabase)]);
	const flat = flattenProjectTree(tree);
	const educationRootId = findDomainRootId(tree, 'Education');
	const educationIds = new Set<string>();
	if (educationRootId) {
		educationIds.add(educationRootId);
		for (const id of collectDescendantIds(rows, educationRootId)) {
			educationIds.add(id);
		}
	}

	const options: ClassworkProjectOption[] = flat.map((p) => ({
		id: p.id,
		name: p.name,
		depth: p.depth,
		suggested: educationIds.has(p.id)
	}));

	options.sort((a, b) => {
		if (a.suggested !== b.suggested) return a.suggested ? -1 : 1;
		return a.name.localeCompare(b.name) || a.depth - b.depth;
	});

	return { options, error: null };
}

export type DateGroup = {
	due_date: string;
	/** True when any open assignment in the group is overdue. */
	hasOverdue: boolean;
	assignments: AssignmentListRow[];
};

export type CourseGroup = {
	course_id: string;
	course_name: string;
	course_code: string | null;
	assignments: AssignmentListRow[];
};

/** Group by due_date; overdue dates first (among open), then chronological. Done stay in date order. */
export function groupAssignmentsByDate(assignments: AssignmentListRow[]): DateGroup[] {
	const byDate = new Map<string, AssignmentListRow[]>();
	for (const a of assignments) {
		const list = byDate.get(a.due_date);
		if (list) list.push(a);
		else byDate.set(a.due_date, [a]);
	}

	const groups: DateGroup[] = [];
	for (const [due_date, list] of byDate) {
		list.sort((a, b) => {
			// Open before done within a day; then title.
			if (a.status === 'done' !== (b.status === 'done')) {
				return a.status === 'done' ? 1 : -1;
			}
			return a.title.localeCompare(b.title);
		});
		const hasOverdue = list.some((a) => a.days_until != null && a.days_until < 0);
		groups.push({ due_date, hasOverdue, assignments: list });
	}

	groups.sort((a, b) => {
		// Overdue date buckets first, then by date ascending.
		if (a.hasOverdue !== b.hasOverdue) return a.hasOverdue ? -1 : 1;
		return a.due_date.localeCompare(b.due_date);
	});

	return groups;
}

/** Group by course (course sort_order/name via first assignment labels), assignments by due_date. */
export function groupAssignmentsByCourse(
	assignments: AssignmentListRow[],
	courses: CourseRow[]
): CourseGroup[] {
	const courseOrder = new Map(courses.map((c, i) => [c.id, i]));
	const byCourse = new Map<string, AssignmentListRow[]>();
	for (const a of assignments) {
		const list = byCourse.get(a.course_id);
		if (list) list.push(a);
		else byCourse.set(a.course_id, [a]);
	}

	const groups: CourseGroup[] = [];
	for (const [course_id, list] of byCourse) {
		list.sort(
			(a, b) => a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title)
		);
		const sample = list[0]!;
		groups.push({
			course_id,
			course_name: sample.course_name,
			course_code: sample.course_code,
			assignments: list
		});
	}

	groups.sort((a, b) => {
		const ai = courseOrder.get(a.course_id) ?? 999;
		const bi = courseOrder.get(b.course_id) ?? 999;
		if (ai !== bi) return ai - bi;
		return a.course_name.localeCompare(b.course_name);
	});

	return groups;
}

export { parentPickerOptions } from '$lib/classwork/parent-picker';
