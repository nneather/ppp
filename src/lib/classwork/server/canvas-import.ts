/**
 * Plan + apply a Canvas → classwork one-shot import.
 * CLI only (CANVAS_HOST / CANVAS_TOKEN). Not a live sync.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { canvasGet, canvasGetPages } from '../canvas-client';
import {
	canvasInstructors,
	defaultMinDueYmd,
	dueAtToChicagoYmd,
	formatCanvasTerm,
	guessAssignmentKind,
	matchEducationProject,
	parseCanvasCourseName,
	skipAssignment,
	skipCourse,
	type CanvasAssignmentInput,
	type CanvasCourseInput,
	type CanvasImportOptions,
	type CanvasSkipReason
} from '../canvas-map';
import type { AssignmentKind } from '../../types/classwork';

export type CanvasUserSelf = {
	id: number;
	name?: string | null;
};

export type PlannedCourse = {
	action: 'insert' | 'update' | 'keep';
	canvasCourseId: number;
	name: string;
	code: string | null;
	instructor: string | null;
	term: string | null;
	projectId: string | null;
	existingId: string | null;
};

export type PlannedAssignment = {
	action: 'insert' | 'update' | 'keep';
	canvasAssignmentId: number;
	canvasCourseId: number;
	title: string;
	kind: AssignmentKind;
	dueDate: string;
	existingId: string | null;
};

export type SkippedRow = {
	canvasCourseId: number;
	courseName: string;
	canvasAssignmentId?: number;
	title: string;
	reason: CanvasSkipReason;
	dueDate: string | null;
};

export type CanvasImportPreview = {
	self: { id: number; name: string | null };
	options: Required<Pick<CanvasImportOptions, 'includeZeroPoint' | 'includeAttendance' | 'includeMakeup'>> & {
		termCode: string | null;
		minDueYmd: string | null;
	};
	courses: PlannedCourse[];
	assignments: PlannedAssignment[];
	skipped: SkippedRow[];
};

type CourseRow = {
	id: string;
	name: string;
	code: string | null;
	instructor: string | null;
	term: string | null;
	project_id: string | null;
	canvas_course_id: number | null;
};

type AssignmentRow = {
	id: string;
	course_id: string;
	title: string;
	kind: string;
	due_date: string;
	canvas_assignment_id: number | null;
};

type ProjectRow = { id: string; name: string; parent_id: string | null };

export function resolveCanvasImportOptions(opts: CanvasImportOptions): {
	termCode: string | null;
	minDueYmd: string | null;
	includeZeroPoint: boolean;
	includeAttendance: boolean;
	includeMakeup: boolean;
} {
	const termCode = opts.termCode ?? null;
	const minDueYmd =
		opts.minDueYmd !== undefined ? opts.minDueYmd : defaultMinDueYmd(termCode);
	return {
		termCode,
		minDueYmd,
		includeZeroPoint: opts.includeZeroPoint === true,
		includeAttendance: opts.includeAttendance === true,
		includeMakeup: opts.includeMakeup === true
	};
}

export async function fetchCanvasCatalog(
	host: string,
	token: string
): Promise<{
	self: CanvasUserSelf;
	courses: CanvasCourseInput[];
	assignmentsByCourseId: Map<number, CanvasAssignmentInput[]>;
}> {
	const self = await canvasGet<CanvasUserSelf>(host, token, '/api/v1/users/self');
	const courses = await canvasGetPages<CanvasCourseInput>(host, token, '/api/v1/courses', {
		enrollment_state: 'active',
		per_page: 100,
		'include[]': ['term', 'teachers']
	});
	const assignmentsByCourseId = new Map<number, CanvasAssignmentInput[]>();
	for (const course of courses) {
		const asgs = await canvasGetPages<CanvasAssignmentInput>(
			host,
			token,
			`/api/v1/courses/${course.id}/assignments`,
			{ per_page: 100, order_by: 'due_at' }
		);
		assignmentsByCourseId.set(course.id, asgs);
	}
	return { self, courses, assignmentsByCourseId };
}

export function planCanvasImport(
	catalog: {
		self: CanvasUserSelf;
		courses: CanvasCourseInput[];
		assignmentsByCourseId: Map<number, CanvasAssignmentInput[]>;
	},
	existing: {
		courses: CourseRow[];
		assignments: AssignmentRow[];
		projects: ProjectRow[];
	},
	opts: CanvasImportOptions
): CanvasImportPreview {
	const resolved = resolveCanvasImportOptions(opts);
	const education = existing.projects.find(
		(p) => p.parent_id == null && p.name.trim().toLowerCase() === 'education'
	);
	const educationChildren = education
		? existing.projects.filter((p) => p.parent_id === education.id)
		: [];

	const courseByCanvasId = new Map<number, CourseRow>();
	for (const c of existing.courses) {
		if (c.canvas_course_id != null) courseByCanvasId.set(c.canvas_course_id, c);
	}
	const assignmentByCanvasId = new Map<number, AssignmentRow>();
	for (const a of existing.assignments) {
		if (a.canvas_assignment_id != null) assignmentByCanvasId.set(a.canvas_assignment_id, a);
	}

	const plannedCourses: PlannedCourse[] = [];
	const plannedAssignments: PlannedAssignment[] = [];
	const skipped: SkippedRow[] = [];

	for (const course of catalog.courses) {
		const courseSkip = skipCourse(course, resolved);
		const termLabel = formatCanvasTerm(course.term?.name);
		const name = parseCanvasCourseName(course.name, course.course_code, course.term?.name);
		if (courseSkip) {
			skipped.push({
				canvasCourseId: course.id,
				courseName: name,
				title: name,
				reason: courseSkip,
				dueDate: null
			});
			continue;
		}

		const existingCourse = courseByCanvasId.get(course.id) ?? null;
		const projectId =
			existingCourse?.project_id ?? matchEducationProject(name, educationChildren);
		const next: PlannedCourse = {
			action: existingCourse ? 'keep' : 'insert',
			canvasCourseId: course.id,
			name,
			code: course.course_code?.trim() || null,
			instructor: canvasInstructors(course.teachers),
			term: termLabel,
			projectId,
			existingId: existingCourse?.id ?? null
		};
		if (existingCourse) {
			const changed =
				existingCourse.name !== next.name ||
				existingCourse.code !== next.code ||
				existingCourse.instructor !== next.instructor ||
				existingCourse.term !== next.term ||
				(existingCourse.project_id == null && next.projectId != null);
			next.action = changed ? 'update' : 'keep';
		}
		plannedCourses.push(next);

		for (const asg of catalog.assignmentsByCourseId.get(course.id) ?? []) {
			const dueDate = asg.due_at ? dueAtToChicagoYmd(asg.due_at) : null;
			const reason = skipAssignment(asg, dueDate, resolved);
			if (reason) {
				skipped.push({
					canvasCourseId: course.id,
					courseName: name,
					canvasAssignmentId: asg.id,
					title: asg.name,
					reason,
					dueDate
				});
				continue;
			}
			const existingAsg = assignmentByCanvasId.get(asg.id) ?? null;
			const kind = guessAssignmentKind(asg);
			const row: PlannedAssignment = {
				action: existingAsg ? 'keep' : 'insert',
				canvasAssignmentId: asg.id,
				canvasCourseId: course.id,
				title: asg.name,
				kind,
				dueDate: dueDate!,
				existingId: existingAsg?.id ?? null
			};
			if (existingAsg) {
				const changed = existingAsg.title !== row.title || existingAsg.due_date !== row.dueDate;
				row.action = changed ? 'update' : 'keep';
			}
			plannedAssignments.push(row);
		}
	}

	return {
		self: { id: catalog.self.id, name: catalog.self.name ?? null },
		options: resolved,
		courses: plannedCourses,
		assignments: plannedAssignments,
		skipped
	};
}

export async function loadCanvasImportState(supabase: SupabaseClient): Promise<{
	courses: CourseRow[];
	assignments: AssignmentRow[];
	projects: ProjectRow[];
}> {
	const [coursesRes, assignmentsRes, projectsRes] = await Promise.all([
		supabase
			.from('courses')
			.select('id, name, code, instructor, term, project_id, canvas_course_id')
			.is('deleted_at', null),
		supabase
			.from('assignments')
			.select('id, course_id, title, kind, due_date, canvas_assignment_id')
			.is('deleted_at', null),
		supabase.from('projects').select('id, name, parent_id').is('deleted_at', null)
	]);
	if (coursesRes.error) throw new Error(coursesRes.error.message);
	if (assignmentsRes.error) throw new Error(assignmentsRes.error.message);
	if (projectsRes.error) throw new Error(projectsRes.error.message);
	return {
		courses: (coursesRes.data ?? []) as CourseRow[],
		assignments: (assignmentsRes.data ?? []) as AssignmentRow[],
		projects: (projectsRes.data ?? []) as ProjectRow[]
	};
}

export type CanvasImportApplyResult = {
	coursesInserted: number;
	coursesUpdated: number;
	assignmentsInserted: number;
	assignmentsUpdated: number;
};

export async function applyCanvasImport(
	supabase: SupabaseClient,
	ownerId: string,
	preview: CanvasImportPreview
): Promise<CanvasImportApplyResult> {
	const courseIdByCanvas = new Map<number, string>();
	let coursesInserted = 0;
	let coursesUpdated = 0;
	let assignmentsInserted = 0;
	let assignmentsUpdated = 0;

	for (const course of preview.courses) {
		if (course.action === 'insert') {
			const { data, error } = await supabase
				.from('courses')
				.insert({
					name: course.name,
					code: course.code,
					instructor: course.instructor,
					term: course.term,
					status: 'active',
					project_id: course.projectId,
					canvas_course_id: course.canvasCourseId,
					created_by: ownerId
				} as never)
				.select('id')
				.single();
			if (error || !data) throw new Error(error?.message ?? 'Course insert failed');
			courseIdByCanvas.set(course.canvasCourseId, (data as { id: string }).id);
			coursesInserted += 1;
			continue;
		}
		if (course.existingId) courseIdByCanvas.set(course.canvasCourseId, course.existingId);
		if (course.action === 'update' && course.existingId) {
			const patch: Record<string, unknown> = {
				name: course.name,
				code: course.code,
				instructor: course.instructor,
				term: course.term
			};
			if (course.projectId) patch.project_id = course.projectId;
			const { error } = await supabase
				.from('courses')
				.update(patch as never)
				.eq('id', course.existingId)
				.is('deleted_at', null);
			if (error) throw new Error(error.message);
			coursesUpdated += 1;
		}
	}

	for (const asg of preview.assignments) {
		const courseId = courseIdByCanvas.get(asg.canvasCourseId);
		if (!courseId) throw new Error(`Missing course for Canvas assignment ${asg.canvasAssignmentId}`);
		if (asg.action === 'insert') {
			const { error } = await supabase.from('assignments').insert({
				course_id: courseId,
				title: asg.title,
				kind: asg.kind,
				status: 'not_started',
				due_date: asg.dueDate,
				canvas_assignment_id: asg.canvasAssignmentId,
				created_by: ownerId
			} as never);
			if (error) throw new Error(error.message);
			assignmentsInserted += 1;
			continue;
		}
		if (asg.action === 'update' && asg.existingId) {
			const { error } = await supabase
				.from('assignments')
				.update({ title: asg.title, due_date: asg.dueDate } as never)
				.eq('id', asg.existingId)
				.is('deleted_at', null);
			if (error) throw new Error(error.message);
			assignmentsUpdated += 1;
		}
	}

	return { coursesInserted, coursesUpdated, assignmentsInserted, assignmentsUpdated };
}

export function formatCanvasImportPreview(preview: CanvasImportPreview): string {
	const lines: string[] = [];
	lines.push(
		`Canvas self: ${preview.self.name ?? '(unnamed)'} (${preview.self.id})  term=${preview.options.termCode ?? '*'}  minDue=${preview.options.minDueYmd ?? '*'}`
	);
	lines.push('');
	for (const c of preview.courses) {
		const asgs = preview.assignments.filter((a) => a.canvasCourseId === c.canvasCourseId);
		const linked = c.projectId ? '  project=linked' : '';
		lines.push(
			`${c.action.toUpperCase()}  ${c.code ?? '—'}  ${c.name}  (${c.instructor ?? 'no instructor'})${linked}  [${asgs.length} assignments]`
		);
		for (const a of asgs.sort((x, y) => x.dueDate.localeCompare(y.dueDate) || x.title.localeCompare(y.title))) {
			lines.push(`    ${a.action.padEnd(6)} ${a.dueDate}  ${a.kind.padEnd(13)} ${a.title}`);
		}
	}
	if (preview.skipped.length) {
		lines.push('');
		lines.push(`Skipped (${preview.skipped.length}):`);
		for (const s of preview.skipped) {
			const due = s.dueDate ? `  ${s.dueDate}` : '';
			lines.push(`    [${s.reason}] ${s.courseName}${due}  ${s.title}`);
		}
	}
	const insC = preview.courses.filter((c) => c.action === 'insert').length;
	const updC = preview.courses.filter((c) => c.action === 'update').length;
	const insA = preview.assignments.filter((a) => a.action === 'insert').length;
	const updA = preview.assignments.filter((a) => a.action === 'update').length;
	lines.push('');
	lines.push(
		`Plan: courses +${insC}/~${updC}  assignments +${insA}/~${updA}  skipped ${preview.skipped.length}`
	);
	return lines.join('\n');
}
