import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { uniqueBibleBooks } from '$lib/sermons/commentary-books';
import { loadCommentaryShelves } from '$lib/sermons/server/commentary-shelf';

/** One Bible book's commentary shelf for a topical sermon. */
export const GET: RequestHandler = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const bibleBook = url.searchParams.get('bible_book')?.trim() ?? '';
	const books = uniqueBibleBooks([bibleBook]);
	if (books.length !== 1) error(400, 'bible_book is required');

	const result = await loadCommentaryShelves(locals.supabase, books);
	const shelf = result.shelves[0] ?? { bibleBook: books[0]!, commentaries: [] };
	return json({ shelf, error: result.error });
};
