import { multiParam } from '$lib/library/server/url-params';
import { CITATION_CRITICAL_GENRES } from '$lib/library/turabian/types';
import {
	IMPORT_MATCH_TYPES,
	LANGUAGES,
	READING_STATUSES
} from '$lib/types/library';
import type {
	ImportMatchType,
	Language,
	ReadingStatus,
	ReviewQueueFilters,
	ReviewSlice
} from '$lib/types/library';

const SLICE_SET = new Set<ReviewSlice>(['critical', 'backlog']);

export function parseReviewFilters(url: URL): ReviewQueueFilters {
	const filters: ReviewQueueFilters = {};

	const genres = multiParam(url, 'genre');
	if (genres.length > 0) filters.genre = genres;

	const series = multiParam(url, 'series_id');
	if (series.length > 0) filters.series_id = series;

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

	if (url.searchParams.get('subject') === 'blank') filters.subject_blank = true;

	const matchSet = new Set<ImportMatchType>(IMPORT_MATCH_TYPES);
	const matches = multiParam(url, 'match_type').filter((m): m is ImportMatchType =>
		matchSet.has(m as ImportMatchType)
	);
	if (matches.length > 0) filters.import_match_type = matches;

	const sliceParam = url.searchParams.get('slice');
	if (sliceParam && SLICE_SET.has(sliceParam as ReviewSlice)) {
		filters.slice = sliceParam as ReviewSlice;
	}

	return filters;
}

/** Apply Citation Critical / Backlog slice to a Supabase books query builder. */
export function applyReviewSliceGenreFilter<
	T extends {
		in(column: string, values: string[]): T;
		is(column: string, value: null): T;
		or(filters: string, options?: { foreignTable?: string }): T;
	}
>(query: T, slice: ReviewSlice | undefined): T {
	if (!slice) return query;
	const genres = [...CITATION_CRITICAL_GENRES];
	if (slice === 'critical') {
		return query.in('genre', genres);
	}
	// Backlog: genre IS NULL OR genre not in scholarly core
	const quoted = genres.map((g) => `"${g.replace(/"/g, '""')}"`).join(',');
	return query.or(`genre.is.null,genre.not.in.(${quoted})`);
}

export { CITATION_CRITICAL_GENRES };
