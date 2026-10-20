import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	loadScriptureIndexCounts,
	loadScriptureIndexRows,
	locateScriptureRef
} from '$lib/library/server/scripture-index-loaders';
import { loadSetVolumeBooks } from '$lib/library/server/systematics-loaders';
import { aggregateScriptureCounts } from '$lib/library/scripture-index';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Paginated / filtered scripture index rows for book detail dialog + deep links.
 *
 * Query:
 *   scope=volume|set (default volume)
 *   bible_book=Genesis
 *   chapter=1
 *   whole_book=1 — refs with null chapter_start only
 *   locate=<ref uuid> — returns { locate, rows? } for #ref- deep links
 *   counts=1 — return tallies only (optional bible_book for chapter chips)
 *   limit / offset
 */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const bookId = params.id?.trim() ?? '';
	if (!UUID_RE.test(bookId)) error(400, 'Invalid book.');

	const supabase = locals.supabase;

	const { data: book, error: bookErr } = await supabase
		.from('books')
		.select('id, series_id, volume_number')
		.eq('id', bookId)
		.is('deleted_at', null)
		.maybeSingle();
	if (bookErr || !book) error(404, 'Book not found.');

	const scope = (url.searchParams.get('scope') ?? 'volume').trim().toLowerCase();
	let bookIds = [bookId];
	const volumeByBookId = new Map<string, string | null>([
		[bookId, (book.volume_number as string | null) ?? null]
	]);

	if (scope === 'set' && book.series_id) {
		const volumes = await loadSetVolumeBooks(supabase, book.series_id as string);
		if (volumes.length > 0) {
			bookIds = volumes.map((v) => v.bookId);
			for (const v of volumes) volumeByBookId.set(v.bookId, v.volumeNumber);
		}
	}

	const locateId = url.searchParams.get('locate')?.trim() ?? '';
	if (locateId) {
		if (!UUID_RE.test(locateId)) error(400, 'Invalid locate id.');
		const located = await locateScriptureRef(supabase, locateId);
		if (!located) error(404, 'Reference not found.');
		if (!bookIds.includes(located.book_id) && located.book_id !== bookId) {
			// Ref lives on a sibling volume — still return it so the dialog can open.
			bookIds = [...new Set([...bookIds, located.book_id])];
		}
		const wholeBookOnly = located.chapter_start == null;
		const { rows } = await loadScriptureIndexRows(supabase, {
			bookIds: scope === 'set' ? bookIds : [located.book_id],
			bibleBook: located.bible_book,
			chapter: located.chapter_start,
			wholeBookOnly,
			withOutline: true,
			volumeByBookId,
			limit: 200,
			offset: 0
		});
		return json({ locate: located, rows });
	}

	if (url.searchParams.get('counts') === '1') {
		const counts = await loadScriptureIndexCounts(supabase, bookIds);
		const tallies = aggregateScriptureCounts(counts, new Set(bookIds));
		const bibleBook = url.searchParams.get('bible_book')?.trim() || null;
		const bookTally = bibleBook
			? (tallies.books.find((b) => b.bible_book === bibleBook) ?? null)
			: null;
		return json({ tallies, bookTally, counts });
	}

	const bibleBook = url.searchParams.get('bible_book')?.trim() || null;
	const inlineAll = url.searchParams.get('inline') === '1';

	const chapterRaw = url.searchParams.get('chapter')?.trim() ?? '';
	const chapter =
		chapterRaw === '' ? null : Number.isInteger(Number(chapterRaw)) ? Number(chapterRaw) : null;
	const wholeBookOnly = !inlineAll && url.searchParams.get('whole_book') === '1';

	const limitRaw = Number(url.searchParams.get('limit') ?? (inlineAll ? '200' : '200'));
	const offsetRaw = Number(url.searchParams.get('offset') ?? '0');
	const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 500) : 200;
	const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0;

	if (!bibleBook && !inlineAll) error(400, 'bible_book is required (or inline=1).');

	const result = await loadScriptureIndexRows(supabase, {
		bookIds,
		bibleBook,
		chapter: inlineAll || wholeBookOnly ? null : chapter,
		wholeBookOnly,
		withOutline: true,
		volumeByBookId,
		limit,
		offset
	});

	return json(result);
};
