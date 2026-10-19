/**
 * Expository-study facts for hit rate, plus the By book papers column.
 * Extra round trips on the by-book load (same class as commentary coverage).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	computeHitRates,
	paperStudyDate,
	type HitRate,
	type HitRateBook,
	type HitRateStudy
} from '$lib/studies/hit-rate';
import { parseStudyUsage, type StudyUsage } from '$lib/studies/source-usage';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export type StudyUseLink = {
	kind: 'paper' | 'sermon';
	id: string;
	label: string;
	href: string;
	usage: StudyUsage;
};

type PassageRow = {
	parentId: string;
	bibleBook: string;
	role: string;
};

function primaryBooks(rows: PassageRow[], parentId: string): string[] {
	const books: string[] = [];
	for (const row of rows) {
		if (row.parentId !== parentId || row.role !== 'primary') continue;
		if (!books.includes(row.bibleBook)) books.push(row.bibleBook);
	}
	return books;
}

function countParentsByBook(rows: PassageRow[]): Map<string, number> {
	const ids = new Map<string, Set<string>>();
	for (const row of rows) {
		const set = ids.get(row.bibleBook) ?? new Set<string>();
		set.add(row.parentId);
		ids.set(row.bibleBook, set);
	}
	const counts = new Map<string, number>();
	for (const [book, set] of ids) counts.set(book, set.size);
	return counts;
}

export async function loadCanonStudyFacts(supabase: SupabaseClient): Promise<{
	studies: HitRateStudy[];
	paperCountByBook: Map<string, number>;
	error: string | null;
}> {
	const [papersRes, sermonsRes, paperPassRes, sermonPassRes, sourcesRes] = await Promise.all([
		supabase
			.from('papers')
			.select('id, topical, due_date, created_at')
			.is('deleted_at', null),
		supabase.from('sermons').select('id, topical, preached_on').is('deleted_at', null),
		supabase
			.from('paper_passages')
			.select('paper_id, bible_book, role, papers!inner ( deleted_at )')
			.is('deleted_at', null)
			.is('papers.deleted_at', null),
		supabase
			.from('sermon_passages')
			.select('sermon_id, bible_book, role, sermons!inner ( deleted_at )')
			.is('deleted_at', null)
			.is('sermons.deleted_at', null),
		supabase
			.from('study_sources')
			.select('paper_id, sermon_id, book_id, essay_id, usage')
			.is('deleted_at', null)
			.in('usage', ['consulted', 'cited'])
	]);

	const failed = papersRes.error ?? sermonsRes.error ?? paperPassRes.error ?? sermonPassRes.error ?? sourcesRes.error;
	if (failed) {
		console.error('[studies] loadCanonStudyFacts', failed);
		return { studies: [], paperCountByBook: new Map(), error: failed.message };
	}

	const paperPassages: PassageRow[] = ((paperPassRes.data ?? []) as {
		paper_id: string;
		bible_book: string;
		role: string;
	}[]).map((row) => ({ parentId: row.paper_id, bibleBook: row.bible_book, role: row.role }));
	const sermonPassages: PassageRow[] = ((sermonPassRes.data ?? []) as {
		sermon_id: string;
		bible_book: string;
		role: string;
	}[]).map((row) => ({ parentId: row.sermon_id, bibleBook: row.bible_book, role: row.role }));

	const sourceRows = (sourcesRes.data ?? []) as {
		paper_id: string | null;
		sermon_id: string | null;
		book_id: string | null;
		essay_id: string | null;
		usage: string;
	}[];
	const essayIds = [...new Set(sourceRows.map((r) => r.essay_id).filter((id): id is string => !!id))];
	const essaysRes = essayIds.length
		? await supabase.from('essays').select('id, parent_book_id').in('id', essayIds).is('deleted_at', null)
		: { data: [] as { id: string; parent_book_id: string }[], error: null };
	if (essaysRes.error) console.error('[studies] hit-rate essays', essaysRes.error);
	const parentByEssay = new Map<string, string>();
	for (const essay of (essaysRes.data ?? []) as { id: string; parent_book_id: string }[]) {
		parentByEssay.set(essay.id, essay.parent_book_id);
	}

	const usedByParent = new Map<string, Set<string>>();
	for (const row of sourceRows) {
		const usage = parseStudyUsage(row.usage);
		if (usage !== 'consulted' && usage !== 'cited') continue;
		const parentId = row.paper_id ?? row.sermon_id;
		if (!parentId) continue;
		const bookId = row.book_id ?? (row.essay_id ? parentByEssay.get(row.essay_id) : null);
		if (!bookId) continue;
		const set = usedByParent.get(parentId) ?? new Set<string>();
		set.add(bookId);
		usedByParent.set(parentId, set);
	}

	const studies: HitRateStudy[] = [];
	for (const paper of (papersRes.data ?? []) as {
		id: string;
		topical: boolean;
		due_date: string | null;
		created_at: string;
	}[]) {
		const on = paperStudyDate(paper.due_date, paper.created_at);
		if (!YMD_RE.test(on)) continue;
		studies.push({
			id: paper.id,
			topical: paper.topical,
			on,
			primaryBooks: primaryBooks(paperPassages, paper.id),
			usedBookIds: [...(usedByParent.get(paper.id) ?? [])]
		});
	}
	for (const sermon of (sermonsRes.data ?? []) as {
		id: string;
		topical: boolean;
		preached_on: string;
	}[]) {
		if (!YMD_RE.test(sermon.preached_on)) continue;
		studies.push({
			id: sermon.id,
			topical: sermon.topical,
			on: sermon.preached_on,
			primaryBooks: primaryBooks(sermonPassages, sermon.id),
			usedBookIds: [...(usedByParent.get(sermon.id) ?? [])]
		});
	}

	return {
		studies,
		paperCountByBook: countParentsByBook(paperPassages),
		error: null
	};
}

export async function loadAcquiredOn(
	supabase: SupabaseClient,
	bookIds: string[]
): Promise<Map<string, string | null>> {
	const out = new Map<string, string | null>();
	if (bookIds.length === 0) return out;
	const { data, error } = await supabase
		.from('books')
		.select('id, acquired_on')
		.in('id', bookIds)
		.is('deleted_at', null);
	if (error) {
		console.error('[studies] acquired_on', error);
		return out;
	}
	for (const row of (data ?? []) as { id: string; acquired_on: string | null }[]) {
		out.set(row.id, row.acquired_on);
	}
	return out;
}

export function hitRatesForCoverage(
	studies: HitRateStudy[],
	coverage: { bookId: string; bibleBook: string }[],
	acquiredOn: Map<string, string | null>
): HitRate[] {
	const books = new Map<string, Set<string>>();
	for (const row of coverage) {
		const set = books.get(row.bookId) ?? new Set<string>();
		set.add(row.bibleBook);
		books.set(row.bookId, set);
	}
	const input: HitRateBook[] = [];
	for (const [bookId, bibleBooks] of books) {
		input.push({
			bookId,
			acquiredOn: acquiredOn.get(bookId) ?? null,
			bibleBooks: [...bibleBooks]
		});
	}
	return computeHitRates(studies, input);
}

const USAGE_RANK: Record<StudyUsage, number> = { candidate: 0, consulted: 1, cited: 2 };

function preferUsage(current: StudyUsage, next: StudyUsage): StudyUsage {
	return USAGE_RANK[next] > USAGE_RANK[current] ? next : current;
}

/** Book-detail backlinks: every live study source on this book or one of its essays. */
export async function loadBookStudyUse(
	supabase: SupabaseClient,
	bookId: string
): Promise<{ links: StudyUseLink[]; hitRates: HitRate[]; error: string | null }> {
	const [directRes, essaysRes, facts] = await Promise.all([
		supabase
			.from('study_sources')
			.select('paper_id, sermon_id, usage')
			.eq('book_id', bookId)
			.is('deleted_at', null),
		supabase.from('essays').select('id').eq('parent_book_id', bookId).is('deleted_at', null),
		loadCanonStudyFacts(supabase)
	]);
	if (directRes.error) {
		console.error('[studies] used-in books', directRes.error);
		return { links: [], hitRates: [], error: directRes.error.message };
	}
	if (essaysRes.error) console.error('[studies] used-in essays', essaysRes.error);

	const essayIds = ((essaysRes.data ?? []) as { id: string }[]).map((row) => row.id);
	const essaySourcesRes = essayIds.length
		? await supabase
				.from('study_sources')
				.select('paper_id, sermon_id, usage')
				.in('essay_id', essayIds)
				.is('deleted_at', null)
		: { data: [] as { paper_id: string | null; sermon_id: string | null; usage: string }[], error: null };
	if (essaySourcesRes.error) console.error('[studies] used-in essay sources', essaySourcesRes.error);

	type ParentUse = { kind: 'paper' | 'sermon'; id: string; usage: StudyUsage };
	const byParent = new Map<string, ParentUse>();
	const absorb = (rows: { paper_id: string | null; sermon_id: string | null; usage: string }[]) => {
		for (const row of rows) {
			const kind = row.paper_id ? 'paper' : row.sermon_id ? 'sermon' : null;
			const id = row.paper_id ?? row.sermon_id;
			if (!kind || !id) continue;
			const usage = parseStudyUsage(row.usage);
			const prev = byParent.get(id);
			if (!prev) byParent.set(id, { kind, id, usage });
			else prev.usage = preferUsage(prev.usage, usage);
		}
	};
	absorb((directRes.data ?? []) as { paper_id: string | null; sermon_id: string | null; usage: string }[]);
	absorb(
		(essaySourcesRes.data ?? []) as {
			paper_id: string | null;
			sermon_id: string | null;
			usage: string;
		}[]
	);

	const paperIds = [...byParent.values()].filter((p) => p.kind === 'paper').map((p) => p.id);
	const sermonIds = [...byParent.values()].filter((p) => p.kind === 'sermon').map((p) => p.id);
	const [papersRes, sermonsRes, coverageRes] = await Promise.all([
		paperIds.length
			? supabase
					.from('papers')
					.select('id, title, passage_display')
					.in('id', paperIds)
					.is('deleted_at', null)
			: Promise.resolve({ data: [] as { id: string; title: string; passage_display: string | null }[], error: null }),
		sermonIds.length
			? supabase
					.from('sermons')
					.select('id, topic, passage_display, preached_on')
					.in('id', sermonIds)
					.is('deleted_at', null)
			: Promise.resolve({
					data: [] as {
						id: string;
						topic: string | null;
						passage_display: string | null;
						preached_on: string;
					}[],
					error: null
				}),
		supabase
			.from('book_bible_coverage')
			.select('bible_book, book_id, essay_id')
			.or(
				essayIds.length
					? `book_id.eq.${bookId},essay_id.in.(${essayIds.join(',')})`
					: `book_id.eq.${bookId}`
			)
	]);
	if (papersRes.error) console.error('[studies] used-in paper labels', papersRes.error);
	if (sermonsRes.error) console.error('[studies] used-in sermon labels', sermonsRes.error);
	if (coverageRes.error) console.error('[studies] used-in coverage', coverageRes.error);

	const paperLabel = new Map<string, string>();
	for (const paper of (papersRes.data ?? []) as {
		id: string;
		title: string;
		passage_display: string | null;
	}[]) {
		paperLabel.set(paper.id, paper.passage_display?.trim() || paper.title);
	}
	const sermonLabel = new Map<string, string>();
	for (const sermon of (sermonsRes.data ?? []) as {
		id: string;
		topic: string | null;
		passage_display: string | null;
		preached_on: string;
	}[]) {
		sermonLabel.set(
			sermon.id,
			sermon.passage_display?.trim() || sermon.topic?.trim() || sermon.preached_on
		);
	}

	const links: StudyUseLink[] = [];
	for (const use of byParent.values()) {
		if (use.kind === 'paper') {
			const label = paperLabel.get(use.id);
			if (!label) continue;
			links.push({
				kind: 'paper',
				id: use.id,
				label,
				href: `/studies/papers/${use.id}`,
				usage: use.usage
			});
		} else {
			const label = sermonLabel.get(use.id);
			if (!label) continue;
			links.push({
				kind: 'sermon',
				id: use.id,
				label,
				href: `/studies/sermons/${use.id}`,
				usage: use.usage
			});
		}
	}
	links.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

	const acquired = await loadAcquiredOn(supabase, [bookId]);
	const bibleBooks: string[] = [];
	for (const row of (coverageRes.data ?? []) as { bible_book: string }[]) {
		if (!bibleBooks.includes(row.bible_book)) bibleBooks.push(row.bible_book);
	}
	const hitRates = facts.error
		? []
		: computeHitRates(facts.studies, [
				{ bookId, acquiredOn: acquired.get(bookId) ?? null, bibleBooks }
			]);

	return { links, hitRates, error: facts.error };
}
