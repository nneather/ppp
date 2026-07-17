import { GENRES, type Genre } from '$lib/types/library';

/**
 * Primary genre chips on `/library` filters. Full `GENRES` stays behind
 * "More genres…" so the panel stays scannable (see decision 086).
 */
export const LIBRARY_FILTER_TOP_GENRES: readonly Genre[] = [
	'Commentary',
	'Biblical Reference',
	'Biblical Theology',
	'Systematic Theology',
	'Church History',
	'Historical Theology',
	'Old Testament',
	'New Testament',
	'Pentateuch',
	'Gospels and Jesus',
	'Christian Living',
	'Bibles',
	'Pastoral Ministry',
	'Homiletics',
	'Literature',
	'History'
];

const TOP_SET = new Set<string>(LIBRARY_FILTER_TOP_GENRES);

/**
 * Genres shown in the compact chip row: curated top list, plus any active
 * genres that are not in the top list (so applied filters stay visible).
 */
export function primaryFilterGenres(active: readonly string[] | undefined): Genre[] {
	const out: Genre[] = [...LIBRARY_FILTER_TOP_GENRES];
	const seen = new Set<string>(LIBRARY_FILTER_TOP_GENRES);
	for (const g of active ?? []) {
		if (!seen.has(g) && (GENRES as readonly string[]).includes(g)) {
			out.push(g as Genre);
			seen.add(g);
		}
	}
	return out;
}

/** Genres not in the primary row (stable GENRES order). */
export function overflowFilterGenres(primary: readonly Genre[]): Genre[] {
	const primarySet = new Set<string>(primary);
	return GENRES.filter((g) => !primarySet.has(g));
}

export function isTopFilterGenre(g: string): boolean {
	return TOP_SET.has(g);
}
