import type { SupabaseClient } from '@supabase/supabase-js';
import { loadBooksByIds } from '$lib/library/server/loaders';
import { bookDetailToCitationInput } from '$lib/library/turabian';
import type { BookAuthorAssignment, BookDetail, PersonRow } from '$lib/types/library';
import {
	PAPER_STATUSES,
	type PaperListRow,
	type PaperRow,
	type PaperStatus
} from '$lib/types/classwork';
import type { PaperGroupView, PaperSourceView, OrphanPaperSource } from '$lib/studies/paper-sources';
import { parseStudyUsage } from '$lib/studies/source-usage';
import type { StudyParent } from '$lib/studies/study-parent';

const PAPER_COLUMNS =
	'id, title, status, course_id, assignment_id, due_date, topic, passage_display, topical, notes, sort_order, created_at';

type PaperDb = {
	id: string;
	title: string;
	status: string;
	course_id: string | null;
	assignment_id: string | null;
	due_date: string | null;
	topic: string | null;
	passage_display: string | null;
	topical: boolean;
	notes: string | null;
	sort_order: number;
	created_at: string;
};

type PaperSourceDb = {
	id: string;
	group_id: string | null;
	book_id: string | null;
	essay_id: string | null;
	article_id: string | null;
	notes: string | null;
	usage: string;
	sort_order: number;
	created_at: string;
};

type EssayAuthorDb = {
	person_id: string;
	role: string;
	sort_order: number;
	people?:
		| {
				id: string;
				first_name: string | null;
				middle_name: string | null;
				last_name: string;
				suffix: string | null;
				aliases: string[] | null;
				deleted_at?: string | null;
		  }
		| {
				id: string;
				first_name: string | null;
				middle_name: string | null;
				last_name: string;
				suffix: string | null;
				aliases: string[] | null;
				deleted_at?: string | null;
		  }[]
		| null;
};

type EssayDb = {
	id: string;
	essay_title: string;
	page_start: string | null;
	page_end: string | null;
	parent_book_id: string;
	essay_authors: EssayAuthorDb[] | null;
};

type ArticleDb = {
	id: string;
	title: string;
	journal_title: string;
	volume: string | null;
	issue: string | null;
	year: number | null;
	page_start: string | null;
	page_end: string | null;
	doi: string | null;
	journal_article_authors: EssayAuthorDb[] | null;
};

function asPaperStatus(v: string): PaperStatus | null {
	return (PAPER_STATUSES as readonly string[]).includes(v) ? (v as PaperStatus) : null;
}

function personLongLabel(p: PersonRow): string {
	return [p.first_name, p.middle_name, p.last_name, p.suffix]
		.filter((s): s is string => !!s && s.length > 0)
		.join(' ');
}

function personFromEssayAuthor(a: EssayAuthorDb): PersonRow | null {
	const raw = Array.isArray(a.people) ? a.people[0] : a.people;
	if (!raw || raw.deleted_at) return null;
	return {
		id: raw.id,
		first_name: raw.first_name,
		middle_name: raw.middle_name,
		last_name: raw.last_name,
		suffix: raw.suffix,
		aliases: raw.aliases ?? []
	};
}

function assignmentFromJunction(a: EssayAuthorDb): BookAuthorAssignment {
	const p = personFromEssayAuthor(a);
	return {
		person_id: a.person_id,
		person_label: p ? personLongLabel(p) : 'Unknown',
		first_name: p?.first_name ?? null,
		middle_name: p?.middle_name ?? null,
		last_name: p?.last_name ?? null,
		suffix: p?.suffix ?? null,
		role: a.role as BookAuthorAssignment['role'],
		sort_order: a.sort_order
	};
}

function authorsLabel(authors: BookAuthorAssignment[]): string | null {
	const byRole = authors.filter((a) => a.role === 'author');
	const use = byRole.length > 0 ? byRole : authors;
	if (use.length === 0) return null;
	const names = use
		.slice()
		.sort((a, b) => a.sort_order - b.sort_order)
		.map((a) => a.person_label);
	if (names.length > 3) return `${names.slice(0, 3).join(', ')} et al.`;
	return names.join(', ');
}

/** Batch-hydrate course + assignment display labels onto raw paper rows. */
async function hydratePapers(supabase: SupabaseClient, rows: PaperDb[]): Promise<PaperRow[]> {
	const courseIds = [...new Set(rows.map((r) => r.course_id).filter((v): v is string => !!v))];
	const assignmentIds = [
		...new Set(rows.map((r) => r.assignment_id).filter((v): v is string => !!v))
	];

	const [coursesRes, assignmentsRes] = await Promise.all([
		courseIds.length
			? supabase.from('courses').select('id, name, code').in('id', courseIds)
			: Promise.resolve({ data: [], error: null }),
		assignmentIds.length
			? supabase.from('assignments').select('id, title, due_date').in('id', assignmentIds)
			: Promise.resolve({ data: [], error: null })
	]);

	if (coursesRes.error) console.error('[papers] hydrate courses', coursesRes.error);
	if (assignmentsRes.error) console.error('[papers] hydrate assignments', assignmentsRes.error);

	const courseById = new Map<string, { name: string; code: string | null }>();
	for (const c of (coursesRes.data ?? []) as { id: string; name: string; code: string | null }[]) {
		courseById.set(c.id, { name: c.name, code: c.code });
	}
	const assignmentById = new Map<string, { title: string; due_date: string }>();
	for (const a of (assignmentsRes.data ?? []) as {
		id: string;
		title: string;
		due_date: string;
	}[]) {
		assignmentById.set(a.id, { title: a.title, due_date: a.due_date });
	}

	const papers: PaperRow[] = [];
	for (const raw of rows) {
		const status = asPaperStatus(raw.status);
		if (!status) continue;
		const course = raw.course_id ? courseById.get(raw.course_id) : undefined;
		const assignment = raw.assignment_id ? assignmentById.get(raw.assignment_id) : undefined;
		papers.push({
			id: raw.id,
			title: raw.title,
			status,
			course_id: raw.course_id,
			course_name: course?.name ?? null,
			course_code: course?.code ?? null,
			assignment_id: raw.assignment_id,
			assignment_title: assignment?.title ?? null,
			assignment_due_date: assignment?.due_date ?? null,
			due_date: raw.due_date,
			topic: raw.topic,
			passage_display: raw.passage_display,
			topical: raw.topical !== false,
			notes: raw.notes,
			sort_order: raw.sort_order
		});
	}
	return papers;
}

export async function loadPapers(
	supabase: SupabaseClient,
	show: 'active' | 'archived' = 'active',
	bibleBook: string | null = null
): Promise<{
	papers: PaperListRow[];
	error: string | null;
}> {
	let papersQuery = supabase
		.from('papers')
		.select(PAPER_COLUMNS)
		.is('deleted_at', null)
		.order('created_at', { ascending: false });
	papersQuery =
		show === 'archived'
			? papersQuery.eq('status', 'archived')
			: papersQuery.neq('status', 'archived');
	if (bibleBook) {
		const passRes = await supabase
			.from('paper_passages')
			.select('paper_id')
			.eq('bible_book', bibleBook)
			.is('deleted_at', null);
		if (passRes.error) {
			console.error('[papers] bible book filter', passRes.error);
			return { papers: [], error: passRes.error.message };
		}
		const ids = [
			...new Set(((passRes.data ?? []) as { paper_id: string }[]).map((row) => row.paper_id))
		];
		if (ids.length === 0) return { papers: [], error: null };
		papersQuery = papersQuery.in('id', ids);
	}

	const [papersRes, countsRes] = await Promise.all([
		papersQuery,
		supabase.from('study_sources').select('paper_id').is('deleted_at', null)
	]);

	if (papersRes.error) {
		console.error('[papers] loadPapers', papersRes.error);
		return { papers: [], error: papersRes.error.message };
	}
	if (countsRes.error) console.error('[papers] source counts', countsRes.error);

	const countByPaper = new Map<string, number>();
	for (const row of countsRes.data ?? []) {
		const pid = (row as { paper_id: string | null }).paper_id;
		if (!pid) continue;
		countByPaper.set(pid, (countByPaper.get(pid) ?? 0) + 1);
	}

	const hydrated = await hydratePapers(supabase, (papersRes.data ?? []) as PaperDb[]);
	return {
		papers: hydrated.map((p) => ({ ...p, sourceCount: countByPaper.get(p.id) ?? 0 })),
		error: null
	};
}

export async function loadPaperDetail(
	supabase: SupabaseClient,
	paperId: string
): Promise<{ paper: PaperRow | null; error: string | null }> {
	const { data, error } = await supabase
		.from('papers')
		.select(PAPER_COLUMNS)
		.eq('id', paperId)
		.is('deleted_at', null)
		.maybeSingle();

	if (error) {
		console.error('[papers] loadPaperDetail', error);
		return { paper: null, error: error.message };
	}
	if (!data) return { paper: null, error: null };

	const [paper] = await hydratePapers(supabase, [data as PaperDb]);
	return { paper: paper ?? null, error: null };
}

/** Live research groups for a paper or sermon, in display order. */
export async function loadStudyGroups(
	supabase: SupabaseClient,
	parent: StudyParent
): Promise<{ groups: PaperGroupView[]; error: string | null }> {
	let query = supabase
		.from('study_research_groups')
		.select('id, name, sort_order')
		.is('deleted_at', null)
		.order('sort_order', { ascending: true })
		.order('created_at', { ascending: true });
	query = parent.kind === 'paper' ? query.eq('paper_id', parent.id) : query.eq('sermon_id', parent.id);
	const { data, error } = await query;

	if (error) {
		console.error('[studies] loadStudyGroups', error);
		return { groups: [], error: error.message };
	}
	return { groups: (data ?? []) as PaperGroupView[], error: null };
}

export async function loadPaperGroups(
	supabase: SupabaseClient,
	paperId: string
): Promise<{ groups: PaperGroupView[]; error: string | null }> {
	return loadStudyGroups(supabase, { kind: 'paper', id: paperId });
}

/** Live junction row whose catalog book/essay is gone (soft-deleted). */
export type { OrphanPaperSource };

/**
 * Sources with citation-ready inputs, in attach order. Book citation data
 * is one `books` query for every attached book (and essay parent). Essay
 * author names come from the `essay_authors → people` embed.
 * Sources whose catalog row was soft-deleted come back as `orphans`.
 */
export async function loadStudySourceViews(
	supabase: SupabaseClient,
	parent: StudyParent
): Promise<{
	sources: PaperSourceView[];
	orphans: OrphanPaperSource[];
	error: string | null;
}> {
	let sourcesQuery = supabase
		.from('study_sources')
		.select('id, group_id, book_id, essay_id, article_id, notes, usage, sort_order, created_at')
		.is('deleted_at', null)
		.order('created_at', { ascending: true });
	sourcesQuery =
		parent.kind === 'paper'
			? sourcesQuery.eq('paper_id', parent.id)
			: sourcesQuery.eq('sermon_id', parent.id);
	const sourcesRes = await sourcesQuery;

	if (sourcesRes.error) {
		console.error('[papers] loadPaperSourceViews', sourcesRes.error);
		return { sources: [], orphans: [], error: sourcesRes.error.message };
	}

	const rows = (sourcesRes.data ?? []) as PaperSourceDb[];
	const essayIds = rows.map((r) => r.essay_id).filter((v): v is string => !!v);
	const articleIds = rows.map((r) => r.article_id).filter((v): v is string => !!v);

	const [essaysRes, articlesRes] = await Promise.all([
		essayIds.length
			? supabase
					.from('essays')
					.select(
						`id, essay_title, page_start, page_end, parent_book_id,
						essay_authors ( person_id, role, sort_order, people ( id, first_name, middle_name, last_name, suffix, aliases, deleted_at ) )`
					)
					.in('id', essayIds)
					.is('deleted_at', null)
			: Promise.resolve({ data: [] as unknown[], error: null }),
		articleIds.length
			? supabase
					.from('journal_articles')
					.select(
						`id, title, journal_title, volume, issue, year, page_start, page_end, doi,
						journal_article_authors ( person_id, role, sort_order, people ( id, first_name, middle_name, last_name, suffix, aliases, deleted_at ) )`
					)
					.in('id', articleIds)
					.is('deleted_at', null)
			: Promise.resolve({ data: [] as unknown[], error: null })
	]);
	if (essaysRes.error) console.error('[papers] source essays', essaysRes.error);
	if (articlesRes.error) console.error('[papers] source articles', articlesRes.error);

	const essayById = new Map<string, { db: EssayDb; authors: BookAuthorAssignment[] }>();
	for (const raw of (essaysRes.data ?? []) as unknown[]) {
		const e = raw as EssayDb;
		const authors = (e.essay_authors ?? [])
			.slice()
			.sort((a, b) => a.sort_order - b.sort_order)
			.map((a) => assignmentFromJunction(a));
		essayById.set(e.id, { db: e, authors });
	}

	const bookIds = new Set<string>();
	for (const r of rows) {
		if (r.book_id) bookIds.add(r.book_id);
		if (r.essay_id) {
			const parentBook = essayById.get(r.essay_id)?.db.parent_book_id;
			if (parentBook) bookIds.add(parentBook);
		}
	}

	const details = await loadBooksByIds(supabase, [...bookIds]);
	const detailById = new Map<string, BookDetail>();
	for (const d of details) detailById.set(d.id, d);

	const articleById = new Map<string, { db: ArticleDb; authors: BookAuthorAssignment[] }>();
	for (const raw of (articlesRes.data ?? []) as unknown[]) {
		const article = raw as ArticleDb;
		const authors = (article.journal_article_authors ?? [])
			.slice()
			.sort((a, b) => a.sort_order - b.sort_order)
			.map((a) => assignmentFromJunction(a));
		articleById.set(article.id, { db: article, authors });
	}

	const sources: PaperSourceView[] = [];
	const orphans: OrphanPaperSource[] = [];
	for (const r of rows) {
		if (r.article_id) {
			const article = articleById.get(r.article_id);
			if (!article) {
				orphans.push({ sourceId: r.id, kind: 'article', notes: r.notes });
				continue;
			}
			sources.push({
				kind: 'article',
				sourceId: r.id,
				groupId: r.group_id,
				usage: parseStudyUsage(r.usage),
				notes: r.notes,
				articleId: r.article_id,
				article: {
					title: article.db.title,
					journal_title: article.db.journal_title,
					volume: article.db.volume,
					issue: article.db.issue,
					year: article.db.year,
					page_start: article.db.page_start,
					page_end: article.db.page_end,
					doi: article.db.doi,
					authors: article.authors
				},
				authorsLabel: authorsLabel(article.authors)
			});
			continue;
		}
		if (r.book_id) {
			const detail = detailById.get(r.book_id);
			if (!detail) {
				orphans.push({ sourceId: r.id, kind: 'book', notes: r.notes });
				continue;
			}
			const citation = bookDetailToCitationInput(detail);
			sources.push({
				kind: 'book',
				sourceId: r.id,
				groupId: r.group_id,
				usage: parseStudyUsage(r.usage),
				notes: r.notes,
				citation,
				owned: detail.owned,
				authorsLabel: authorsLabel(citation.authors)
			});
			continue;
		}
		if (r.essay_id) {
			const essay = essayById.get(r.essay_id);
			if (!essay) {
				orphans.push({ sourceId: r.id, kind: 'essay', notes: r.notes });
				continue;
			}
			const parentDetail = detailById.get(essay.db.parent_book_id);
			if (!parentDetail) {
				orphans.push({ sourceId: r.id, kind: 'essay', notes: r.notes });
				continue;
			}
			sources.push({
				kind: 'essay',
				sourceId: r.id,
				groupId: r.group_id,
				usage: parseStudyUsage(r.usage),
				notes: r.notes,
				essayId: r.essay_id,
				essay: {
					essay_title: essay.db.essay_title,
					page_start: essay.db.page_start,
					page_end: essay.db.page_end,
					authors: essay.authors.length > 0 ? essay.authors : undefined
				},
				volume: bookDetailToCitationInput(parentDetail),
				parentBookId: essay.db.parent_book_id,
				parentOwned: parentDetail.owned,
				authorsLabel: authorsLabel(essay.authors)
			});
		}
	}

	return { sources, orphans, error: null };
}

export async function loadPaperSourceViews(
	supabase: SupabaseClient,
	paperId: string
): Promise<{
	sources: PaperSourceView[];
	orphans: OrphanPaperSource[];
	error: string | null;
}> {
	return loadStudySourceViews(supabase, { kind: 'paper', id: paperId });
}
