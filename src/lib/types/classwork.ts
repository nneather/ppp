/** Closed enums and view-models for the classwork module. */

export const COURSE_STATUSES = ['active', 'completed'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
	active: 'Active',
	completed: 'Completed'
};

export const ASSIGNMENT_KINDS = [
	'paper',
	'exam',
	'reading',
	'quiz',
	'presentation',
	'other'
] as const;
export type AssignmentKind = (typeof ASSIGNMENT_KINDS)[number];

export const ASSIGNMENT_KIND_LABELS: Record<AssignmentKind, string> = {
	paper: 'Paper',
	exam: 'Exam',
	reading: 'Reading',
	quiz: 'Quiz',
	presentation: 'Presentation',
	other: 'Other'
};

export const ASSIGNMENT_STATUSES = ['not_started', 'in_progress', 'done'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
	not_started: 'Not started',
	in_progress: 'In progress',
	done: 'Done'
};

export const CLASSWORK_GROUPS = ['date', 'course'] as const;
export type ClassworkGroup = (typeof CLASSWORK_GROUPS)[number];

export const PAPER_STATUSES = ['draft', 'in_progress', 'submitted'] as const;
export type PaperStatus = (typeof PAPER_STATUSES)[number];

export const PAPER_STATUS_LABELS: Record<PaperStatus, string> = {
	draft: 'Draft',
	in_progress: 'In progress',
	submitted: 'Submitted'
};

/**
 * Research paper (opt-in research surface; [188]). When `assignment_id` is
 * set, `course_id` / `due_date` are stamped from the assignment and locked
 * (P1 stamp + lock — server re-stamps on every save while linked).
 */
export type PaperRow = {
	id: string;
	title: string;
	status: PaperStatus;
	course_id: string | null;
	course_name: string | null;
	course_code: string | null;
	assignment_id: string | null;
	assignment_title: string | null;
	assignment_due_date: string | null;
	due_date: string | null;
	topic: string | null;
	passage_display: string | null;
	notes: string | null;
	sort_order: number;
};

export type PaperListRow = PaperRow & {
	/** Live source count (not soft-deleted). */
	sourceCount: number;
};

export type CourseRow = {
	id: string;
	name: string;
	code: string | null;
	instructor: string | null;
	term: string | null;
	status: CourseStatus;
	project_id: string | null;
	notes: string | null;
	sort_order: number;
	/** Live assignment count (not soft-deleted). */
	assignmentCount: number;
};

export type AssignmentListRow = {
	id: string;
	course_id: string;
	course_name: string;
	course_code: string | null;
	parent_id: string | null;
	title: string;
	kind: AssignmentKind;
	status: AssignmentStatus;
	due_date: string;
	completed_at: string | null;
	notes: string | null;
	sort_order: number;
	/** Negative = overdue (Chicago civil vs today). Null when done. */
	days_until: number | null;
};

/** Open assignment due on/before today+horizon (overdue included). days_until always set. */
export type DueSoonAssignment = AssignmentListRow & {
	days_until: number;
};

export type ClassworkListFilters = {
	group: ClassworkGroup;
	courseId: string | null;
};

/** Project option for course.project_id picker (Education subtree first). */
export type ClassworkProjectOption = {
	id: string;
	name: string;
	depth: number;
	/** True when under the Education domain root (incl. root itself). */
	suggested: boolean;
};
