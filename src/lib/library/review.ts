import { multiParam } from '$lib/library/server/url-params';
import {
	IMPORT_MATCH_TYPES,
	LANGUAGES,
	READING_STATUSES
} from '$lib/types/library';
import type {
	ImportMatchType,
	Language,
	ReadingStatus,
	ReviewQueueFilters
} from '$lib/types/library';

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

	return filters;
}
