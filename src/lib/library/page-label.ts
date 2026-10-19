/**
 * Essay page labels: arabic pages and lowercase roman front matter
 * (`xiii`–`xx`). Scripture indexes already store free text; essays were integers.
 */

const ROMAN_RE =
	/^(?:m{0,4})(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})$/i;

const ROMAN_VALUES: Record<string, number> = {
	i: 1,
	v: 5,
	x: 10,
	l: 50,
	c: 100,
	d: 500,
	m: 1000
};

export type PageLabelKind = 'arabic' | 'roman';

export function romanToInt(raw: string): number | null {
	const t = raw.trim().toLowerCase();
	if (!t || !ROMAN_RE.test(t)) return null;
	let total = 0;
	for (let i = 0; i < t.length; i++) {
		const cur = ROMAN_VALUES[t[i]!] ?? 0;
		const next = ROMAN_VALUES[t[i + 1]!] ?? 0;
		total += cur < next ? -cur : cur;
	}
	return total > 0 ? total : null;
}

/** Normalize a stored or typed page. Empty is null. Invalid is null. */
export function normalizePageLabel(raw: unknown): string | null {
	const t = String(raw ?? '').trim();
	if (!t) return null;
	if (/^\d{1,6}$/.test(t)) return String(Number(t));
	if (romanToInt(t) != null) return t.toLowerCase();
	return null;
}

export function pageLabelKind(page: string): PageLabelKind | null {
	if (/^\d+$/.test(page)) return 'arabic';
	if (romanToInt(page) != null) return 'roman';
	return null;
}

/** Roman front matter sorts before arabic body pages. Nulls sort last. */
export function comparePageLabels(a: string | null, b: string | null): number {
	if (a == null && b == null) return 0;
	if (a == null) return 1;
	if (b == null) return -1;
	const ka = pageLabelKind(a);
	const kb = pageLabelKind(b);
	const rank = (k: PageLabelKind | null) => (k === 'roman' ? 0 : k === 'arabic' ? 1 : 2);
	const ra = rank(ka);
	const rb = rank(kb);
	if (ra !== rb) return ra - rb;
	if (ka === 'roman' && kb === 'roman') return (romanToInt(a) ?? 0) - (romanToInt(b) ?? 0);
	if (ka === 'arabic' && kb === 'arabic') return Number(a) - Number(b);
	return a.localeCompare(b);
}

export function pageLabelBefore(start: string, end: string): boolean {
	return comparePageLabels(start, end) > 0;
}
