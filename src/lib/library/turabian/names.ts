import type { BookAuthorAssignment } from '$lib/types/library';

export type ParsedName = {
	first: string;
	middle: string;
	last: string;
	suffix: string;
	/** Full display as stored in person_label */
	label: string;
};

const NAME_SUFFIX_RE = /^(.*?)\s+(Jr\.?|Sr\.?|II|III|IV)$/i;

function splitSuffixFromLast(last: string): { last: string; suffix: string } {
	const m = last.trim().match(NAME_SUFFIX_RE);
	if (!m) return { last: last.trim(), suffix: '' };
	return { last: m[1]!.trim(), suffix: m[2]!.replace(/\.$/, '') === 'Jr' ? 'Jr.' : m[2]! };
}

/** Prefer structured `people` fields when present on the assignment. */
export function parseAuthorAssignment(a: BookAuthorAssignment): ParsedName {
	const label = a.person_label.trim();
	if (a.last_name?.trim()) {
		return {
			first: a.first_name?.trim() ?? '',
			middle: a.middle_name?.trim() ?? '',
			last: a.last_name.trim(),
			suffix: a.suffix?.trim() ?? '',
			label: label || a.last_name.trim()
		};
	}
	return parsePersonLabel(label);
}

/** Parse "Last, First Middle" or "First Middle Last" from person_label. */
export function parsePersonLabel(label: string): ParsedName {
	const t = label.trim();
	if (!t) return { first: '', middle: '', last: '', suffix: '', label: t };
	if (t.includes(',')) {
		const [lastPart, restPart] = t.split(',', 2);
		const rest = (restPart ?? '').trim();
		const restBits = rest.split(/\s+/).filter(Boolean);
		const first = restBits[0] ?? '';
		const middle = restBits.slice(1).join(' ');
		const { last, suffix } = splitSuffixFromLast((lastPart ?? '').trim());
		return {
			first,
			middle,
			last,
			suffix,
			label: t
		};
	}
	const parts = t.split(/\s+/).filter(Boolean);
	if (parts.length === 1) {
		return { first: '', middle: '', last: parts[0]!, suffix: '', label: t };
	}
	const { last, suffix } = splitSuffixFromLast(parts[parts.length - 1]!);
	const first = parts[0]!;
	const middle = parts.slice(1, -1).join(' ');
	return { first, middle, last, suffix, label: t };
}

export function noteNameOrder(p: ParsedName): string {
	const bits = [p.first, p.middle, p.last, p.suffix].filter((s) => s.length > 0);
	return bits.join(' ');
}

export function bibNameOrder(p: ParsedName): string {
	const firstBits = [p.first, p.middle].filter((s) => s.length > 0).join(' ');
	if (!p.last) return p.label;
	if (!firstBits) return p.last + (p.suffix ? ` ${p.suffix}` : '');
	return `${p.last}${p.suffix ? ` ${p.suffix}` : ''}, ${firstBits}`;
}

export function authorsByRole(
	authors: BookAuthorAssignment[],
	role: BookAuthorAssignment['role']
): BookAuthorAssignment[] {
	return authors.filter((a) => a.role === role).sort((a, b) => a.sort_order - b.sort_order);
}

export function formatAuthorsNote(
	authors: BookAuthorAssignment[],
	opts?: { etAlThreshold?: number }
): string {
	const etAl = opts?.etAlThreshold ?? 4;
	const rows = authorsByRole(authors, 'author');
	if (rows.length === 0) return '';
	const parsed = rows.map((a) => parseAuthorAssignment(a));
	if (parsed.length >= etAl) {
		return `${noteNameOrder(parsed[0]!)} et al.`;
	}
	if (parsed.length === 1) return noteNameOrder(parsed[0]!);
	if (parsed.length === 2) {
		return `${noteNameOrder(parsed[0]!)} and ${noteNameOrder(parsed[1]!)}`;
	}
	const head = parsed.slice(0, -1).map(noteNameOrder).join(', ');
	return `${head}, and ${noteNameOrder(parsed[parsed.length - 1]!)}`;
}

export function formatAuthorsBibliography(authors: BookAuthorAssignment[]): string {
	const rows = authorsByRole(authors, 'author');
	if (rows.length === 0) return '';
	const parsed = rows.map((a) => parseAuthorAssignment(a));
	if (parsed.length === 1) return bibNameOrder(parsed[0]!);
	if (parsed.length === 2) {
		return `${bibNameOrder(parsed[0]!)}, and ${noteNameOrder(parsed[1]!)}`;
	}
	const first = bibNameOrder(parsed[0]!);
	const rest = parsed.slice(1);
	return `${first}, ${rest
		.slice(0, -1)
		.map((p) => noteNameOrder(p))
		.join(', ')}, and ${noteNameOrder(rest[rest.length - 1]!)}`;
}

export function formatEditorsNote(authors: BookAuthorAssignment[]): string {
	const rows = authorsByRole(authors, 'editor');
	if (rows.length === 0) return '';
	const parsed = rows.map((a) => parseAuthorAssignment(a));
	const names =
		parsed.length >= 4
			? `${noteNameOrder(parsed[0]!)} et al.`
			: parsed.length === 1
				? noteNameOrder(parsed[0]!)
				: parsed.length === 2
					? `${noteNameOrder(parsed[0]!)} and ${noteNameOrder(parsed[1]!)}`
					: `${parsed
							.slice(0, -1)
							.map(noteNameOrder)
							.join(', ')}, and ${noteNameOrder(parsed[parsed.length - 1]!)}`;
	return `${names}, ${parsed.length === 1 ? 'ed.' : 'eds.'}`;
}

export function formatEditorsBibliography(authors: BookAuthorAssignment[]): string {
	const rows = authorsByRole(authors, 'editor');
	if (rows.length === 0) return '';
	const parsed = rows.map((a) => parseAuthorAssignment(a));
	const names =
		parsed.length === 1
			? bibNameOrder(parsed[0]!)
			: parsed.length === 2
				? `${bibNameOrder(parsed[0]!)}, and ${noteNameOrder(parsed[1]!)}`
				: parsed.length === 3
					? `${bibNameOrder(parsed[0]!)}, ${noteNameOrder(parsed[1]!)}, and ${noteNameOrder(parsed[2]!)}`
					: `${bibNameOrder(parsed[0]!)}, ${parsed
							.slice(1, -1)
							.map(noteNameOrder)
							.join(', ')}, and ${noteNameOrder(parsed[parsed.length - 1]!)}`;
	return `${names}, ${parsed.length === 1 ? 'ed.' : 'eds.'}`;
}

/** Inline editor credit after title (author-present books). Note: "ed. Walter Hooper". */
export function formatEditorsCreditNote(authors: BookAuthorAssignment[]): string {
	const rows = authorsByRole(authors, 'editor');
	if (rows.length === 0) return '';
	const parsed = rows.map((a) => parseAuthorAssignment(a));
	const names =
		parsed.length >= 4
			? `${noteNameOrder(parsed[0]!)} et al.`
			: parsed.length === 1
				? noteNameOrder(parsed[0]!)
				: parsed.length === 2
					? `${noteNameOrder(parsed[0]!)} and ${noteNameOrder(parsed[1]!)}`
					: `${parsed
							.slice(0, -1)
							.map(noteNameOrder)
							.join(', ')}, and ${noteNameOrder(parsed[parsed.length - 1]!)}`;
	return `${parsed.length === 1 ? 'ed.' : 'eds.'} ${names}`;
}

/** Inline editor credit in bibliography (author-present books). */
export function formatEditorsCreditBibliography(authors: BookAuthorAssignment[]): string {
	const rows = authorsByRole(authors, 'editor');
	if (rows.length === 0) return '';
	const parsed = rows.map((a) => parseAuthorAssignment(a));
	const names =
		parsed.length === 1
			? noteNameOrder(parsed[0]!)
			: parsed.length === 2
				? `${noteNameOrder(parsed[0]!)} and ${noteNameOrder(parsed[1]!)}`
				: parsed.length === 3
					? `${noteNameOrder(parsed[0]!)}, ${noteNameOrder(parsed[1]!)}, and ${noteNameOrder(parsed[2]!)}`
					: `${noteNameOrder(parsed[0]!)}, ${parsed
							.slice(1, -1)
							.map(noteNameOrder)
							.join(', ')}, and ${noteNameOrder(parsed[parsed.length - 1]!)}`;
	return `Edited by ${names}.`;
}

export function formatTranslatorsNote(authors: BookAuthorAssignment[]): string {
	const rows = authorsByRole(authors, 'translator');
	if (rows.length === 0) return '';
	const parsed = rows.map((a) => parseAuthorAssignment(a));
	const names =
		parsed.length === 1
			? noteNameOrder(parsed[0]!)
			: `${noteNameOrder(parsed[0]!)} et al.`;
	return `trans. ${names}`;
}

export function formatTranslatorsBibliography(authors: BookAuthorAssignment[]): string {
	const rows = authorsByRole(authors, 'translator');
	if (rows.length === 0) return '';
	const parsed = rows.map((a) => parseAuthorAssignment(a));
	const names =
		parsed.length === 1
			? noteNameOrder(parsed[0]!)
			: `${noteNameOrder(parsed[0]!)} et al.`;
	return `Translated by ${names}.`;
}

/** First author last name for bibliography sort. */
export function bibliographySortLastName(authors: BookAuthorAssignment[]): string {
	const authorRows = authorsByRole(authors, 'author');
	const editorRows = authorsByRole(authors, 'editor');
	const primary = authorRows.length > 0 ? authorRows : editorRows;
	if (primary.length === 0) return '';
	return parseAuthorAssignment(primary[0]!).last.toLowerCase();
}
