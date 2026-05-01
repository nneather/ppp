/**
 * Open Library ISBN JSON → new-book form prefill (Session 6 + follow-up enrich).
 *
 * Flow: edition (`/isbn/{isbn}.json`) → optional work (`{workKey}.json`) for title
 * with articles + subjects → parallel author fetches (`{authorKey}.json`, cap 5).
 * https://openlibrary.org — public, no API key.
 */

import type { Genre } from '$lib/types/library';

export const LIBRARY_OL_PREFILL_KEY = 'library_ol_prefill_v1';

export type OpenLibraryBookPrefill = {
	isbn: string;
	title: string | null;
	subtitle: string | null;
	publisher: string | null;
	/** First `publish_places` entries from edition, when present. */
	publisher_location: string | null;
	/** Combined `edition_name` / `physical_format` from edition. */
	edition: string | null;
	year: number | null;
	page_count: number | null;
	/** Free-text author line for user verification (not a linked person). */
	authorTyped: string | null;
	/** Conservative OL `subjects` → closed enum; null when no confident match. */
	genreSuggested: Genre | null;
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

/** `GET https://openlibrary.org{key}.json` — key like `/works/OL1W` or `/authors/OL1A`. */
async function fetchOlKey(key: string): Promise<Record<string, unknown> | null> {
	const k = key.startsWith('/') ? key : `/${key}`;
	const url = `https://openlibrary.org${k}.json`;
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		return (await res.json()) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function firstWorkKey(edition: Record<string, unknown>): string | null {
	const works = edition.works;
	if (!Array.isArray(works) || works.length === 0) return null;
	const w0 = works[0];
	if (!w0 || typeof w0 !== 'object') return null;
	const key = (w0 as { key?: unknown }).key;
	return typeof key === 'string' && key.startsWith('/') ? key : null;
}

function collectAuthorKeys(...sources: (Record<string, unknown> | null)[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const src of sources) {
		if (!src) continue;
		const authors = src.authors;
		if (!Array.isArray(authors)) continue;
		for (const a of authors) {
			if (!a || typeof a !== 'object') continue;
			const key = (a as { key?: unknown }).key;
			if (typeof key !== 'string' || !key.startsWith('/authors/')) continue;
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(key);
			if (out.length >= 5) return out;
		}
	}
	return out;
}

async function resolveAuthorNames(keys: string[]): Promise<string[]> {
	const results = await Promise.all(
		keys.map(async (key) => {
			const doc = await fetchOlKey(key);
			if (!doc) return null;
			return asStr(doc.name) ?? asStr(doc.personal_name);
		})
	);
	return results.filter((n): n is string => n != null && n.length > 0);
}

function authorLineFromEditionInline(data: Record<string, unknown>): string | null {
	const by = asStr(data.by_statement);
	if (by) return by;
	const authors = data.authors;
	if (!Array.isArray(authors) || authors.length === 0) return null;
	const names: string[] = [];
	for (const a of authors) {
		if (a && typeof a === 'object' && 'name' in a) {
			const n = asStr((a as { name?: unknown }).name);
			if (n) names.push(n);
		}
	}
	return names.length > 0 ? names.join('; ') : null;
}

function publisherLocationFromEdition(edition: Record<string, unknown>): string | null {
	const places = edition.publish_places;
	if (!Array.isArray(places) || places.length === 0) return null;
	const strs: string[] = [];
	for (const p of places) {
		const s = asStr(p);
		if (s) strs.push(s);
		if (strs.length >= 2) break;
	}
	if (strs.length === 0) return null;
	if (strs.length === 1) return strs[0]!;
	const joined = strs.join('; ');
	return joined.length <= 80 ? joined : strs[0]!;
}

function editionLineFromEdition(edition: Record<string, unknown>): string | null {
	const parts: string[] = [];
	const en = asStr(edition.edition_name);
	const pf = asStr(edition.physical_format);
	const rev = edition.revision;
	const revStr = typeof rev === 'string' ? rev.trim() : '';
	if (en) parts.push(en);
	if (pf) parts.push(pf);
	if (revStr) parts.push(revStr);
	return parts.length > 0 ? parts.join(' — ') : null;
}

function normalizeSubjectEntries(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const out: string[] = [];
	for (const item of raw) {
		if (typeof item === 'string') {
			const t = item.trim();
			if (t) out.push(t);
		} else if (item && typeof item === 'object' && 'name' in item) {
			const n = asStr((item as { name?: unknown }).name);
			if (n) out.push(n);
		}
	}
	return out;
}

/**
 * Map OL subject strings to a single closed Genre when one pattern clearly wins.
 * Order matters: more specific genres are tested first.
 */
function suggestGenreFromSubjects(subjects: string[]): Genre | null {
	if (subjects.length === 0) return null;
	const blob = subjects.join(' ').toLowerCase();

	type Rule = { genre: Genre; re: RegExp };
	const rules: Rule[] = [
		{ genre: 'Commentary', re: /\bcommentar(y|ies)\b|\bbible commentary\b|\bexpositor(y|ies)\b/i },
		{ genre: 'Biblical Reference', re: /\b(biblical )?reference\b|\blexicon\b|\bconcordance\b|\bencyclopedia\b|\bdictionary\b|\bhandbook\b|\bword study\b/i },
		{ genre: 'Hebrew Language Tools', re: /\bhebrew\b.*\b(grammar|syntax|language|textbook|reader)\b|\bbiblical hebrew\b|\bhebrew grammar\b/i },
		{ genre: 'Greek Language Tools', re: /\bgreek\b.*\b(grammar|syntax|language|textbook|reader)\b|\bkoine\b|\bgreek grammar\b|\bnt greek\b/i },
		{ genre: 'Latin Language Tools', re: /\blatin\b.*\b(grammar|reader|language)\b/i },
		{ genre: 'German Language Tools', re: /\bgerman\b.*\b(grammar|reader|language)\b|\bdeutsch\b/i },
		{ genre: 'Chinese Language Tools', re: /\bchinese\b.*\b(grammar|reader|language)\b/i },
		{ genre: 'Bibles', re: /\bholy bible\b|\bscriptures\b(?!\s+criticism)|\bbible study edition\b|\bstudy bible\b/i },
		{ genre: 'Theology', re: /\btheology\b|\bdoctrine\b|\bsystematic\b/i },
		{ genre: 'Church History', re: /\bchurch history\b|\bpatristic\b|\bearly christianity\b|\breformation\b/i },
		{ genre: 'Pastoral', re: /\bpastoral\b|\bpreaching\b|\bhomiletics\b|\bministry\b/i }
	];

	for (const { genre, re } of rules) {
		if (re.test(blob)) return genre;
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
	const edition = (await res.json()) as Record<string, unknown>;

	const workKey = firstWorkKey(edition);
	const work = workKey ? await fetchOlKey(workKey) : null;

	const editionTitle = asStr(edition.title);
	const editionSubtitle = asStr(edition.subtitle);
	const workTitle = work ? asStr(work.title) : null;
	const workSubtitle = work ? asStr(work.subtitle) : null;

	/** Prefer work title so leading articles (e.g. “A Guide …”) survive when edition omits them. */
	const title = workTitle && workTitle.length > 0 ? workTitle : editionTitle;
	const subtitle =
		workSubtitle && workSubtitle.length > 0 ? workSubtitle : editionSubtitle;

	const publisher = firstPublisher(edition.publishers);
	const publisher_location = publisherLocationFromEdition(edition);
	const editionLine = editionLineFromEdition(edition);
	const year = extractYear(edition.publish_date);
	const page_count = asNum(edition.number_of_pages);

	const authorKeys = collectAuthorKeys(edition, work);
	let authorTyped: string | null = null;
	if (authorKeys.length > 0) {
		const names = await resolveAuthorNames(authorKeys);
		authorTyped = names.length > 0 ? names.join('; ') : null;
	}
	if (!authorTyped) {
		authorTyped = authorLineFromEditionInline(edition);
	}

	const subjects = normalizeSubjectEntries(work?.subjects ?? edition.subjects);
	const genreSuggested = suggestGenreFromSubjects(subjects);

	const isbn13 =
		Array.isArray(edition.isbn_13) && typeof edition.isbn_13[0] === 'string'
			? normalizeIsbnDigits(String(edition.isbn_13[0]))
			: null;
	const isbn10 =
		Array.isArray(edition.isbn_10) && typeof edition.isbn_10[0] === 'string'
			? normalizeIsbnDigits(String(edition.isbn_10[0]))
			: null;

	const storedIsbn = isbn13 ?? isbn10 ?? normalized;

	return {
		isbn: storedIsbn,
		title,
		subtitle,
		publisher,
		publisher_location,
		edition: editionLine,
		year,
		page_count,
		authorTyped,
		genreSuggested
	};
}
