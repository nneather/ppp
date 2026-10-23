/**
 * Commentary shelf for one or more Bible books — the same collapse, sort,
 * and hit rate as `/studies/by-book`, scoped to those books.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { authorsLabelForBook } from '$lib/library/authors-label';
import { uniqueBibleBooks } from '$lib/sermons/commentary-books';
import { collapseCommentaryHits, sortShelfHits } from '$lib/sermons/by-book';
import { hitRateKey } from '$lib/studies/hit-rate';
import {
	hitRatesForCoverage,
	loadAcquiredOn,
	loadCanonStudyFacts
} from '$lib/studies/server/hit-rate-loaders';
import type { PersonRow } from '$lib/types/library';
import type { ByBookShelfHit, SermonCommentaryShelf } from '$lib/types/sermons';

type SeriesEmbed = {
	id: string;
	name: string;
	abbreviation: string | null;
	deleted_at: string | null;
};

type BookEmbed = {
	id: string;
	title: string | null;
	genre: string | null;
	rating: number | null;
	shelf_dismissed: boolean;
	deleted_at: string | null;
	series_id: string | null;
	series: SeriesEmbed | SeriesEmbed[] | null;
};

type EssayEmbed = {
	id: string;
	essay_title: string;
	deleted_at: string | null;
	parent_book_id: string;
	shelf_dismissed: boolean;
	books: BookEmbed | BookEmbed[] | null;
};

type CoverageRow = {
	bible_book: string;
	book_id: string | null;
	essay_id: string | null;
	books: BookEmbed | BookEmbed[] | null;
	essays: EssayEmbed | EssayEmbed[] | null;
};

type AuthorRow = { book_id: string; person_id: string; sort_order: number; role: string };
type EssayAuthorRow = { essay_id: string; person_id: string; sort_order: number; role: string };
type PersonDb = {
	id: string;
	first_name: string | null;
	middle_name: string | null;
	last_name: string;
	suffix: string | null;
	aliases: string[] | null;
};

function oneEmbed<T>(v: T | T[] | null | undefined): T | null {
	if (v == null) return null;
	return Array.isArray(v) ? (v[0] ?? null) : v;
}

function personFromDb(p: PersonDb): PersonRow {
	return {
		id: p.id,
		first_name: p.first_name,
		middle_name: p.middle_name,
		last_name: p.last_name,
		suffix: p.suffix,
		aliases: Array.isArray(p.aliases) ? p.aliases : []
	};
}

function authorKey(rows: { person_id: string; role: string }[]): string {
	return [
		...new Set(
			rows
				.filter((row) => row.role === 'author' || row.role === 'editor')
				.map((row) => row.person_id)
		)
	]
		.sort()
		.join('|');
}

function seriesLabelFromEmbed(
	seriesId: string | null,
	seriesEmbed: SeriesEmbed | SeriesEmbed[] | null
): { seriesId: string | null; seriesLabel: string | null } {
	if (!seriesId) return { seriesId: null, seriesLabel: null };
	const series = oneEmbed(seriesEmbed);
	if (!series || series.deleted_at) return { seriesId: null, seriesLabel: null };
	const abbr = series.abbreviation?.trim() || null;
	const name = series.name?.trim() || null;
	return { seriesId: series.id, seriesLabel: abbr || name };
}

function essayAuthorShort(
	essayId: string,
	essayAuthors: EssayAuthorRow[],
	people: Map<string, PersonRow>
): string | null {
	const rows = essayAuthors
		.filter((row) => row.essay_id === essayId)
		.sort((a, b) => a.sort_order - b.sort_order);
	if (rows.length === 0) return null;
	return authorsLabelForBook(rows, people);
}

export async function loadCommentaryShelves(
	supabase: SupabaseClient,
	bibleBooks: readonly string[]
): Promise<{ shelves: SermonCommentaryShelf[]; error: string | null }> {
	const books = uniqueBibleBooks(bibleBooks);
	if (books.length === 0) return { shelves: [], error: null };

	const factsPromise = loadCanonStudyFacts(supabase);
	const { data, error } = await supabase.from('book_bible_coverage').select(
		`
			bible_book,
			book_id,
			essay_id,
			books (
				id, title, genre, rating, shelf_dismissed, deleted_at, series_id,
				series ( id, name, abbreviation, deleted_at )
			),
			essays (
				id, essay_title, deleted_at, parent_book_id, shelf_dismissed,
				books!essays_parent_book_id_fkey (
					id, title, genre, rating, deleted_at, series_id,
					series ( id, name, abbreviation, deleted_at )
				)
			)
		`
	).in('bible_book', books);

	if (error) {
		console.error('[sermons] commentary shelf', error);
		return { shelves: [], error: error.message };
	}

	const rows = (data ?? []) as unknown as CoverageRow[];
	const bookIds = new Set<string>();
	const essayIds = new Set<string>();
	for (const row of rows) {
		if (!books.includes(row.bible_book)) continue;
		const book = oneEmbed(row.books);
		if (book && !book.deleted_at && book.genre === 'Commentary' && row.book_id && !row.essay_id) {
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
					.select('book_id, person_id, sort_order, role')
					.in('book_id', [...bookIds])
			: Promise.resolve({ data: [] as AuthorRow[], error: null }),
		essayIds.size
			? supabase
					.from('essay_authors')
					.select('essay_id, person_id, sort_order, role')
					.in('essay_id', [...essayIds])
			: Promise.resolve({ data: [] as EssayAuthorRow[], error: null })
	]);
	if (authorsRes.error) console.error('[sermons] commentary book_authors', authorsRes.error);
	if (essayAuthorsRes.error) console.error('[sermons] commentary essay_authors', essayAuthorsRes.error);

	const authorsByBook = new Map<string, AuthorRow[]>();
	for (const row of (authorsRes.data ?? []) as AuthorRow[]) {
		const list = authorsByBook.get(row.book_id) ?? [];
		list.push(row);
		authorsByBook.set(row.book_id, list);
	}
	const authorsByEssay = new Map<string, EssayAuthorRow[]>();
	for (const row of (essayAuthorsRes.data ?? []) as EssayAuthorRow[]) {
		const list = authorsByEssay.get(row.essay_id) ?? [];
		list.push(row);
		authorsByEssay.set(row.essay_id, list);
	}

	const personIds = [
		...new Set([
			...(authorsRes.data ?? []).map((row) => (row as AuthorRow).person_id),
			...(essayAuthorsRes.data ?? []).map((row) => (row as EssayAuthorRow).person_id)
		])
	];
	const peopleRes = personIds.length
		? await supabase
				.from('people')
				.select('id, first_name, middle_name, last_name, suffix, aliases')
				.in('id', personIds)
				.is('deleted_at', null)
		: { data: [] as PersonDb[], error: null };
	if (peopleRes.error) console.error('[sermons] commentary people', peopleRes.error);

	const people = new Map<string, PersonRow>();
	for (const row of (peopleRes.data ?? []) as PersonDb[]) people.set(row.id, personFromDb(row));

	const hitsByBook = new Map<string, ByBookShelfHit[]>();
	for (const row of rows) {
		if (!books.includes(row.bible_book)) continue;
		const essay = oneEmbed(row.essays);
		const parent = essay ? oneEmbed(essay.books) : null;
		if (essay && !essay.deleted_at && parent && !parent.deleted_at && parent.genre === 'Commentary') {
			const { seriesId, seriesLabel } = seriesLabelFromEmbed(parent.series_id, parent.series);
			const hit: ByBookShelfHit = {
				kind: 'essay',
				bookId: parent.id,
				essayId: essay.id,
				title: essay.essay_title,
				authorShort: essayAuthorShort(essay.id, authorsByEssay.get(essay.id) ?? [], people),
				seriesLabel,
				seriesId,
				authorKey: authorKey(authorsByEssay.get(essay.id) ?? []) || null,
				rating: parent.rating,
				genre: parent.genre,
				href: `/library/books/${parent.id}#essay-${essay.id}`,
				shelfDismissed: essay.shelf_dismissed,
				memberBookIds: [parent.id],
				memberEssayIds: [essay.id]
			};
			const list = hitsByBook.get(row.bible_book) ?? [];
			list.push(hit);
			hitsByBook.set(row.bible_book, list);
			continue;
		}

		const book = oneEmbed(row.books);
		if (!book || book.deleted_at || book.genre !== 'Commentary' || !row.book_id || row.essay_id) continue;
		const junctions = authorsByBook.get(book.id) ?? [];
		const { seriesId, seriesLabel } = seriesLabelFromEmbed(book.series_id, book.series);
		const hit: ByBookShelfHit = {
			kind: 'book',
			bookId: book.id,
			essayId: null,
			title: (book.title ?? '').trim() || 'Untitled',
			authorShort: authorsLabelForBook(junctions, people),
			seriesLabel,
			seriesId,
			authorKey: authorKey(junctions) || null,
			rating: book.rating,
			genre: book.genre,
			href: `/library/books/${book.id}`,
			shelfDismissed: book.shelf_dismissed,
			memberBookIds: [book.id],
			memberEssayIds: []
		};
		const list = hitsByBook.get(row.bible_book) ?? [];
		list.push(hit);
		hitsByBook.set(row.bible_book, list);
	}

	const shelves: SermonCommentaryShelf[] = books.map((bibleBook) => ({
		bibleBook,
		commentaries: sortShelfHits(collapseCommentaryHits(hitsByBook.get(bibleBook) ?? []))
	}));

	const coveragePairs = shelves.flatMap((shelf) =>
		shelf.commentaries.map((hit) => ({ bookId: hit.bookId, bibleBook: shelf.bibleBook }))
	);
	const [acquired, facts] = await Promise.all([
		loadAcquiredOn(supabase, [...new Set(coveragePairs.map((pair) => pair.bookId))]),
		factsPromise
	]);
	const rateByKey = new Map(
		hitRatesForCoverage(facts.studies, coveragePairs, acquired).map((rate) => [
			hitRateKey(rate.bookId, rate.bibleBook),
			rate
		])
	);
	for (const shelf of shelves) {
		shelf.commentaries = shelf.commentaries.map((hit) => ({
			...hit,
			hitRate: rateByKey.get(hitRateKey(hit.bookId, shelf.bibleBook)) ?? null
		}));
	}

	return { shelves, error: facts.error };
}
