/**
 * Pure Goodreads export helpers (ISBN cells, rating match).
 * CSV matrix parsing lives in `server/goodreads-import.ts` (reuses books-csv delimiter parser).
 */

import { isbnMatchKeys, normalizeIsbnDigits } from '$lib/library/isbn';

export type GoodreadsExportRow = {
	line: number;
	title: string;
	author: string;
	/** Normalized ISBN digits (10 or 13), prefer ISBN13 column. */
	isbn: string | null;
	/** 1–5, or null when unrated (Goodreads uses 0). */
	myRating: number | null;
	myReview: string | null;
	privateNotes: string | null;
	exclusiveShelf: string | null;
};

export type GoodreadsBookCandidate = {
	id: string;
	title: string | null;
	isbn: string | null;
	rating: number | null;
	personal_notes: string | null;
};

export type GoodreadsMatchKind = 'apply' | 'skip_existing' | 'unmatched' | 'unrated';

export type GoodreadsMatchRow = {
	kind: GoodreadsMatchKind;
	gr: GoodreadsExportRow;
	bookId?: string;
	bookTitle?: string | null;
	/** Rating that would be written (apply only). */
	rating?: number;
	/** Notes that would be written when filling empty personal_notes. */
	notesToSet?: string | null;
};

export type GoodreadsMatchSummary = {
	apply: GoodreadsMatchRow[];
	skipExisting: GoodreadsMatchRow[];
	unmatched: GoodreadsMatchRow[];
	unrated: number;
};

/** Strip Goodreads `="…"` formula wrapping, then normalize digits. */
export function parseGoodreadsIsbnCell(raw: string): string | null {
	let t = raw.trim();
	if (t.startsWith('="') && t.endsWith('"')) {
		t = t.slice(2, -1);
	} else if (t.startsWith('=') && t.length > 1) {
		t = t.slice(1).replace(/^"|"$/g, '');
	}
	t = t.replace(/^"|"$/g, '').trim();
	if (t.length === 0) return null;
	return normalizeIsbnDigits(t);
}

export function combineGoodreadsNotes(
	myReview: string | null,
	privateNotes: string | null
): string | null {
	const parts = [myReview, privateNotes].filter((p): p is string => p != null && p.length > 0);
	if (parts.length === 0) return null;
	return parts.join('\n\n');
}

/**
 * Match rated Goodreads rows to library books by ISBN (10/13 twins).
 * Default: do not overwrite an existing `books.rating`.
 */
export function matchGoodreadsRatings(args: {
	grRows: GoodreadsExportRow[];
	books: GoodreadsBookCandidate[];
	overwriteExisting?: boolean;
	fillEmptyNotes?: boolean;
}): GoodreadsMatchSummary {
	const overwrite = args.overwriteExisting === true;
	const fillNotes = args.fillEmptyNotes === true;

	const byIsbn = new Map<string, GoodreadsBookCandidate>();
	for (const book of args.books) {
		if (!book.isbn) continue;
		const normalized = normalizeIsbnDigits(book.isbn);
		if (!normalized) continue;
		for (const key of isbnMatchKeys(normalized)) {
			if (!byIsbn.has(key)) byIsbn.set(key, book);
		}
	}

	const apply: GoodreadsMatchRow[] = [];
	const skipExisting: GoodreadsMatchRow[] = [];
	const unmatched: GoodreadsMatchRow[] = [];
	let unrated = 0;

	for (const gr of args.grRows) {
		if (gr.myRating == null) {
			unrated += 1;
			continue;
		}
		if (!gr.isbn) {
			unmatched.push({ kind: 'unmatched', gr });
			continue;
		}
		const keys = isbnMatchKeys(gr.isbn);
		let book: GoodreadsBookCandidate | undefined;
		for (const k of keys) {
			book = byIsbn.get(k);
			if (book) break;
		}
		if (!book) {
			unmatched.push({ kind: 'unmatched', gr });
			continue;
		}
		if (book.rating != null && !overwrite) {
			skipExisting.push({
				kind: 'skip_existing',
				gr,
				bookId: book.id,
				bookTitle: book.title
			});
			continue;
		}
		const notesToSet =
			fillNotes && !book.personal_notes?.trim()
				? combineGoodreadsNotes(gr.myReview, gr.privateNotes)
				: null;
		apply.push({
			kind: 'apply',
			gr,
			bookId: book.id,
			bookTitle: book.title,
			rating: gr.myRating,
			notesToSet
		});
	}

	return { apply, skipExisting, unmatched, unrated };
}

export function headerIndex(headers: string[], ...names: string[]): number {
	const lower = headers.map((h) => h.trim().toLowerCase());
	for (const name of names) {
		const i = lower.indexOf(name.toLowerCase());
		if (i >= 0) return i;
	}
	return -1;
}

export function parseMyRatingCell(raw: string): number | null {
	const t = raw.trim();
	if (t.length === 0) return null;
	const n = Number(t);
	if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
	if (n === 0) return null;
	if (n < 1 || n > 5) return null;
	return n;
}

export function trimOrNullText(s: string): string | null {
	const t = s.trim();
	return t.length > 0 ? t : null;
}
