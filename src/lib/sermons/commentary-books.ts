/**
 * Bible books whose commentary shelves appear on a sermon.
 * Passage books come from the server. Extra books on a topical sermon
 * stay in localStorage so a refresh keeps the shelves you added.
 */
import { BIBLE_BOOK_NAMES } from '$lib/library/bible-book-names';

const CANON = new Set<string>(BIBLE_BOOK_NAMES);

/** Canon names only, first occurrence wins. */
export function uniqueBibleBooks(books: readonly string[]): string[] {
	const out: string[] = [];
	for (const book of books) {
		const name = book.trim();
		if (!CANON.has(name) || out.includes(name)) continue;
		out.push(name);
	}
	return out;
}

export function commentaryBooksStorageKey(sermonId: string): string {
	return `ppp.studies.sermonCommentaryBooks.${sermonId}`;
}

export function parseCommentaryBooks(raw: string | null | undefined): string[] {
	if (raw == null || raw.trim().length === 0) return [];
	try {
		const arr = JSON.parse(raw) as unknown;
		if (!Array.isArray(arr)) return [];
		return uniqueBibleBooks(arr.filter((book): book is string => typeof book === 'string'));
	} catch {
		return [];
	}
}

export function loadCommentaryBooks(
	sermonId: string,
	storage: Pick<Storage, 'getItem'> = localStorage
): string[] {
	return parseCommentaryBooks(storage.getItem(commentaryBooksStorageKey(sermonId)));
}

export function saveCommentaryBooks(
	sermonId: string,
	books: readonly string[],
	storage: Pick<Storage, 'setItem'> = localStorage
): void {
	storage.setItem(commentaryBooksStorageKey(sermonId), JSON.stringify(uniqueBibleBooks(books)));
}
