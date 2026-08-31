/** Pure Canvas → classwork mapping. No fetch. Used by the CLI import. */

import { ymdInChicago } from '../invoicing/chicago-date';
import type { AssignmentKind } from '../types/classwork';

export type CanvasTerm = { id?: number; name?: string | null } | null;

export type CanvasCourseInput = {
	id: number;
	name: string;
	course_code?: string | null;
	term?: CanvasTerm;
	teachers?: Array<{ display_name?: string | null; name?: string | null }>;
};

export type CanvasAssignmentInput = {
	id: number;
	name: string;
	due_at?: string | null;
	published?: boolean;
	points_possible?: number | null;
	is_quiz_assignment?: boolean | null;
};

export type CanvasSkipReason =
	| 'unpublished'
	| 'no_due_at'
	| 'term'
	| 'default_term'
	| 'stale_due'
	| 'attendance'
	| 'zero_point'
	| 'makeup';

export type CanvasImportOptions = {
	/** Canvas term name, e.g. `FA-26`. Null = every non-default term. */
	termCode?: string | null;
	/** Inclusive lower bound on Chicago due_date. Null = no stale filter. */
	minDueYmd?: string | null;
	includeZeroPoint?: boolean;
	includeAttendance?: boolean;
	includeMakeup?: boolean;
};

const TERM_SEASON: Record<string, string> = {
	FA: 'Fall',
	SP: 'Spring',
	SU: 'Summer',
	SM: 'Summer',
	WI: 'Winter'
};

const LEADING_CODE_RE =
	/^[A-Z]{2,5}\s*\d{2,4}(?:\.[A-Za-z0-9]+)?\s*-\s*[A-Za-z0-9]+:\s*/i;

function collapseWs(s: string): string {
	return s.replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `FA-26` → `Fall 2026`. `Default Term` → null. */
export function formatCanvasTerm(termName: string | null | undefined): string | null {
	if (!termName) return null;
	const raw = collapseWs(termName);
	if (!raw || /^default term$/i.test(raw)) return null;
	const m = /^(FA|SP|SU|SM|WI)-(\d{2})$/i.exec(raw);
	if (!m) return raw;
	const season = TERM_SEASON[m[1]!.toUpperCase()];
	if (!season) return raw;
	return `${season} 20${m[2]}`;
}

/** FA-26 → 2026-08-01; SP-27 → 2027-01-01. */
export function defaultMinDueYmd(termCode: string | null | undefined): string | null {
	if (!termCode) return null;
	const m = /^(FA|SP|SU|SM|WI)-(\d{2})$/i.exec(termCode.trim());
	if (!m) return null;
	const yy = 2000 + Number(m[2]);
	const season = m[1]!.toUpperCase();
	if (season === 'FA') return `${yy}-08-01`;
	if (season === 'SP' || season === 'WI') return `${yy}-01-01`;
	return `${yy}-05-01`;
}

export function parseCanvasCourseName(
	raw: string,
	courseCode?: string | null,
	termLabel?: string | null
): string {
	let s = collapseWs(raw);
	if (courseCode) {
		const code = collapseWs(courseCode);
		if (code && s.toLowerCase().startsWith(code.toLowerCase())) {
			s = s.slice(code.length).replace(/^\s*-\s*/, '').trim();
		}
	}
	s = s.replace(LEADING_CODE_RE, '').trim();
	const labels = [
		termLabel,
		formatCanvasTerm(termLabel),
		'Fall 2026',
		'Spring 2026',
		'Summer 2026'
	].filter((x): x is string => Boolean(x));
	for (const lab of labels) {
		s = s.replace(new RegExp(`\\s*${escapeRe(lab)}$`, 'i'), '').trim();
		s = s.replace(new RegExp(`([a-z])${escapeRe(lab)}$`, 'i'), '$1').trim();
	}
	s = s.replace(/^[A-Z0-9]{1,4}:\s*/i, '').trim();
	return s.length > 0 ? s : collapseWs(raw);
}

export function canvasInstructors(
	teachers: CanvasCourseInput['teachers'] | undefined
): string | null {
	if (!teachers?.length) return null;
	const names: string[] = [];
	const seen = new Set<string>();
	for (const t of teachers) {
		const n = collapseWs(t.display_name || t.name || '');
		if (!n) continue;
		const key = n.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		names.push(n);
	}
	return names.length ? names.join(', ') : null;
}

export function dueAtToChicagoYmd(dueAt: string): string {
	return ymdInChicago(new Date(dueAt));
}

export function guessAssignmentKind(a: CanvasAssignmentInput): AssignmentKind {
	const n = a.name.toLowerCase();
	if (a.is_quiz_assignment || /\bquiz\b/.test(n) || /\bcheck\b/.test(n)) return 'quiz';
	if (/\bexam\b/.test(n) || /\bmidterm\b/.test(n)) return 'exam';
	if (
		/\bpaper\b/.test(n) ||
		/\breflection\b/.test(n) ||
		/\bessay\b/.test(n) ||
		/\bcase study\b/.test(n) ||
		/\bpraxis report\b/.test(n)
	) {
		return 'paper';
	}
	if (/\breading (log|report)\b/.test(n)) return 'reading';
	if (/\bpresentation\b/.test(n) || (/\bsermon\b/.test(n) && !/\breview\b/.test(n))) {
		return 'presentation';
	}
	return 'other';
}

export function skipCourse(
	course: CanvasCourseInput,
	opts: CanvasImportOptions
): Extract<CanvasSkipReason, 'term' | 'default_term'> | null {
	const termName = course.term?.name?.trim() ?? '';
	if (!termName || /^default term$/i.test(termName)) return 'default_term';
	if (opts.termCode && termName.toUpperCase() !== opts.termCode.toUpperCase()) return 'term';
	return null;
}

export function skipAssignment(
	a: CanvasAssignmentInput,
	dueYmd: string | null,
	opts: CanvasImportOptions
): CanvasSkipReason | null {
	if (a.published === false) return 'unpublished';
	if (!a.due_at || !dueYmd) return 'no_due_at';
	if (opts.minDueYmd && dueYmd < opts.minDueYmd) return 'stale_due';
	const n = a.name.toLowerCase();
	if (!opts.includeMakeup && /\blate (article|book) reading\b/.test(n)) return 'makeup';
	if (!opts.includeAttendance && (/\battendance\b/.test(n) || /\bparticipation\b/.test(n))) {
		return 'attendance';
	}
	const pts = a.points_possible;
	if (!opts.includeZeroPoint && (pts === 0 || pts === null || pts === undefined)) {
		return 'zero_point';
	}
	return null;
}

export function normalizeProjectKey(s: string): string {
	return collapseWs(s)
		.toLowerCase()
		.replace(/&/g, 'and')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

export function matchEducationProject(
	courseName: string,
	projects: Array<{ id: string; name: string }>
): string | null {
	const key = normalizeProjectKey(courseName);
	if (!key) return null;
	for (const p of projects) {
		if (normalizeProjectKey(p.name) === key) return p.id;
	}
	return null;
}
