import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadSystematicsForPassage } from '$lib/library/server/systematics-loaders';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function intOrNull(raw: string | null): number | null {
	if (raw == null || raw.trim() === '') return null;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) ? n : null;
}

/**
 * Pointers for one systematic set, or the whole passage when `full=1`.
 * Book detail and sermon pages use this after a summary card opens.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const bibleBook = url.searchParams.get('bible_book')?.trim() ?? '';
	if (!bibleBook) error(400, 'bible_book is required');

	const seriesId = url.searchParams.get('series_id');
	const bookId = url.searchParams.get('book_id');
	if (seriesId && !UUID_RE.test(seriesId)) error(400, 'Invalid series');
	if (bookId && !UUID_RE.test(bookId)) error(400, 'Invalid book');

	const blocks = await loadSystematicsForPassage(
		locals.supabase,
		{
			bibleBook,
			chapter: intOrNull(url.searchParams.get('chapter')),
			verse: intOrNull(url.searchParams.get('verse')),
			chapterEnd: intOrNull(url.searchParams.get('chapter_end')),
			verseEnd: intOrNull(url.searchParams.get('verse_end'))
		},
		{
			full: url.searchParams.get('full') === '1' || Boolean(seriesId || bookId),
			seriesId,
			bookId
		}
	);
	return json({ blocks });
};
