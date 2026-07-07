import type { OlApplyKey } from '$lib/components/book-ol-refresh-dialog.svelte';
import type { OpenLibraryBookPrefill } from '$lib/library/open-library-prefill';
import {
	matchPersonExact,
	matchPersonFuzzyCandidates,
	matchSeries,
	splitAuthorString
} from '$lib/library/match';
import type { AuthorRole, PersonRow, SeriesRow } from '$lib/types/library';

export type BookAuthorRow = {
	key: string;
	person_id: string;
	role: AuthorRole;
	prefillName?: string;
	fuzzyCandidates?: PersonRow[];
	olSeedAutoOpen?: boolean;
};

export type OlSeriesHint = { name: string; volume: string | null } | null;

export type BookOlPrefillFieldPatch = {
	title?: string;
	subtitle?: string;
	publisher?: string;
	publisher_id?: string;
	publisher_location?: string;
	edition?: string;
	year?: string;
	page_count?: string;
	isbn?: string;
	genre?: string;
	work_type?: string;
	language?: string;
	series_id?: string;
	volume_number?: string;
	olSeriesHint?: OlSeriesHint;
	olImportSnapshot?: OpenLibraryBookPrefill;
	authorRows?: BookAuthorRow[];
};

export type ApplyOlPrefillOptions = {
	prefill: OpenLibraryBookPrefill;
	people: PersonRow[];
	seriesRows: SeriesRow[];
	current: {
		genre: string;
		work_type: string;
		language: string;
	};
};

export function buildOlAuthorRows(
	names: string[],
	people: PersonRow[]
): BookAuthorRow[] {
	const nextRows: BookAuthorRow[] = [];
	let firstUnresolvedSeeded = false;
	for (let idx = 0; idx < names.length; idx++) {
		const nm = names[idx]!;
		const exact = matchPersonExact(nm, people);
		if (exact) {
			nextRows.push({
				key: `ol-${idx}-${exact.id}-${crypto.randomUUID()}`,
				person_id: exact.id,
				role: 'author'
			});
			continue;
		}
		const fuzzy = matchPersonFuzzyCandidates(nm, people);
		const openDropdown = !firstUnresolvedSeeded;
		firstUnresolvedSeeded = true;
		nextRows.push({
			key: `ol-${idx}-${crypto.randomUUID()}`,
			person_id: '',
			role: 'author',
			prefillName: nm,
			olSeedAutoOpen: openDropdown,
			...(fuzzy.length > 0 ? { fuzzyCandidates: fuzzy } : {})
		});
	}
	return nextRows;
}

export function authorNamesFromPrefill(prefill: OpenLibraryBookPrefill): string[] {
	const authorList = Array.isArray(prefill.authors) ? prefill.authors : [];
	if (authorList.length > 0) {
		return authorList.map((a) => a.name.trim()).filter(Boolean);
	}
	if (prefill.authorTyped) {
		return splitAuthorString(prefill.authorTyped);
	}
	return [];
}

export function applyOlPrefillFields(opts: ApplyOlPrefillOptions): BookOlPrefillFieldPatch {
	const { prefill, people, seriesRows, current } = opts;
	const patch: BookOlPrefillFieldPatch = { olImportSnapshot: prefill };

	if (prefill.title) patch.title = prefill.title;
	if (prefill.subtitle != null && prefill.subtitle !== '') patch.subtitle = prefill.subtitle;
	if (prefill.publisher != null && prefill.publisher !== '') patch.publisher = prefill.publisher;
	if (prefill.publisher_id) patch.publisher_id = prefill.publisher_id;
	if (prefill.publisher_location != null && prefill.publisher_location !== '') {
		patch.publisher_location = prefill.publisher_location;
	}
	if (prefill.edition != null && prefill.edition !== '') patch.edition = prefill.edition;
	if (prefill.year != null) patch.year = String(prefill.year);
	if (prefill.page_count != null) patch.page_count = String(prefill.page_count);
	if (prefill.isbn) patch.isbn = prefill.isbn;
	if (prefill.genreSuggested && current.genre === '') patch.genre = prefill.genreSuggested;
	if (prefill.workTypeSuggested && current.work_type === 'monograph') {
		patch.work_type = prefill.workTypeSuggested;
	}
	if (prefill.languageCode) patch.language = prefill.languageCode;

	const seriesLabelRaw = prefill.seriesName?.trim() ?? '';
	if (seriesLabelRaw) {
		const matchedSeries = matchSeries(seriesLabelRaw, seriesRows);
		if (matchedSeries) {
			patch.series_id = matchedSeries.id;
			patch.volume_number = prefill.seriesVolume ?? '';
			patch.olSeriesHint = null;
		} else {
			patch.olSeriesHint = { name: seriesLabelRaw, volume: prefill.seriesVolume };
			if (prefill.seriesVolume) patch.volume_number = prefill.seriesVolume;
		}
	} else {
		patch.olSeriesHint = null;
	}

	const names = authorNamesFromPrefill(prefill);
	const authorRows = buildOlAuthorRows(names, people);
	if (authorRows.length > 0) patch.authorRows = authorRows;

	return patch;
}

export function applyOlRefreshPatch(
	keys: OlApplyKey[],
	data: OpenLibraryBookPrefill
): BookOlPrefillFieldPatch {
	const set = new Set(keys);
	const patch: BookOlPrefillFieldPatch = {};
	if (set.has('title') && data.title) patch.title = data.title;
	if (set.has('subtitle') && data.subtitle != null) patch.subtitle = data.subtitle;
	if (set.has('publisher') && data.publisher != null) patch.publisher = data.publisher;
	if (set.has('publisher') && data.publisher_id) patch.publisher_id = data.publisher_id;
	if (set.has('publisher_location') && data.publisher_location != null) {
		patch.publisher_location = data.publisher_location;
	}
	if (set.has('year') && data.year != null) patch.year = String(data.year);
	if (set.has('edition') && data.edition != null) patch.edition = data.edition;
	if (set.has('page_count') && data.page_count != null) patch.page_count = String(data.page_count);
	if (set.has('isbn') && data.isbn) patch.isbn = data.isbn;
	if (set.has('genre') && data.genreSuggested) patch.genre = data.genreSuggested;
	if (set.has('work_type') && data.workTypeSuggested) patch.work_type = data.workTypeSuggested;
	return patch;
}
