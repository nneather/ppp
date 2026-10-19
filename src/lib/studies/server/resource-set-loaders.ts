/**
 * Resource-set read path. Rule matches are computed here; sticky overrides
 * live in `resource_set_members`. Round trips exceed the page budget because
 * commentary resolution reuses coverage + author collapse (same class as
 * `/studies/by-book`) — documented in decision 244.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ByBookShelfHit } from '$lib/types/sermons';
import {
	bibleBookFromRules,
	candidatesFromCommentaryHits,
	countNewMembers,
	groupResourceSetList,
	parseResourceSetRules,
	refKey,
	resolveSetMembers,
	type CatalogRef,
	type ResourceSetKind,
	type ResourceSetListItem,
	type ResourceSetRule,
	type ResolvedMember,
	type RuleCandidate,
	type SetOverride
} from '$lib/studies/resource-sets';

type SeriesEmbed = {
	id: string;
	name: string | null;
	abbreviation: string | null;
	deleted_at: string | null;
};

type BookEmbed = {
	id: string;
	title: string | null;
	genre: string | null;
	rating: number | null;
	deleted_at: string | null;
	series_id: string | null;
	created_at: string;
	series: SeriesEmbed | SeriesEmbed[] | null;
};

type EssayEmbed = {
	id: string;
	essay_title: string;
	deleted_at: string | null;
	parent_book_id: string;
	created_at: string;
	books: BookEmbed | BookEmbed[] | null;
};

type CoverageRow = {
	bible_book: string;
	book_id: string | null;
	essay_id: string | null;
	books: BookEmbed | BookEmbed[] | null;
	essays: EssayEmbed | EssayEmbed[] | null;
};

type AuthorRow = { book_id: string; person_id: string; role: string };
type EssayAuthorRow = { essay_id: string; person_id: string; role: string };

type SetDb = {
	id: string;
	name: string;
	slug: string;
	kind: string;
	rules: unknown;
	default_for: string[] | null;
	last_reviewed_at: string | null;
	sort_order: number;
};

type MemberDb = {
	set_id: string;
	book_id: string | null;
	essay_id: string | null;
	kind: string;
};

export type ResourceSetDetail = {
	id: string;
	name: string;
	slug: string;
	kind: ResourceSetKind;
	rules: ResourceSetRule[];
	defaultFor: string[];
	lastReviewedAt: string | null;
	included: ResolvedMember[];
	excluded: ResolvedMember[];
};

const SET_COLUMNS =
	'id, name, slug, kind, rules, default_for, last_reviewed_at, sort_order';

function oneEmbed<T>(v: T | T[] | null | undefined): T | null {
	if (v == null) return null;
	return Array.isArray(v) ? (v[0] ?? null) : v;
}

function asKind(v: string): ResourceSetKind | null {
	if (v === 'bible_book' || v === 'language' || v === 'custom') return v;
	return null;
}

function authorKey(rows: { person_id: string; role: string }[]): string {
	const ids = [
		...new Set(
			rows
				.filter((a) => a.role === 'author' || a.role === 'editor')
				.map((a) => a.person_id)
		)
	].sort();
	return ids.join('|');
}

function emptyHit(partial: Omit<ByBookShelfHit, 'authorShort' | 'seriesLabel' | 'href' | 'authorKey'> & {
	authorKey: string | null;
}): ByBookShelfHit & { createdAt: string | null } {
	return {
		...partial,
		authorShort: null,
		seriesLabel: null,
		href: partial.kind === 'essay' && partial.essayId
			? `/library/books/${partial.bookId}#essay-${partial.essayId}`
			: `/library/books/${partial.bookId}`,
		createdAt: null
	};
}

async function commentaryCandidatesByBook(
	supabase: SupabaseClient,
	bibleBooks: string[]
): Promise<Map<string, RuleCandidate[]>> {
	const out = new Map<string, RuleCandidate[]>();
	if (bibleBooks.length === 0) return out;

	const { data, error } = await supabase
		.from('book_bible_coverage')
		.select(
			`
			bible_book,
			book_id,
			essay_id,
			books (
				id, title, genre, rating, deleted_at, series_id, created_at,
				series ( id, name, abbreviation, deleted_at )
			),
			essays (
				id, essay_title, deleted_at, parent_book_id, created_at,
				books!essays_parent_book_id_fkey (
					id, title, genre, rating, deleted_at, series_id, created_at,
					series ( id, name, abbreviation, deleted_at )
				)
			)
		`
		)
		.in('bible_book', bibleBooks)
		.is('deleted_at', null);

	if (error) {
		console.error('[studies] commentary coverage', error);
		return out;
	}

	const rows = (data ?? []) as unknown as CoverageRow[];
	const bookIds = new Set<string>();
	const essayIds = new Set<string>();
	for (const row of rows) {
		const book = oneEmbed(row.books);
		if (book && !book.deleted_at && book.genre === 'Commentary' && row.book_id) {
			bookIds.add(book.id);
		}
		const essay = oneEmbed(row.essays);
		const parent = essay ? oneEmbed(essay.books) : null;
		if (essay && !essay.deleted_at && parent && !parent.deleted_at && parent.genre === 'Commentary') {
			essayIds.add(essay.id);
			bookIds.add(parent.id);
		}
	}

	const [authorsRes, essayAuthorsRes] = await Promise.all([
		bookIds.size
			? supabase
					.from('book_authors')
					.select('book_id, person_id, role')
					.in('book_id', [...bookIds])
			: Promise.resolve({ data: [] as AuthorRow[], error: null }),
		essayIds.size
			? supabase
					.from('essay_authors')
					.select('essay_id, person_id, role')
					.in('essay_id', [...essayIds])
			: Promise.resolve({ data: [] as EssayAuthorRow[], error: null })
	]);
	if (authorsRes.error) console.error('[studies] set book_authors', authorsRes.error);
	if (essayAuthorsRes.error) console.error('[studies] set essay_authors', essayAuthorsRes.error);

	const authorsByBook = new Map<string, AuthorRow[]>();
	for (const a of (authorsRes.data ?? []) as AuthorRow[]) {
		const list = authorsByBook.get(a.book_id) ?? [];
		list.push(a);
		authorsByBook.set(a.book_id, list);
	}
	const authorsByEssay = new Map<string, EssayAuthorRow[]>();
	for (const a of (essayAuthorsRes.data ?? []) as EssayAuthorRow[]) {
		const list = authorsByEssay.get(a.essay_id) ?? [];
		list.push(a);
		authorsByEssay.set(a.essay_id, list);
	}

	const hitsByBook = new Map<string, (ByBookShelfHit & { createdAt: string | null })[]>();
	for (const row of rows) {
		const essay = oneEmbed(row.essays);
		const parent = essay ? oneEmbed(essay.books) : null;
		if (essay && !essay.deleted_at && parent && !parent.deleted_at && parent.genre === 'Commentary') {
			const series = oneEmbed(parent.series);
			const hit = emptyHit({
				kind: 'essay',
				bookId: parent.id,
				essayId: essay.id,
				title: essay.essay_title,
				seriesId: parent.series_id && series && !series.deleted_at ? series.id : null,
				authorKey: authorKey(authorsByEssay.get(essay.id) ?? []) || null,
				rating: parent.rating,
				genre: parent.genre
			});
			hit.createdAt = essay.created_at;
			const list = hitsByBook.get(row.bible_book) ?? [];
			list.push(hit);
			hitsByBook.set(row.bible_book, list);
			continue;
		}

		const book = oneEmbed(row.books);
		if (!book || book.deleted_at || book.genre !== 'Commentary' || !row.book_id || row.essay_id) {
			continue;
		}
		const series = oneEmbed(book.series);
		const hit = emptyHit({
			kind: 'book',
			bookId: book.id,
			essayId: null,
			title: (book.title ?? '').trim() || 'Untitled',
			seriesId: book.series_id && series && !series.deleted_at ? series.id : null,
			authorKey: authorKey(authorsByBook.get(book.id) ?? []) || null,
			rating: book.rating,
			genre: book.genre
		});
		hit.createdAt = book.created_at;
		const list = hitsByBook.get(row.bible_book) ?? [];
		list.push(hit);
		hitsByBook.set(row.bible_book, list);
	}

	for (const [bibleBook, hits] of hitsByBook) {
		out.set(bibleBook, candidatesFromCommentaryHits(hits));
	}
	return out;
}

async function candidatesByGenre(
	supabase: SupabaseClient,
	genres: string[]
): Promise<Map<string, RuleCandidate[]>> {
	const out = new Map<string, RuleCandidate[]>();
	if (genres.length === 0) return out;
	const { data, error } = await supabase
		.from('books')
		.select('id, title, genre, created_at')
		.in('genre', genres)
		.is('deleted_at', null);
	if (error) {
		console.error('[studies] genre candidates', error);
		return out;
	}
	for (const row of (data ?? []) as {
		id: string;
		title: string | null;
		genre: string | null;
		created_at: string;
	}[]) {
		if (!row.genre) continue;
		const list = out.get(row.genre) ?? [];
		list.push({
			bookId: row.id,
			essayId: null,
			title: (row.title ?? '').trim() || 'Untitled',
			createdAt: row.created_at
		});
		out.set(row.genre, list);
	}
	return out;
}

async function candidatesByTopic(
	supabase: SupabaseClient,
	topics: string[]
): Promise<Map<string, RuleCandidate[]>> {
	const out = new Map<string, RuleCandidate[]>();
	const lowered = [...new Set(topics.map((t) => t.toLowerCase()))];
	if (lowered.length === 0) return out;
	const { data, error } = await supabase
		.from('book_topics')
		.select('topic, book_id, books ( id, title, created_at, deleted_at )')
		.in('topic', lowered)
		.is('deleted_at', null);
	if (error) {
		console.error('[studies] topic candidates', error);
		return out;
	}
	for (const row of (data ?? []) as unknown as {
		topic: string;
		book_id: string | null;
		books:
			| { id: string; title: string | null; created_at: string; deleted_at: string | null }
			| { id: string; title: string | null; created_at: string; deleted_at: string | null }[]
			| null;
	}[]) {
		const book = oneEmbed(row.books);
		if (!book || book.deleted_at || !row.book_id) continue;
		const list = out.get(row.topic) ?? [];
		if (list.some((c) => c.bookId === book.id)) continue;
		list.push({
			bookId: book.id,
			essayId: null,
			title: (book.title ?? '').trim() || 'Untitled',
			createdAt: book.created_at
		});
		out.set(row.topic, list);
	}
	return out;
}

function candidatesForRules(
	rules: ResourceSetRule[],
	commentary: Map<string, RuleCandidate[]>,
	genres: Map<string, RuleCandidate[]>,
	topics: Map<string, RuleCandidate[]>
): RuleCandidate[] {
	const out: RuleCandidate[] = [];
	const seen = new Set<string>();
	for (const rule of rules) {
		const bucket =
			rule.kind === 'bible_book'
				? (commentary.get(rule.value) ?? [])
				: rule.kind === 'genre'
					? (genres.get(rule.value) ?? [])
					: (topics.get(rule.value.toLowerCase()) ?? topics.get(rule.value) ?? []);
		for (const c of bucket) {
			const key = refKey(c);
			if (!key || seen.has(key)) continue;
			seen.add(key);
			out.push(c);
		}
	}
	return out;
}

async function loadOverrides(
	supabase: SupabaseClient,
	setIds: string[]
): Promise<Map<string, SetOverride[]>> {
	const out = new Map<string, SetOverride[]>();
	if (setIds.length === 0) return out;
	const { data, error } = await supabase
		.from('resource_set_members')
		.select('set_id, book_id, essay_id, kind')
		.in('set_id', setIds)
		.is('deleted_at', null);
	if (error) {
		console.error('[studies] set members', error);
		return out;
	}
	const rows = (data ?? []) as MemberDb[];
	const bookIds = [...new Set(rows.map((r) => r.book_id).filter((v): v is string => !!v))];
	const essayIds = [...new Set(rows.map((r) => r.essay_id).filter((v): v is string => !!v))];
	const [booksRes, essaysRes] = await Promise.all([
		bookIds.length
			? supabase.from('books').select('id, title').in('id', bookIds).is('deleted_at', null)
			: Promise.resolve({ data: [] as { id: string; title: string | null }[], error: null }),
		essayIds.length
			? supabase.from('essays').select('id, essay_title').in('id', essayIds).is('deleted_at', null)
			: Promise.resolve({ data: [] as { id: string; essay_title: string }[], error: null })
	]);
	if (booksRes.error) console.error('[studies] override books', booksRes.error);
	if (essaysRes.error) console.error('[studies] override essays', essaysRes.error);
	const bookTitle = new Map(
		((booksRes.data ?? []) as { id: string; title: string | null }[]).map((b) => [
			b.id,
			(b.title ?? '').trim() || 'Untitled'
		])
	);
	const essayTitle = new Map(
		((essaysRes.data ?? []) as { id: string; essay_title: string }[]).map((e) => [
			e.id,
			e.essay_title.trim() || 'Untitled'
		])
	);

	for (const row of rows) {
		if (row.kind !== 'include' && row.kind !== 'exclude') continue;
		const title = row.book_id
			? (bookTitle.get(row.book_id) ?? null)
			: row.essay_id
				? (essayTitle.get(row.essay_id) ?? null)
				: null;
		const list = out.get(row.set_id) ?? [];
		list.push({
			bookId: row.book_id,
			essayId: row.essay_id,
			kind: row.kind,
			title
		});
		out.set(row.set_id, list);
	}
	return out;
}

function resolveOne(
	set: SetDb,
	commentary: Map<string, RuleCandidate[]>,
	genres: Map<string, RuleCandidate[]>,
	topics: Map<string, RuleCandidate[]>,
	overrides: Map<string, SetOverride[]>
): { rules: ResourceSetRule[]; included: ResolvedMember[]; excluded: ResolvedMember[] } | null {
	const kind = asKind(set.kind);
	if (!kind) return null;
	const rules = parseResourceSetRules(set.rules);
	const resolved = resolveSetMembers({
		candidates: candidatesForRules(rules, commentary, genres, topics),
		overrides: overrides.get(set.id) ?? [],
		lastReviewedAt: set.last_reviewed_at
	});
	return { rules, ...resolved };
}

async function loadContext(supabase: SupabaseClient, sets: SetDb[]) {
	const rulesBySet = new Map(sets.map((s) => [s.id, parseResourceSetRules(s.rules)]));
	const bibleBooks = new Set<string>();
	const genres = new Set<string>();
	const topics = new Set<string>();
	for (const rules of rulesBySet.values()) {
		for (const rule of rules) {
			if (rule.kind === 'bible_book') bibleBooks.add(rule.value);
			else if (rule.kind === 'genre') genres.add(rule.value);
			else topics.add(rule.value.toLowerCase());
		}
	}
	const [commentary, genreMap, topicMap, overrides] = await Promise.all([
		commentaryCandidatesByBook(supabase, [...bibleBooks]),
		candidatesByGenre(supabase, [...genres]),
		candidatesByTopic(supabase, [...topics]),
		loadOverrides(
			supabase,
			sets.map((s) => s.id)
		)
	]);
	return { commentary, genreMap, topicMap, overrides };
}

export async function loadResourceSetList(supabase: SupabaseClient): Promise<{
	groups: ReturnType<typeof groupResourceSetList>;
	error: string | null;
}> {
	const { data, error } = await supabase
		.from('resource_sets')
		.select(SET_COLUMNS)
		.is('deleted_at', null)
		.order('sort_order', { ascending: true });
	if (error) {
		console.error('[studies] loadResourceSetList', error);
		return {
			groups: { bibleBooks: [], language: [], custom: [] },
			error: error.message
		};
	}
	const sets = (data ?? []) as SetDb[];
	const ctx = await loadContext(supabase, sets);
	const items: ResourceSetListItem[] = [];
	for (const set of sets) {
		const kind = asKind(set.kind);
		if (!kind) continue;
		const resolved = resolveOne(set, ctx.commentary, ctx.genreMap, ctx.topicMap, ctx.overrides);
		if (!resolved) continue;
		items.push({
			id: set.id,
			name: set.name,
			slug: set.slug,
			kind,
			sortOrder: set.sort_order,
			bibleBook: bibleBookFromRules(resolved.rules),
			memberCount: resolved.included.length,
			newCount: countNewMembers(resolved.included)
		});
	}
	return { groups: groupResourceSetList(items), error: null };
}

export async function loadResourceSetDetail(
	supabase: SupabaseClient,
	id: string
): Promise<{ set: ResourceSetDetail | null; error: string | null }> {
	const { data, error } = await supabase
		.from('resource_sets')
		.select(SET_COLUMNS)
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();
	if (error) {
		console.error('[studies] loadResourceSetDetail', error);
		return { set: null, error: error.message };
	}
	if (!data) return { set: null, error: null };
	const set = data as SetDb;
	const kind = asKind(set.kind);
	if (!kind) return { set: null, error: 'Unknown set kind.' };
	const ctx = await loadContext(supabase, [set]);
	const resolved = resolveOne(set, ctx.commentary, ctx.genreMap, ctx.topicMap, ctx.overrides);
	if (!resolved) return { set: null, error: 'Could not resolve set.' };
	return {
		set: {
			id: set.id,
			name: set.name,
			slug: set.slug,
			kind,
			rules: resolved.rules,
			defaultFor: set.default_for ?? [],
			lastReviewedAt: set.last_reviewed_at,
			included: resolved.included,
			excluded: resolved.excluded
		},
		error: null
	};
}

export type { CatalogRef };
