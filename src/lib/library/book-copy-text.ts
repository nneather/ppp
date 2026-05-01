import type { BookAuthorAssignment, BookDetail } from '$lib/types/library';

/** "Last, First …" from a `personDisplayLong`-style label when possible. */
export function authorLabelToLastCommaFirst(label: string): string {
	const t = label.trim();
	if (!t) return '';
	if (t.includes(',')) return t;
	const parts = t.split(/\s+/).filter(Boolean);
	if (parts.length === 1) return t;
	const last = parts[parts.length - 1]!;
	const rest = parts.slice(0, -1).join(' ');
	return `${last}, ${rest}`;
}

export function copyAuthorsLine(authors: BookAuthorAssignment[]): string {
	return authors
		.filter((a) => a.role === 'author')
		.map((a) => authorLabelToLastCommaFirst(a.person_label))
		.filter((s) => s.length > 0)
		.join('; ');
}

export function copyTitleLine(book: BookDetail): string {
	const t = (book.title ?? '').trim();
	const st = (book.subtitle ?? '').trim();
	if (!t && !st) return '';
	if (t && st) return `${t}: ${st}`;
	return t || st;
}

export function copyPublisherYearLine(book: BookDetail): string {
	const parts: string[] = [];
	if (book.publisher_location?.trim()) parts.push(book.publisher_location.trim());
	if (book.publisher?.trim()) parts.push(book.publisher.trim());
	const head = parts.join(': ');
	const yearStr = book.year != null ? String(book.year) : '';
	return [head, yearStr].filter((s) => s.length > 0).join(', ');
}

/** Plain concatenation for rough paste — not Turabian. */
export function copyAllFieldsLine(book: BookDetail): string {
	const bits: string[] = [];
	const auth = copyAuthorsLine(book.authors);
	if (auth) bits.push(auth);
	const title = copyTitleLine(book);
	if (title) bits.push(title);
	const pub = copyPublisherYearLine(book);
	if (pub) bits.push(pub);
	if (book.page_count != null) bits.push(String(book.page_count));
	return bits.join(' ');
}
