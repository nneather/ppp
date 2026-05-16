/**
 * Open Library ISBN JSON → new-book form prefill (Session 6 + follow-up enrich).
 *
 * Flow: edition (`/isbn/{isbn}.json`) → optional work (`{workKey}.json`) for title
 * with articles + subjects → parallel author fetches (`{authorKey}.json`, cap 5).
 * https://openlibrary.org — public, no API key.
 */

import type { Genre, Language } from '$lib/types/library';
import { normalizeIsbnDigits, parseIsbnWithChecksum } from '$lib/library/isbn';
import { splitAuthorString } from '$lib/library/match';

export { normalizeIsbnDigits } from '$lib/library/isbn';

export const LIBRARY_OL_PREFILL_KEY = 'library_ol_prefill_v2';

export type OpenLibraryAuthorPrefill = {
	name: string;
};

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
	/** Structured author names in display order (from OL author keys or edition line). */
	authors: OpenLibraryAuthorPrefill[];
	/** Free-text author line for scan summary / backward compat (joined with "; "). */
	authorTyped: string | null;
	/** Conservative OL `subjects` → closed enum; null when no confident match. */
	genreSuggested: Genre | null;
	/** Best-effort series title from edition/work `series` or subtitle heuristic. */
	seriesName: string | null;
	/** Volume / number segment when parseable from the series string. */
	seriesVolume: string | null;
	/** First edition `languages[].key` mapped to app `books.language` enum, or null. */
	languageCode: Language | null;
};

function asStr(v: unknown): string | null {
	return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function asNum(v: unknown): number | null {
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number.parseInt(v.trim(), 10);
	return null;
}

function extractYear(publishDate: unknown): number | null {
	const s = asStr(publishDate);
	if (!s) return null;
	const m = s.match(/^(\d{4})/);
	return m ? Number.parseInt(m[1]!, 10) : null;
}

const GENERIC_PUBLISHER_SUFFIX =
	/\b(publishing\s+group|publishing\s+house|publishers?|publishing|group|holdings?|inc\.?|llc|co\.?|ltd\.?|company|division|imprint|books?)\b/gi;

function publisherRoot(s: string): string {
	return s
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(GENERIC_PUBLISHER_SUFFIX, ' ')
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Drop generic parent imprint when a more specific sibling is present (e.g. B&H Academic vs B&H Publishing Group). */
function dedupePublisherImprints(raw: string[]): string[] {
	if (raw.length <= 1) return raw;
	const items = raw
		.map((r) => ({ raw: r, root: publisherRoot(r) }))
		.filter((x) => x.root.length > 0);
	if (items.length <= 1) return items.map((x) => x.raw);

	items.sort((a, b) => b.root.length - a.root.length || b.raw.length - a.raw.length);
	const kept: { raw: string; root: string }[] = [];
	for (const e of items) {
		const dominatedByKept = kept.some(
			(k) => k.root === e.root || k.root.startsWith(e.root + ' ')
		);
		if (dominatedByKept) continue;
		for (let i = kept.length - 1; i >= 0; i--) {
			const k = kept[i]!;
			if (e.root.startsWith(k.root + ' ') || (e.root.length > k.root.length && e.root.startsWith(k.root))) {
				kept.splice(i, 1);
			}
		}
		kept.push(e);
	}
	const set = new Set(kept.map((x) => x.raw));
	return raw.filter((r) => set.has(r));
}

function publishersFromEdition(edition: Record<string, unknown>): string | null {
	const pub = edition.publishers;
	if (!Array.isArray(pub) || pub.length === 0) return null;
	const strs: string[] = [];
	for (const item of pub) {
		const s = typeof item === 'string' ? asStr(item) : null;
		if (s) strs.push(s);
		if (strs.length >= 8) break;
	}
	if (strs.length === 0) return null;
	const deduped = dedupePublisherImprints(strs);
	return deduped.length > 0 ? deduped.join('; ') : null;
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
	const revStr =
		typeof rev === 'string'
			? rev.trim()
			: typeof rev === 'number' && Number.isFinite(rev)
				? String(rev)
				: '';
	if (en) parts.push(en);
	if (pf) parts.push(pf);
	if (revStr) parts.push(revStr);
	return parts.length > 0 ? parts.join(' — ') : null;
}

function pageCountFromEdition(edition: Record<string, unknown>): number | null {
	const n = asNum(edition.number_of_pages);
	if (n != null) return n;
	const pag = asStr(edition.pagination);
	if (!pag) return null;
	const m = pag.match(/(\d+)\s*$/);
	return m ? Number.parseInt(m[1]!, 10) : null;
}

function firstSeriesString(series: unknown): string | null {
	if (!Array.isArray(series) || series.length === 0) return null;
	const first = series[0];
	if (typeof first === 'string') return asStr(first);
	if (first && typeof first === 'object') {
		const o = first as Record<string, unknown>;
		return asStr(o.name) ?? asStr(o.series) ?? null;
	}
	return null;
}

function splitSeriesNameAndVolume(raw: string): { name: string; volume: string | null } {
	const trimmed = raw.trim();
	if (!trimmed) return { name: '', volume: null };
	const volRe = /[,;:]\s*(?:vol\.?|volume|bd\.?|band|no\.?|nr\.?|#)\s*([\w./-]+)\s*$/i;
	const m = trimmed.match(volRe);
	if (m?.index != null) {
		const name = trimmed.slice(0, m.index).trim().replace(/[,;]\s*$/, '');
		const vol = m[1]?.trim() ?? null;
		return { name: name || trimmed, volume: vol };
	}
	return { name: trimmed, volume: null };
}

function seriesFromOl(
	edition: Record<string, unknown>,
	work: Record<string, unknown> | null,
	editionSubtitle: string | null,
	workSubtitle: string | null
): { seriesName: string | null; seriesVolume: string | null } {
	let raw =
		firstSeriesString(edition.series) ?? (work ? firstSeriesString(work.series) : null);
	if (!raw) {
		const sub = editionSubtitle ?? workSubtitle;
		if (sub) {
			const colon = sub.indexOf(':');
			if (colon > 0 && colon < sub.length - 1) {
				const left = sub.slice(0, colon).trim();
				if (left.length >= 4 && /[a-z]/i.test(left)) raw = left;
			}
		}
	}
	if (!raw) return { seriesName: null, seriesVolume: null };
	const { name, volume } = splitSeriesNameAndVolume(raw);
	return { seriesName: name || null, seriesVolume: volume };
}

const OL_LANG_KEY_TO_APP: Record<string, Language> = {
	eng: 'english',
	en: 'english',
	enm: 'english',
	spa: 'other',
	por: 'other',
	ita: 'other',
	fre: 'french',
	fra: 'french',
	ger: 'german',
	deu: 'german',
	gsw: 'german',
	lat: 'latin',
	grc: 'greek',
	gre: 'greek',
	ell: 'greek',
	heb: 'hebrew',
	he: 'hebrew',
	chi: 'chinese',
	zho: 'chinese',
	cmn: 'chinese'
};

function languageFromEdition(edition: Record<string, unknown>): Language | null {
	const langs = edition.languages;
	if (!Array.isArray(langs) || langs.length === 0) return null;
	const first = langs[0];
	if (!first || typeof first !== 'object') return null;
	const key = (first as { key?: unknown }).key;
	if (typeof key !== 'string' || !key.includes('/')) return null;
	const tail = key.split('/').pop()?.toLowerCase() ?? '';
	const code = tail.replace(/\.json$/, '');
	const mapped = OL_LANG_KEY_TO_APP[code];
	return mapped ?? null;
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
		{
			genre: 'Biblical Reference',
			re: /\b(biblical )?reference\b|\blexicon\b|\bconcordance\b|\bencyclopedia\b|\bdictionary\b|\bhandbook\b|\bword study\b/i
		},
		{
			genre: 'Hebrew Language Tools',
			re: /\bhebrew\b.*\b(grammar|syntax|language|textbook|reader)\b|\bbiblical hebrew\b|\bhebrew grammar\b/i
		},
		{
			genre: 'Greek Language Tools',
			re: /\bgreek\b.*\b(grammar|syntax|language|textbook|reader)\b|\bkoine\b|\bgreek grammar\b|\bnt greek\b/i
		},
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
	const normalized = parseIsbnWithChecksum(isbn);
	if (!normalized) {
		throw new Error(
			'That does not look like a valid ISBN (10 or 13 digits with a correct check digit).'
		);
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

	const publisher = publishersFromEdition(edition);
	const publisher_location = publisherLocationFromEdition(edition);
	const editionLine = editionLineFromEdition(edition);
	const year = extractYear(edition.publish_date);
	const page_count = pageCountFromEdition(edition);

	const authorKeys = collectAuthorKeys(edition, work);
	const authors: OpenLibraryAuthorPrefill[] = [];
	if (authorKeys.length > 0) {
		const names = await resolveAuthorNames(authorKeys);
		for (const n of names) authors.push({ name: n });
	}
	if (authors.length === 0) {
		const line = authorLineFromEditionInline(edition);
		if (line) {
			for (const seg of splitAuthorString(line)) {
				authors.push({ name: seg });
			}
		}
	}
	const authorTyped = authors.length > 0 ? authors.map((a) => a.name).join('; ') : null;

	const subjects = normalizeSubjectEntries(work?.subjects ?? edition.subjects);
	const genreSuggested = suggestGenreFromSubjects(subjects);

	const { seriesName, seriesVolume } = seriesFromOl(
		edition,
		work,
		editionSubtitle,
		workSubtitle
	);
	const languageCode = languageFromEdition(edition);

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
		authors,
		authorTyped,
		genreSuggested,
		seriesName,
		seriesVolume,
		languageCode
	};
}
