/**
 * Open Library ISBN JSON → new-book form prefill (Session 6).
 * https://openlibrary.org/isbn/{isbn}.json — public, no API key.
 */

export const LIBRARY_OL_PREFILL_KEY = 'library_ol_prefill_v1';

export type OpenLibraryBookPrefill = {
	isbn: string;
	title: string | null;
	subtitle: string | null;
	publisher: string | null;
	year: number | null;
	page_count: number | null;
	/** Free-text author line for user verification (not a linked person). */
	authorTyped: string | null;
};

function asStr(v: unknown): string | null {
	return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function asNum(v: unknown): number | null {
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number.parseInt(v.trim(), 10);
	return null;
}

/** Strip non-digits; accept ISBN-10 / ISBN-13 / EAN-13 bookland. */
export function normalizeIsbnDigits(raw: string): string | null {
	const d = raw.replace(/[^0-9X]/gi, '').toUpperCase();
	if (d.length === 13) return d;
	if (d.length === 10) return d;
	return null;
}

function extractYear(publishDate: unknown): number | null {
	const s = asStr(publishDate);
	if (!s) return null;
	const m = s.match(/^(\d{4})/);
	return m ? Number.parseInt(m[1]!, 10) : null;
}

function firstPublisher(pub: unknown): string | null {
	if (!Array.isArray(pub) || pub.length === 0) return null;
	const first = pub[0];
	return asStr(first);
}

function authorLineFromJson(data: Record<string, unknown>): string | null {
	const by = asStr(data.by_statement);
	if (by) return by;
	const authors = data.authors;
	if (Array.isArray(authors) && authors.length > 0) {
		const names: string[] = [];
		for (const a of authors) {
			if (a && typeof a === 'object' && 'name' in a) {
				const n = asStr((a as { name?: unknown }).name);
				if (n) names.push(n);
			}
		}
		if (names.length > 0) return names.join('; ');
	}
	return null;
}

export async function fetchOpenLibraryPrefill(isbn: string): Promise<OpenLibraryBookPrefill> {
	const normalized = normalizeIsbnDigits(isbn);
	if (!normalized) {
		throw new Error('That does not look like a valid ISBN (10 or 13 digits).');
	}

	const url = `https://openlibrary.org/isbn/${encodeURIComponent(normalized)}.json`;
	const res = await fetch(url);
	if (res.status === 404) {
		throw new Error('ISBN not found in Open Library.');
	}
	if (!res.ok) {
		throw new Error(`Open Library returned ${res.status}. Try again later.`);
	}
	const data = (await res.json()) as Record<string, unknown>;

	const title = asStr(data.title);
	const subtitle = asStr(data.subtitle);
	const publisher = firstPublisher(data.publishers);
	const year = extractYear(data.publish_date);
	const page_count = asNum(data.number_of_pages);
	const authorTyped = authorLineFromJson(data);

	const isbn13 =
		Array.isArray(data.isbn_13) && typeof data.isbn_13[0] === 'string'
			? normalizeIsbnDigits(String(data.isbn_13[0]))
			: null;
	const isbn10 =
		Array.isArray(data.isbn_10) && typeof data.isbn_10[0] === 'string'
			? normalizeIsbnDigits(String(data.isbn_10[0]))
			: null;

	const storedIsbn = isbn13 ?? isbn10 ?? normalized;

	return {
		isbn: storedIsbn,
		title,
		subtitle,
		publisher,
		year,
		page_count,
		authorTyped
	};
}
