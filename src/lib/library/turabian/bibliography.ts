import { formatBibliography } from './format';
import { bibliographySortLastName } from './names';
import type { BibliographySortKey, BookCitationInput, CitationFormatted } from './types';

export function bibliographySortKey(book: BookCitationInput): BibliographySortKey {
	return {
		lastName: bibliographySortLastName(book.authors),
		year: book.year ?? book.reprint_year ?? book.original_year,
		title: (book.title ?? '').toLowerCase()
	};
}

export function sortBibliographyInputs(books: BookCitationInput[]): BookCitationInput[] {
	return [...books].sort((a, b) => {
		const ka = bibliographySortKey(a);
		const kb = bibliographySortKey(b);
		const last = ka.lastName.localeCompare(kb.lastName);
		if (last !== 0) return last;
		const ya = ka.year ?? 0;
		const yb = kb.year ?? 0;
		if (ya !== yb) return ya - yb;
		return ka.title.localeCompare(kb.title);
	});
}

export function formatCompiledBibliography(books: BookCitationInput[]): CitationFormatted {
	const sorted = sortBibliographyInputs(books);
	const entries = sorted
		.map((b) => formatBibliography(b))
		.filter((e) => e.plain.length > 0);
	const plain = entries.map((e) => e.plain).join('\n\n');
	const html = entries.map((e) => `<p>${e.html}</p>`).join('\n');
	return {
		plain,
		html,
		sourceType: entries[0]?.sourceType ?? 'single-author-book'
	};
}
