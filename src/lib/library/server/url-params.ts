/**
 * Shared URL-param helpers for library list + review-queue pages.
 *
 * Per `.cursor/rules/library-module.mdc` (Session 3 — URL-param-as-source-of-
 * truth pattern): server `load` parses URL into a typed filter shape; the
 * page renders against `data.filters`; toggles call `pushFilters(next)` which
 * builds a new URL and `goto(target, { keepFocus: true, noScroll: true })`.
 *
 * Originally lived inline at `src/routes/library/+page.server.ts`; lifted here
 * Session 5.5 so `/library/review/+page.server.ts` could reuse the same parser
 * for `?genre=`, `?language=`, `?series_id=`, etc.
 * `parseBookListFilters` + `bookListFiltersToSearchParams` added for list
 * pagination + `/library/books.json`.
 */

import { LANGUAGES, READING_STATUSES } from '$lib/types/library';
import type { BookListFilters, Language, ReadingStatus } from '$lib/types/library';

/**
 * Parse repeated/CSV URL params into a deduped string list. Accepts both
 * `?genre=Commentary&genre=Theology` and `?genre=Commentary,Theology` for
 * deep-link friendliness; the page's `pushFilters` always emits the repeated
 * form on round-trip.
 */
export function multiParam(url: URL, key: string): string[] {
	const all = url.searchParams.getAll(key).flatMap((v) => v.split(','));
	const trimmed = all.map((s) => s.trim()).filter((s) => s.length > 0);
	return Array.from(new Set(trimmed));
}

/** Parse `/library` URL search params into `BookListFilters` (incl. `?all=true`). */
export function parseBookListFilters(url: URL): BookListFilters {
	const filters: BookListFilters = {};

	const genres = multiParam(url, 'genre');
	if (genres.length > 0) filters.genre = genres;

	const series = multiParam(url, 'series_id');
	if (series.length > 0) filters.series_id = series;

	const authors = multiParam(url, 'author_id');
	if (authors.length > 0) filters.author_id = authors;

	const langSet = new Set<Language>(LANGUAGES);
	const langs = multiParam(url, 'language').filter((l): l is Language =>
		langSet.has(l as Language)
	);
	if (langs.length > 0) filters.language = langs;

	const statusSet = new Set<ReadingStatus>(READING_STATUSES);
	const statuses = multiParam(url, 'reading_status').filter((s): s is ReadingStatus =>
		statusSet.has(s as ReadingStatus)
	);
	if (statuses.length > 0) filters.reading_status = statuses;

	if (url.searchParams.get('needs_review') === 'true') filters.needs_review = true;

	const q = (url.searchParams.get('q') ?? '').trim();
	if (q.length > 0) filters.q = q;

	if (url.searchParams.get('all') === 'true') filters.all = true;

	return filters;
}

/**
 * Serialize `BookListFilters` for `goto` / `fetch`. Optionally preserve `deleted`
 * from the current page URL (undo toast).
 */
export function bookListFiltersToSearchParams(
	filters: BookListFilters,
	currentUrl?: URL
): URLSearchParams {
	const keep = new URLSearchParams();
	if (currentUrl) {
		const del = currentUrl.searchParams.get('deleted');
		if (del) keep.set('deleted', del);
	}
	const setMulti = (key: string, vals: readonly string[] | undefined) => {
		if (!vals || vals.length === 0) return;
		for (const v of vals) keep.append(key, v);
	};
	setMulti('genre', filters.genre);
	setMulti('series_id', filters.series_id);
	setMulti('author_id', filters.author_id);
	setMulti('language', filters.language);
	setMulti('reading_status', filters.reading_status);
	if (filters.needs_review === true) keep.set('needs_review', 'true');
	if (filters.q && filters.q.length > 0) keep.set('q', filters.q);
	if (filters.all === true) keep.set('all', 'true');
	return keep;
}
