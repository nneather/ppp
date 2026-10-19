/**
 * Resource-set read path. Rule matches are computed here; sticky overrides
 * live in `resource_set_members`. Round trips exceed the page budget because
 * commentary resolution reuses coverage + author collapse (same class as
 * `/studies/by-book`) — documented in decision 244.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { authorsLabelForBook } from '$lib/library/authors-label';
import type { PersonRow } from '$lib/types/library';
import type { ByBookShelfHit } from '$lib/types/sermons';
import {
	bibleBookFromRules,
	candidatesFromCommentaryHits,
	countNewMembers,
	groupVolumeSearchHits,
	groupSetsIntoSections,
	parseResourceSetRules,
	refKey,
	resolveSetMembers,
	type CatalogRef,
	type ResourceSetKind,
	type ResourceSetListItem,
	type ResourceSetRule,
	type ResourceSetSectionGroup,
	type ResourceSetSectionMeta,
	type ResolvedMember,
	type RuleCandidate,
	type SetOverride,
	type VolumeSearchRow,
	type VolumeSearchGroup
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
	section_id: string;
	rules: unknown;
	default_for: string[] | null;
	last_reviewed_at: string | null;
	sort_order: number;
};

type SectionDb = {
	id: string;
	name: string;
	slug: string;
	set_kind: string;
	locked: boolean;
	sort_order: number;
};

type MemberDb = {
	set_id: string;
	book_id: string | null;
	essay_id: string | null;
	kind: string;
	bibliographical: boolean;
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
	'id, name, slug, kind, section_id, rules, default_for, last_reviewed_at, sort_order';

const SECTION_COLUMNS = 'id, name, slug, set_kind, locked, sort_order';

function asSection(row: SectionDb): ResourceSetSectionMeta | null {
	const setKind = asKind(row.set_kind);
	if (!setKind) return null;
	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		setKind,
		locked: row.locked,
		sortOrder: row.sort_order
	};
}

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
		.in('bible_book', bibleBooks);

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
		.select('id, title, genre, created_at, series_id, volume_number, series ( id, abbreviation, deleted_at )')
		.in('genre', genres)
		.is('deleted_at', null);
	if (error) {
		console.error('[studies] genre candidates', error);
		return out;
	}
	for (const row of (data ?? []) as unknown as {
		id: string;
		title: string | null;
		genre: string | null;
		created_at: string;
		series_id: string | null;
		volume_number: string | null;
		series:
			| { id: string; abbreviation: string | null; deleted_at: string | null }
			| { id: string; abbreviation: string | null; deleted_at: string | null }[]
			| null;
	}[]) {
		if (!row.genre) continue;
		const series = oneEmbed(row.series);
		const seriesLive = row.series_id && series && !series.deleted_at ? series : null;
		const list = out.get(row.genre) ?? [];
		list.push({
			bookId: row.id,
			essayId: null,
			title: (row.title ?? '').trim() || 'Untitled',
			createdAt: row.created_at,
			seriesId: seriesLive?.id ?? null,
			volumeNumber: row.volume_number,
			seriesAbbreviation: seriesLive?.abbreviation?.trim() || null
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
		.select('topic, book_id, books ( id, title, created_at, deleted_at, series_id, volume_number, series ( id, abbreviation, deleted_at ) )')
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
			| {
					id: string;
					title: string | null;
					created_at: string;
					deleted_at: string | null;
					series_id: string | null;
					volume_number: string | null;
					series:
						| { id: string; abbreviation: string | null; deleted_at: string | null }
						| { id: string; abbreviation: string | null; deleted_at: string | null }[]
						| null;
			  }
			| {
					id: string;
					title: string | null;
					created_at: string;
					deleted_at: string | null;
					series_id: string | null;
					volume_number: string | null;
					series:
						| { id: string; abbreviation: string | null; deleted_at: string | null }
						| { id: string; abbreviation: string | null; deleted_at: string | null }[]
						| null;
			  }[]
			| null;
	}[]) {
		const book = oneEmbed(row.books);
		if (!book || book.deleted_at || !row.book_id) continue;
		const series = oneEmbed(book.series);
		const seriesLive = book.series_id && series && !series.deleted_at ? series : null;
		const list = out.get(row.topic) ?? [];
		if (list.some((c) => c.bookId === book.id)) continue;
		list.push({
			bookId: book.id,
			essayId: null,
			title: (book.title ?? '').trim() || 'Untitled',
			createdAt: book.created_at,
			seriesId: seriesLive?.id ?? null,
			volumeNumber: book.volume_number,
			seriesAbbreviation: seriesLive?.abbreviation?.trim() || null
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
		.select('set_id, book_id, essay_id, kind, bibliographical')
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
			? supabase
					.from('books')
					.select('id, title, series_id, volume_number, series ( id, abbreviation, deleted_at )')
					.in('id', bookIds)
					.is('deleted_at', null)
			: Promise.resolve({
					data: [] as {
						id: string;
						title: string | null;
						series_id: string | null;
						volume_number: string | null;
						series:
							| { id: string; abbreviation: string | null; deleted_at: string | null }
							| { id: string; abbreviation: string | null; deleted_at: string | null }[]
							| null;
					}[],
					error: null
				}),
		essayIds.length
			? supabase.from('essays').select('id, essay_title').in('id', essayIds).is('deleted_at', null)
			: Promise.resolve({ data: [] as { id: string; essay_title: string }[], error: null })
	]);
	if (booksRes.error) console.error('[studies] override books', booksRes.error);
	if (essaysRes.error) console.error('[studies] override essays', essaysRes.error);
	type OverrideBook = {
		id: string;
		title: string | null;
		series_id: string | null;
		volume_number: string | null;
		series:
			| { id: string; abbreviation: string | null; deleted_at: string | null }
			| { id: string; abbreviation: string | null; deleted_at: string | null }[]
			| null;
	};
	const bookMeta = new Map<string, OverrideBook>();
	for (const book of (booksRes.data ?? []) as OverrideBook[]) bookMeta.set(book.id, book);
	const essayTitle = new Map(
		((essaysRes.data ?? []) as { id: string; essay_title: string }[]).map((e) => [
			e.id,
			e.essay_title.trim() || 'Untitled'
		])
	);

	for (const row of rows) {
		if (row.kind !== 'include' && row.kind !== 'exclude') continue;
		const book = row.book_id ? bookMeta.get(row.book_id) : undefined;
		const series = book ? oneEmbed(book.series) : null;
		const seriesLive = book?.series_id && series && !series.deleted_at ? series : null;
		const title = book
			? (book.title ?? '').trim() || 'Untitled'
			: row.essay_id
				? (essayTitle.get(row.essay_id) ?? null)
				: null;
		const list = out.get(row.set_id) ?? [];
		list.push({
			bookId: row.book_id,
			essayId: row.essay_id,
			kind: row.kind,
			title,
			bibliographical: row.bibliographical !== false,
			seriesId: seriesLive?.id ?? null,
			volumeNumber: book?.volume_number ?? null,
			seriesAbbreviation: seriesLive?.abbreviation?.trim() || null
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
	sections: ResourceSetSectionGroup[];
	error: string | null;
}> {
	const [setsRes, sectionsRes] = await Promise.all([
		supabase.from('resource_sets').select(SET_COLUMNS).is('deleted_at', null).order('sort_order', { ascending: true }),
		supabase
			.from('resource_set_sections')
			.select(SECTION_COLUMNS)
			.is('deleted_at', null)
			.order('sort_order', { ascending: true })
	]);
	if (setsRes.error || sectionsRes.error) {
		const error = setsRes.error ?? sectionsRes.error;
		console.error('[studies] loadResourceSetList', error);
		return { sections: [], error: error?.message ?? 'Could not load sets.' };
	}
	const sets = (setsRes.data ?? []) as SetDb[];
	const sections = ((sectionsRes.data ?? []) as SectionDb[])
		.map(asSection)
		.filter((s): s is ResourceSetSectionMeta => s != null);
	const ctx = await loadContext(supabase, sets);
	const items: ResourceSetListItem[] = [];
	for (const set of sets) {
		const kind = asKind(set.kind);
		if (!kind || !set.section_id) continue;
		const resolved = resolveOne(set, ctx.commentary, ctx.genreMap, ctx.topicMap, ctx.overrides);
		if (!resolved) continue;
		items.push({
			id: set.id,
			name: set.name,
			slug: set.slug,
			kind,
			sectionId: set.section_id,
			sortOrder: set.sort_order,
			bibleBook: bibleBookFromRules(resolved.rules),
			memberCount: resolved.included.length,
			newCount: countNewMembers(resolved.included)
		});
	}
	return { sections: groupSetsIntoSections(sections, items), error: null };
}

type AuthorJunction = { person_id: string; role: string; sort_order: number };

/** Short author line per catalog ref. Essay authors win; otherwise the parent book. */
export async function authorLabelsForRefs(
	supabase: SupabaseClient,
	refs: CatalogRef[]
): Promise<Map<string, string>> {
	const out = new Map<string, string>();
	const bookIds = [...new Set(refs.flatMap((r) => (r.bookId && !r.essayId ? [r.bookId] : [])))];
	const essayIds = [...new Set(refs.flatMap((r) => (r.essayId ? [r.essayId] : [])))];
	if (bookIds.length === 0 && essayIds.length === 0) return out;

	const [bookAuthorsRes, essayAuthorsRes, essaysRes] = await Promise.all([
		bookIds.length
			? supabase
					.from('book_authors')
					.select('book_id, person_id, role, sort_order')
					.in('book_id', bookIds)
			: Promise.resolve({
					data: [] as { book_id: string; person_id: string; role: string; sort_order: number }[],
					error: null
				}),
		essayIds.length
			? supabase
					.from('essay_authors')
					.select('essay_id, person_id, role, sort_order')
					.in('essay_id', essayIds)
			: Promise.resolve({
					data: [] as { essay_id: string; person_id: string; role: string; sort_order: number }[],
					error: null
				}),
		essayIds.length
			? supabase.from('essays').select('id, parent_book_id').in('id', essayIds).is('deleted_at', null)
			: Promise.resolve({ data: [] as { id: string; parent_book_id: string }[], error: null })
	]);
	if (bookAuthorsRes.error) console.error('[studies] set author labels', bookAuthorsRes.error);
	if (essayAuthorsRes.error) console.error('[studies] set essay author labels', essayAuthorsRes.error);
	if (essaysRes.error) console.error('[studies] set essay parents', essaysRes.error);

	const parentByEssay = new Map(
		((essaysRes.data ?? []) as { id: string; parent_book_id: string }[]).map((e) => [
			e.id,
			e.parent_book_id
		])
	);
	const parentIds = [...parentByEssay.values()].filter((id) => !bookIds.includes(id));
	let parentAuthors: { book_id: string; person_id: string; role: string; sort_order: number }[] = [];
	if (parentIds.length > 0) {
		const parentRes = await supabase
			.from('book_authors')
			.select('book_id, person_id, role, sort_order')
			.in('book_id', parentIds);
		if (parentRes.error) console.error('[studies] set parent authors', parentRes.error);
		parentAuthors = (parentRes.data ?? []) as typeof parentAuthors;
	}

	const junctionsByBook = new Map<string, AuthorJunction[]>();
	for (const row of [
		...((bookAuthorsRes.data ?? []) as {
			book_id: string;
			person_id: string;
			role: string;
			sort_order: number;
		}[]),
		...parentAuthors
	]) {
		const list = junctionsByBook.get(row.book_id) ?? [];
		list.push(row);
		junctionsByBook.set(row.book_id, list);
	}
	const junctionsByEssay = new Map<string, AuthorJunction[]>();
	for (const row of (essayAuthorsRes.data ?? []) as {
		essay_id: string;
		person_id: string;
		role: string;
		sort_order: number;
	}[]) {
		const list = junctionsByEssay.get(row.essay_id) ?? [];
		list.push(row);
		junctionsByEssay.set(row.essay_id, list);
	}

	const personIds = new Set<string>();
	for (const rows of junctionsByBook.values()) for (const row of rows) personIds.add(row.person_id);
	for (const rows of junctionsByEssay.values()) for (const row of rows) personIds.add(row.person_id);
	if (personIds.size === 0) return out;

	const peopleRes = await supabase
		.from('people')
		.select('id, first_name, middle_name, last_name, suffix')
		.in('id', [...personIds])
		.is('deleted_at', null);
	if (peopleRes.error) {
		console.error('[studies] set people', peopleRes.error);
		return out;
	}
	const people = new Map<string, PersonRow>();
	for (const row of (peopleRes.data ?? []) as {
		id: string;
		first_name: string | null;
		middle_name: string | null;
		last_name: string;
		suffix: string | null;
	}[]) {
		people.set(row.id, { ...row, aliases: [] });
	}

	const labelFor = (rows: AuthorJunction[] | undefined): string | null =>
		rows && rows.length > 0 ? authorsLabelForBook(rows, people) : null;

	for (const ref of refs) {
		const key = refKey(ref);
		if (!key || out.has(key)) continue;
		if (ref.essayId) {
			const essayLabel = labelFor(junctionsByEssay.get(ref.essayId));
			const parentId = parentByEssay.get(ref.essayId);
			const label = essayLabel ?? (parentId ? labelFor(junctionsByBook.get(parentId)) : null);
			if (label) out.set(key, label);
			continue;
		}
		if (ref.bookId) {
			const label = labelFor(junctionsByBook.get(ref.bookId));
			if (label) out.set(key, label);
		}
	}
	return out;
}

function withAuthorLabels(members: ResolvedMember[], labels: Map<string, string>): ResolvedMember[] {
	return members.map((member) => ({ ...member, authors: labels.get(refKey(member)) ?? null }));
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
	const labels = await authorLabelsForRefs(supabase, [...resolved.included, ...resolved.excluded]);
	return {
		set: {
			id: set.id,
			name: set.name,
			slug: set.slug,
			kind,
			rules: resolved.rules,
			defaultFor: set.default_for ?? [],
			lastReviewedAt: set.last_reviewed_at,
			included: withAuthorLabels(resolved.included, labels),
			excluded: withAuthorLabels(resolved.excluded, labels)
		},
		error: null
	};
}

/** Names + rules only. Import suggestions must not resolve every commentary set. */
export async function loadResourceSetSummaries(supabase: SupabaseClient): Promise<{
	sets: {
		id: string;
		name: string;
		kind: ResourceSetKind;
		rules: ResourceSetRule[];
		sectionName: string | null;
		sectionSort: number;
	}[];
	error: string | null;
}> {
	const { data, error } = await supabase
		.from('resource_sets')
		.select(
			'id, name, kind, rules, resource_set_sections!resource_sets_section_id_fkey ( name, sort_order )'
		)
		.is('deleted_at', null)
		.order('name', { ascending: true });
	if (error) {
		console.error('[studies] loadResourceSetSummaries', error);
		return { sets: [], error: error.message };
	}
	const sets = [];
	for (const row of (data ?? []) as {
		id: string;
		name: string;
		kind: string;
		rules: unknown;
		resource_set_sections:
			| { name: string; sort_order: number }
			| { name: string; sort_order: number }[]
			| null;
	}[]) {
		const kind = asKind(row.kind);
		if (!kind) continue;
		const section = oneEmbed(row.resource_set_sections);
		sets.push({
			id: row.id,
			name: row.name,
			kind,
			rules: parseResourceSetRules(row.rules),
			sectionName: section?.name ?? null,
			sectionSort: section?.sort_order ?? 0
		});
	}
	return { sets, error: null };
}

type AddSearchBook = {
	id: string;
	title: string | null;
	series_id: string | null;
	volume_number: string | null;
	series:
		| { id: string; abbreviation: string | null; deleted_at: string | null }
		| { id: string; abbreviation: string | null; deleted_at: string | null }[]
		| null;
};

function addSearchRow(book: AddSearchBook): VolumeSearchRow | null {
	if (!book.id) return null;
	const series = oneEmbed(book.series);
	const seriesLive = book.series_id && series && !series.deleted_at ? series : null;
	return {
		id: book.id,
		title: (book.title ?? '').trim() || 'Untitled',
		seriesId: seriesLive?.id ?? null,
		volumeNumber: book.volume_number,
		seriesAbbreviation: seriesLive?.abbreviation?.trim() || null
	};
}

const ADD_SEARCH_COLUMNS =
	'id, title, series_id, volume_number, series ( id, abbreviation, deleted_at )';

/** Title, citation abbreviation, or series name/abbreviation. Volumes of one work come back together. */
export async function searchBooksToAdd(
	supabase: SupabaseClient,
	needle: string
): Promise<VolumeSearchGroup[]> {
	const like = `%${needle}%`;
	const [titleRes, citeRes, seriesAbbrRes, seriesNameRes] = await Promise.all([
		supabase.from('books').select(ADD_SEARCH_COLUMNS).ilike('title', like).is('deleted_at', null).limit(24),
		supabase
			.from('books')
			.select(ADD_SEARCH_COLUMNS)
			.ilike('citation_abbreviation', like)
			.is('deleted_at', null)
			.limit(12),
		supabase.from('series').select('id').ilike('abbreviation', like).is('deleted_at', null).limit(8),
		supabase.from('series').select('id').ilike('name', like).is('deleted_at', null).limit(8)
	]);
	for (const res of [titleRes, citeRes, seriesAbbrRes, seriesNameRes]) {
		if (res.error) console.error('[studies] set add search', res.error);
	}
	const seriesIds = [
		...new Set(
			[...(seriesAbbrRes.data ?? []), ...(seriesNameRes.data ?? [])].map((row) => (row as { id: string }).id)
		)
	];
	const seriesRes =
		seriesIds.length > 0
			? await supabase
					.from('books')
					.select(ADD_SEARCH_COLUMNS)
					.in('series_id', seriesIds)
					.is('deleted_at', null)
					.limit(80)
			: { data: [] as AddSearchBook[], error: null };
	if (seriesRes.error) console.error('[studies] set add search series books', seriesRes.error);

	const seeds = [...(titleRes.data ?? []), ...(citeRes.data ?? []), ...(seriesRes.data ?? [])] as AddSearchBook[];
	const seedRows = seeds.flatMap((book) => {
		const row = addSearchRow(book);
		return row ? [row] : [];
	});
	const siblingSeries = [...new Set(seedRows.flatMap((row) => (row.seriesId ? [row.seriesId] : [])))];
	const siblingTitles = [...new Set(seedRows.map((row) => row.title))];
	let siblings: AddSearchBook[] = [];
	if (siblingSeries.length > 0 && siblingTitles.length > 0) {
		const siblingRes = await supabase
			.from('books')
			.select(ADD_SEARCH_COLUMNS)
			.in('series_id', siblingSeries)
			.in('title', siblingTitles)
			.is('deleted_at', null)
			.limit(80);
		if (siblingRes.error) console.error('[studies] set add search siblings', siblingRes.error);
		siblings = (siblingRes.data ?? []) as AddSearchBook[];
	}
	const rows = [...seedRows, ...siblings.flatMap((book) => {
		const row = addSearchRow(book);
		return row ? [row] : [];
	})];
	return groupVolumeSearchHits(rows).slice(0, 8);
}

export type { CatalogRef };
