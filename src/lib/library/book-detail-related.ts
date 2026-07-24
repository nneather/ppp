import type {
	AuthorRole,
	BookAuthorAssignment,
	BookSiblingRow
} from '$lib/types/library';

/** Prefer authors, else editors; never translators when either exists. */
export function primaryAuthorPersonIds(
	authors: Pick<BookAuthorAssignment, 'person_id' | 'role' | 'sort_order'>[]
): string[] {
	const byRole = (role: AuthorRole) =>
		authors
			.filter((a) => a.role === role)
			.sort((a, b) => a.sort_order - b.sort_order)
			.map((a) => a.person_id);
	const ids = byRole('author');
	if (ids.length > 0) return [...new Set(ids)];
	const editors = byRole('editor');
	if (editors.length > 0) return [...new Set(editors)];
	return [];
}

export function siblingBookLabel(row: Pick<BookSiblingRow, 'title' | 'volume_number'>): string {
	const title = row.title?.trim() || '(untitled)';
	const vol = row.volume_number?.trim();
	if (vol) return `Vol. ${vol} — ${title}`;
	return title;
}

function volumeSortKey(volume: string | null): { n: number | null; s: string } {
	const raw = volume?.trim() ?? '';
	if (!raw) return { n: null, s: '' };
	const asNum = Number(raw);
	if (Number.isFinite(asNum)) return { n: asNum, s: raw };
	return { n: null, s: raw.toLowerCase() };
}

/** Null volume last; numeric volumes before non-numeric; then title. */
export function compareSiblingBooks(
	a: Pick<BookSiblingRow, 'title' | 'volume_number'>,
	b: Pick<BookSiblingRow, 'title' | 'volume_number'>
): number {
	const ka = volumeSortKey(a.volume_number);
	const kb = volumeSortKey(b.volume_number);
	const aNull = ka.n === null && !ka.s;
	const bNull = kb.n === null && !kb.s;
	if (aNull !== bNull) return aNull ? 1 : -1;
	if (ka.n != null && kb.n != null && ka.n !== kb.n) return ka.n - kb.n;
	if (ka.n != null && kb.n == null && kb.s) return -1;
	if (kb.n != null && ka.n == null && ka.s) return 1;
	const sCmp = ka.s.localeCompare(kb.s);
	if (sCmp !== 0) return sCmp;
	return (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' });
}
