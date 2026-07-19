/**
 * Pure Goodreads export helpers (ISBN cells, title/author keys, rating match).
 * CSV matrix parsing lives in `server/goodreads-import.ts` (reuses books-csv delimiter parser).
 */

import { isbnMatchKeys, normalizeIsbnDigits } from '$lib/library/isbn';
import { normalizePersonName } from '$lib/library/match';
import { stripArticlesForImporterMatchKey } from '$lib/library/title-sort';

export type GoodreadsExportRow = {
	line: number;
	title: string;
	author: string;
	/** Goodreads "Author l-f" when present (Last, First). */
	authorLf: string;
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
	subtitle: string | null;
	isbn: string | null;
	/** Denormalized authors label from `books.author_display`. */
	author_display: string | null;
	rating: number | null;
	personal_notes: string | null;
};

export type GoodreadsMatchVia = 'isbn' | 'title_author';

export type GoodreadsMatchKind = 'apply' | 'skip_existing' | 'unmatched' | 'unrated';

export type GoodreadsMatchRow = {
	kind: GoodreadsMatchKind;
	gr: GoodreadsExportRow;
	bookId?: string;
	bookTitle?: string | null;
	/** How the library row was resolved (apply / skip_existing only). */
	matchedVia?: GoodreadsMatchVia;
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
	matchedViaIsbn: number;
	matchedViaTitleAuthor: number;
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
 * Title key for cross-library matching: lowercased, diacritics stripped,
 * parenthetical series markers removed, punctuation collapsed, leading articles stripped.
 */
export function normalizeGoodreadsTitleKey(title: string): string {
	let s = title.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
	s = s.replace(/\s*[\(\[][^)\]]*[\)\]]\s*/g, ' ');
	s = s.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
	return stripArticlesForImporterMatchKey(s);
}

/** Same as {@link normalizeGoodreadsTitleKey} but only the text before the first `:`. */
export function normalizeGoodreadsTitleKeyNoSubtitle(title: string): string {
	const head = title.split(':')[0] ?? title;
	return normalizeGoodreadsTitleKey(head);
}

/** Strip Jr./Sr./II/III/(ed) noise before last-name keying. */
function stripAuthorKeyNoise(raw: string): string {
	return raw
		.replace(/\([^)]*\)/g, ' ')
		// Do not use `\b` after optional `.` — it lets `jr\.?` match "Jr" and leave a stray "."
		.replace(/(?:^|[\s,])(jr|sr)\.?(?=[\s,]|$)/gi, ' ')
		.replace(/\b(ii|iii|iv)\b/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Last-name key tokens from a display name (no comma list).
 * - `van`/`von`/`de`… particles stay with the surname (`Van Opstal` → `van opstal`)
 * - bare `of` is a place marker (`Augustine of Hippo` → `augustine`, not `hippo`)
 * - multi-token / hyphenated surnames also emit segments (`Polich-Short` → `polich short` + `polich` + `short`)
 */
function lastNameKeysFromDisplayName(name: string): string[] {
	const cleaned = stripAuthorKeyNoise(name);
	if (!cleaned) return [];
	const parts = cleaned.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
	if (parts.length === 0) return [];

	const particle = parts.length >= 2 ? (parts[parts.length - 2] ?? '') : '';
	let primary: string;
	if (/^(von|van|de|da|di|du|la|le)$/i.test(particle)) {
		primary = normalizePersonName(parts.slice(-2).join(' '));
	} else if (/^of$/i.test(particle) && parts.length >= 3) {
		// "Augustine of Hippo" / "Francis of Assisi" → personal name before `of`
		primary = normalizePersonName(parts[parts.length - 3] ?? parts[0] ?? '');
	} else {
		primary = normalizePersonName(parts[parts.length - 1] ?? cleaned);
	}

	const keys = new Set<string>();
	if (primary) keys.add(primary);
	// Hyphen/space compound surnames: also match on each segment
	for (const seg of primary.split(/\s+/).filter(Boolean)) {
		keys.add(seg);
	}
	return [...keys];
}

/** Last-name key from Goodreads Author / Author l-f. */
export function goodreadsAuthorLastKey(author: string, authorLf: string): string {
	const lf = authorLf.trim();
	if (lf.includes(',')) {
		const keys = lastNameKeysFromDisplayName(lf.split(',')[0] ?? lf);
		return keys[0] ?? '';
	}
	const a = author.trim();
	if (a.includes(',')) {
		const keys = lastNameKeysFromDisplayName(a.split(',')[0] ?? a);
		return keys[0] ?? '';
	}
	const keys = lastNameKeysFromDisplayName(a);
	return keys[0] ?? '';
}

/** Last-name keys from `author_display` ("First Last, First Last"). */
export function authorDisplayLastKeys(authorDisplay: string | null | undefined): string[] {
	if (!authorDisplay?.trim()) return [];
	const people = authorDisplay.split(',').map((s) => s.trim()).filter(Boolean);
	const keys: string[] = [];
	for (const p of people) {
		keys.push(...lastNameKeysFromDisplayName(p));
	}
	return [...new Set(keys)];
}

function titleKeysForBook(book: GoodreadsBookCandidate): string[] {
	const title = book.title?.trim() ?? '';
	if (!title) return [];
	const full =
		book.subtitle?.trim() && book.subtitle.trim().length > 0
			? `${title}: ${book.subtitle.trim()}`
			: title;
	return [
		...new Set(
			[
				normalizeGoodreadsTitleKey(title),
				normalizeGoodreadsTitleKey(full),
				normalizeGoodreadsTitleKeyNoSubtitle(title)
			].filter((k) => k.length > 0)
		)
	];
}

function titleKeysForGr(gr: GoodreadsExportRow): string[] {
	const t = gr.title.trim();
	if (!t) return [];
	return [
		...new Set(
			[normalizeGoodreadsTitleKey(t), normalizeGoodreadsTitleKeyNoSubtitle(t)].filter(
				(k) => k.length > 0
			)
		)
	];
}

function resolveBook(
	gr: GoodreadsExportRow,
	byIsbn: Map<string, GoodreadsBookCandidate>,
	byTitleAuthor: Map<string, GoodreadsBookCandidate[]>
): { book: GoodreadsBookCandidate; via: GoodreadsMatchVia } | null {
	if (gr.isbn) {
		for (const k of isbnMatchKeys(gr.isbn)) {
			const book = byIsbn.get(k);
			if (book) return { book, via: 'isbn' };
		}
	}

	const authorKey = goodreadsAuthorLastKey(gr.author, gr.authorLf);
	if (!authorKey) return null;

	const candidates = new Set<GoodreadsBookCandidate>();
	for (const tk of titleKeysForGr(gr)) {
		const list = byTitleAuthor.get(`${tk}|${authorKey}`) ?? [];
		for (const b of list) candidates.add(b);
	}
	if (candidates.size === 1) {
		return { book: [...candidates][0]!, via: 'title_author' };
	}
	return null;
}

/**
 * Match rated Goodreads rows to library books.
 * 1. ISBN (10/13 twins)
 * 2. Unique title + author last-name (edition mismatches / missing ISBN)
 *
 * Title-only matches are intentionally skipped (commentary collisions).
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
	const byTitleAuthor = new Map<string, GoodreadsBookCandidate[]>();

	for (const book of args.books) {
		if (book.isbn) {
			const normalized = normalizeIsbnDigits(book.isbn);
			if (normalized) {
				for (const key of isbnMatchKeys(normalized)) {
					if (!byIsbn.has(key)) byIsbn.set(key, book);
				}
			}
		}
		const authors = authorDisplayLastKeys(book.author_display);
		if (authors.length === 0) continue;
		for (const tk of titleKeysForBook(book)) {
			for (const ak of authors) {
				const compound = `${tk}|${ak}`;
				const list = byTitleAuthor.get(compound);
				if (list) list.push(book);
				else byTitleAuthor.set(compound, [book]);
			}
		}
	}

	const apply: GoodreadsMatchRow[] = [];
	const skipExisting: GoodreadsMatchRow[] = [];
	const unmatched: GoodreadsMatchRow[] = [];
	let unrated = 0;
	let matchedViaIsbn = 0;
	let matchedViaTitleAuthor = 0;

	for (const gr of args.grRows) {
		if (gr.myRating == null) {
			unrated += 1;
			continue;
		}

		const resolved = resolveBook(gr, byIsbn, byTitleAuthor);
		if (!resolved) {
			unmatched.push({ kind: 'unmatched', gr });
			continue;
		}

		const { book, via } = resolved;
		if (via === 'isbn') matchedViaIsbn += 1;
		else matchedViaTitleAuthor += 1;

		if (book.rating != null && !overwrite) {
			skipExisting.push({
				kind: 'skip_existing',
				gr,
				bookId: book.id,
				bookTitle: book.title,
				matchedVia: via
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
			matchedVia: via,
			rating: gr.myRating,
			notesToSet
		});
	}

	return {
		apply,
		skipExisting,
		unmatched,
		unrated,
		matchedViaIsbn,
		matchedViaTitleAuthor
	};
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
