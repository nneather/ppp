import { authorsByRole } from './names';
import type { BookCitationInput, CitationSourceType } from './types';

const REFERENCE_GENRES = new Set([
	'Biblical Reference',
	'Greek Language Tools',
	'Hebrew Language Tools',
	'Latin Language Tools',
	'German Language Tools',
	'Chinese Language Tools'
]);

/**
 * Choose Turabian handler from genre + author/series structure.
 * Pure function — deterministic for a given input snapshot.
 */
export function resolveCitationSourceType(book: BookCitationInput): CitationSourceType {
	const genre = (book.genre ?? '').trim();
	const authors = authorsByRole(book.authors, 'author');
	const editors = authorsByRole(book.authors, 'editor');
	const hasSeries = Boolean((book.series_name ?? book.series_abbreviation ?? '').trim());
	const hasVol = Boolean((book.volume_number ?? '').trim()) || (book.total_volumes ?? 0) > 1;
	const hasTranslator = book.authors.some((a) => a.role === 'translator');

	if (genre === 'Bibles') return 'bible';

	if (genre === 'Commentary' && hasSeries) return 'commentary-in-series';
	if (genre === 'Commentary') return 'standalone-commentary';

	if (REFERENCE_GENRES.has(genre)) {
		if (authors.length === 0 && editors.length > 0) return 'reference-work-edited';
		return 'reference-work-single-author';
	}

	if (authors.length === 0 && editors.length > 0) return 'edited-volume';

	if (hasVol && genre !== 'Commentary') return 'multi-volume';

	if (hasTranslator && authors.length > 0) return 'book-with-translator';

	return 'single-author-book';
}
