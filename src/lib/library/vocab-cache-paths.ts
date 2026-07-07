/**
 * Library vocab JSON endpoints — StaleWhileRevalidate in service-worker.ts only.
 * Do not add HTML routes, mutation endpoints, or books.json here.
 */
export const LIBRARY_PEOPLE_JSON = '/library/people.json';
export const LIBRARY_SERIES_JSON = '/library/series.json';
export const LIBRARY_TOPIC_COUNTS_JSON = '/library/topic-counts.json';
export const LIBRARY_ANCIENT_TEXTS_JSON = '/library/ancient-texts.json';

export const LIBRARY_VOCAB_CACHE_PATHS = [
	LIBRARY_PEOPLE_JSON,
	LIBRARY_SERIES_JSON,
	LIBRARY_TOPIC_COUNTS_JSON,
	LIBRARY_ANCIENT_TEXTS_JSON
] as const;

export type LibraryVocabCachePath = (typeof LIBRARY_VOCAB_CACHE_PATHS)[number];
