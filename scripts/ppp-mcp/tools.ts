/**
 * Read-only tool handlers for ppp MCP v1 — wrap existing server loaders.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { ymdInChicago } from '../../src/lib/invoicing/chicago-date.ts';
import {
	loadAssignments,
	loadCourses,
	loadDueSoonAssignments
} from '../../src/lib/classwork/server/loaders.ts';
import {
	loadContactsDue,
	searchContacts
} from '../../src/lib/contacts/server/loaders.ts';
import {
	loadBookCitationInputs,
	loadBookListFiltered,
	loadPeople
} from '../../src/lib/library/server/loaders.ts';
import { formatBibliography, formatFootnote } from '../../src/lib/library/turabian/format.ts';
import {
	collectDescendantIds,
	loadLatestHealth,
	loadProjectRows
} from '../../src/lib/projects/server/loaders.ts';
import {
	loadDashboardNowTasks,
	loadWeekTasks
} from '../../src/lib/projects/server/task-loaders.ts';
import { loadByBookStats, loadSermons, loadUpcomingSermons } from '../../src/lib/sermons/server/loaders.ts';
import { bibleBookSuggestions, resolveBibleBookName } from '../../src/lib/mcp/bible-book.ts';
import { courseSuggestions, resolveCourse } from '../../src/lib/mcp/course.ts';
import {
	healthChangedThisWeek,
	projectSuggestions,
	resolveProject
} from '../../src/lib/mcp/project.ts';
import { TASK_PRIORITY_LABELS } from '../../src/lib/types/projects.ts';
import type { Database } from '../../src/lib/types/database.ts';

type Sb = SupabaseClient<Database>;

function jsonText(data: unknown): { content: { type: 'text'; text: string }[] } {
	return {
		content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
	};
}

async function loadOwnerCadenceDefault(supabase: Sb): Promise<number | null> {
	const ownerId = process.env.POS_OWNER_ID?.trim();
	if (!ownerId) return null;
	const { data, error } = await supabase
		.from('profiles')
		.select('contact_cadence_days_default')
		.eq('id', ownerId)
		.maybeSingle();
	if (error) {
		console.error('[ppp-mcp] profile cadence', error);
		return null;
	}
	return data?.contact_cadence_days_default ?? null;
}

export async function listNowTasks(supabase: Sb) {
	const result = await loadDashboardNowTasks(supabase);
	return jsonText({
		todayYmd: result.todayYmd,
		criticalNowCount: result.criticalNowCount,
		opportunityNowCount: result.opportunityNowCount,
		zones: result.zones.map((z) => ({
			priority: z.priority,
			label: z.label,
			count: z.count,
			tasks: z.tasks.map((t) => ({
				id: t.id,
				title: t.title,
				project_id: t.project_id,
				project_name: t.project_name,
				priority: t.priority,
				start_date: t.start_date,
				notes: t.notes
			}))
		}))
	});
}

/**
 * Coming-week task horizon (all MYN zones). Distinct from list_now_tasks
 * (Critical + Opportunity Now only).
 */
export async function listWeekTasks(supabase: Sb, args: { days?: number } = {}) {
	const result = await loadWeekTasks(supabase, { days: args.days });
	return jsonText({
		todayYmd: result.todayYmd,
		windowDays: result.windowDays,
		windowEndYmd: result.windowEndYmd,
		count: result.count,
		by_project: result.by_project,
		tasks: result.tasks.map((t) => ({
			id: t.id,
			title: t.title,
			project_id: t.project_id,
			project_name: t.project_name,
			priority: t.priority,
			priority_label: TASK_PRIORITY_LABELS[t.priority],
			start_date: t.start_date,
			notes: t.notes
		}))
	});
}

export async function listDueSoon(
	supabase: Sb,
	args: { horizon_days?: number } = {}
) {
	const todayYmd = ymdInChicago();
	const horizonDays = args.horizon_days ?? 14;
	const { assignments, horizonEnd, error } = await loadDueSoonAssignments(supabase, {
		todayYmd,
		horizonDays
	});
	return jsonText({
		todayYmd,
		horizon_days: horizonDays,
		horizon_end: horizonEnd,
		error,
		count: assignments.length,
		assignments: assignments.map((a) => ({
			id: a.id,
			title: a.title,
			kind: a.kind,
			status: a.status,
			due_date: a.due_date,
			days_until: a.days_until,
			course_id: a.course_id,
			course_name: a.course_name,
			course_code: a.course_code,
			parent_id: a.parent_id
		}))
	});
}

export async function getAssignmentsForCourse(
	supabase: Sb,
	args: { course: string }
) {
	const query = args.course?.trim() ?? '';
	if (!query) {
		return jsonText({ error: 'course is required (name or code)' });
	}

	const { courses, error: coursesError } = await loadCourses(supabase);
	if (coursesError) {
		return jsonText({ error: coursesError });
	}

	const resolveInputs = courses.map((c) => ({
		id: c.id,
		name: c.name,
		code: c.code
	}));
	const resolved = resolveCourse(query, resolveInputs);
	if (!resolved) {
		return jsonText({
			error: `Unknown or ambiguous course: ${query}`,
			suggestions: courseSuggestions(query, resolveInputs)
		});
	}

	const course = courses.find((c) => c.id === resolved.id);
	if (!course) {
		return jsonText({ error: `Course not found: ${resolved.id}` });
	}

	const todayYmd = ymdInChicago();
	const { assignments, error } = await loadAssignments(supabase, {
		todayYmd,
		courseId: course.id
	});
	if (error) {
		return jsonText({ error, course: { id: course.id, name: course.name } });
	}

	const byId = new Map(assignments.map((a) => [a.id, a]));
	return jsonText({
		todayYmd,
		course: {
			id: course.id,
			name: course.name,
			code: course.code,
			instructor: course.instructor,
			term: course.term,
			status: course.status,
			project_id: course.project_id,
			assignment_count: course.assignmentCount
		},
		count: assignments.length,
		assignments: assignments.map((a) => {
			const parent = a.parent_id ? byId.get(a.parent_id) : null;
			return {
				id: a.id,
				title: a.title,
				kind: a.kind,
				status: a.status,
				due_date: a.due_date,
				days_until: a.days_until,
				completed_at: a.completed_at,
				parent_id: a.parent_id,
				parent_title: parent?.title ?? null,
				notes: a.notes
			};
		})
	});
}

export async function listContactsDue(
	supabase: Sb,
	args: { limit?: number } = {}
) {
	const todayYmd = ymdInChicago();
	const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
	const profileCadenceDefault = await loadOwnerCadenceDefault(supabase);
	const { contacts, error } = await loadContactsDue(supabase, {
		todayYmd,
		profileCadenceDefault,
		limit
	});
	return jsonText({
		todayYmd,
		limit,
		error,
		count: contacts.length,
		contacts: contacts.map((c) => ({
			id: c.id,
			display_name: c.display_name,
			effective_cadence_days: c.effective_cadence_days,
			last_touched_on: c.last_touched_on,
			days_overdue: c.days_overdue,
			household_name: c.household_name
		}))
	});
}

export async function searchContactsTool(
	supabase: Sb,
	args: { q: string; limit?: number }
) {
	const q = args.q?.trim() ?? '';
	if (!q) {
		return jsonText({ error: 'q is required', contacts: [], count: 0 });
	}
	const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
	const profileCadenceDefault = await loadOwnerCadenceDefault(supabase);
	const { contacts, error } = await searchContacts(supabase, {
		q,
		profileCadenceDefault,
		limit
	});
	return jsonText({
		q,
		limit,
		error,
		count: contacts.length,
		contacts: contacts.map((c) => ({
			id: c.id,
			display_name: c.display_name,
			email: c.email,
			phone: c.phone,
			household_name: c.household_name,
			address_summary: c.address_summary,
			effective_cadence_days: c.effective_cadence_days,
			last_touched_on: c.last_touched_on,
			status: c.status,
			no_reminders: c.no_reminders
		}))
	});
}

export async function searchLibrary(
	supabase: Sb,
	args: { q: string; limit?: number; include_unowned?: boolean }
) {
	const q = args.q.trim();
	if (!q) {
		return jsonText({ error: 'q is required', books: [], filteredCount: 0 });
	}
	const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
	const { books, filteredCount } = await loadBookListFiltered(
		supabase,
		[],
		{
			q,
			includeUnowned: args.include_unowned === true
		},
		{ limit, offset: 0 }
	);
	return jsonText({
		q,
		filteredCount,
		books: books.map((b) => ({
			id: b.id,
			title: b.title,
			authors_label: b.authors_label,
			genre: b.genre,
			series_name: b.series_name,
			publisher: b.publisher_canonical,
			needs_review: b.needs_review
		}))
	});
}

export async function getBookCitation(
	supabase: Sb,
	args: { book_id: string; page?: string }
) {
	const bookId = args.book_id.trim();
	if (!bookId) {
		return jsonText({ error: 'book_id is required' });
	}
	const people = await loadPeople(supabase);
	const [input] = await loadBookCitationInputs(supabase, [bookId], people);
	if (!input) {
		return jsonText({ error: `Book not found: ${bookId}` });
	}
	const page = args.page?.trim() || undefined;
	const footnote = formatFootnote(input, page ? { page } : undefined);
	const bibliography = formatBibliography(input);
	return jsonText({
		book_id: bookId,
		title: input.title,
		footnote: { plain: footnote.plain, sourceType: footnote.sourceType },
		bibliography: { plain: bibliography.plain, sourceType: bibliography.sourceType }
	});
}

export async function listUpcomingSermonsTool(
	supabase: Sb,
	args: { limit?: number } = {}
) {
	const todayYmd = ymdInChicago();
	const limit = Math.min(Math.max(args.limit ?? 5, 1), 20);
	const { sermons, error } = await loadUpcomingSermons(supabase, { todayYmd, limit });
	return jsonText({ todayYmd, error, sermons });
}

export async function listProjectHealth(
	supabase: Sb,
	args: { root?: string; changed_only?: boolean } = {}
) {
	const [projects, healthMap] = await Promise.all([
		loadProjectRows(supabase),
		loadLatestHealth(supabase)
	]);

	let allowIds: Set<string> | null = null;
	if (args.root != null && args.root.trim() !== '') {
		const resolved = resolveProject(args.root, projects);
		if (!resolved) {
			return jsonText({
				error: `Unknown root project: ${args.root}`,
				suggestions: projectSuggestions(args.root, projects)
			});
		}
		allowIds = new Set([resolved.id, ...collectDescendantIds(projects, resolved.id)]);
	}

	let rows = projects
		.filter((p) => p.lifecycle_status !== 'done' && p.lifecycle_status !== 'archived')
		.filter((p) => (allowIds ? allowIds.has(p.id) : true))
		.map((p) => {
			const h = healthMap.get(p.id);
			return {
				id: p.id,
				name: p.name,
				parent_id: p.parent_id,
				lifecycle_status: p.lifecycle_status,
				health_status: h?.health_status ?? null,
				health_week_of: h?.week_of ?? null,
				previous_health: h?.previous ?? null
			};
		});

	if (args.changed_only) {
		rows = rows.filter((r) => healthChangedThisWeek(r.health_status, r.previous_health));
	}

	return jsonText({ count: rows.length, projects: rows });
}

export async function listCommentariesForBibleBook(
	supabase: Sb,
	args: { bible_book: string }
) {
	const resolved = resolveBibleBookName(args.bible_book);
	if (!resolved) {
		return jsonText({
			error: `Unknown bible_book: ${args.bible_book}`,
			suggestions: bibleBookSuggestions(args.bible_book)
		});
	}
	const { rows, error } = await loadByBookStats(supabase, {
		sort: 'canon',
		sortDir: 'asc',
		testament: null,
		hasSermons: false,
		hasFourStar: false
	});
	if (error) return jsonText({ error, bible_book: resolved });
	const row = rows.find((r) => r.bibleBook === resolved);
	if (!row) {
		return jsonText({ bible_book: resolved, commentaries: [], also_on_shelf: [] });
	}
	return jsonText({
		bible_book: resolved,
		commentary_count: row.commentaryCount,
		four_star_count: row.fourStarCount,
		commentaries: row.commentaries.map((c) => ({
			kind: c.kind,
			book_id: c.bookId,
			essay_id: c.essayId,
			title: c.title,
			author: c.authorShort,
			series: c.seriesLabel,
			rating: c.rating,
			genre: c.genre
		})),
		also_on_shelf: row.alsoOnShelf.map((c) => ({
			kind: c.kind,
			book_id: c.bookId,
			essay_id: c.essayId,
			title: c.title,
			author: c.authorShort,
			series: c.seriesLabel,
			rating: c.rating,
			genre: c.genre
		}))
	});
}

export async function listSermonsForBibleBook(
	supabase: Sb,
	args: { bible_book: string }
) {
	const resolved = resolveBibleBookName(args.bible_book);
	if (!resolved) {
		return jsonText({
			error: `Unknown bible_book: ${args.bible_book}`,
			suggestions: bibleBookSuggestions(args.bible_book)
		});
	}
	const { sermons, error } = await loadSermons(supabase, {
		year: null,
		context: null,
		venueId: null,
		bibleBook: resolved
	});
	return jsonText({
		bible_book: resolved,
		error,
		count: sermons.length,
		sermons: sermons.map((s) => ({
			id: s.id,
			preached_on: s.preached_on,
			venue_name: s.venue_name,
			context_type: s.context_type,
			topic: s.topic,
			passage_display: s.passage_display,
			passages: s.passages.map((p) => ({
				bible_book: p.bible_book,
				chapter_start: p.chapter_start,
				verse_start: p.verse_start,
				chapter_end: p.chapter_end,
				verse_end: p.verse_end
			}))
		}))
	});
}

export const TOOL_NAMES = [
	'list_now_tasks',
	'list_week_tasks',
	'list_due_soon',
	'get_assignments_for_course',
	'list_contacts_due',
	'search_contacts',
	'search_library',
	'get_book_citation',
	'list_upcoming_sermons',
	'list_project_health',
	'list_commentaries_for_bible_book',
	'list_sermons_for_bible_book'
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];
