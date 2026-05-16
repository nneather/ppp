/**
 * Pure helpers for Open Library → book form matching (people + series).
 */

import type { PersonRow, SeriesRow } from '$lib/types/library';

export function normalizePersonName(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function normalizeSeriesName(s: string): string {
	return s
		.toLowerCase()
		.replace(/\s+and\s+/g, ' ')
		.replace(/\s*&\s*/g, ' ')
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function formatPersonFullName(p: PersonRow): string {
	return [p.first_name, p.middle_name, p.last_name, p.suffix]
		.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
		.join(' ');
}

/**
 * Split a composite author line from Open Library or edition metadata.
 * Primary separator is `;`; also splits ` & ` and tight ` and ` pairs.
 */
export function splitAuthorString(raw: string): string[] {
	const s = raw.trim();
	if (!s) return [];
	const bySemi = s
		.split(/\s*;\s*/)
		.map((x) => x.trim())
		.filter(Boolean);
	const out: string[] = [];
	for (const part of bySemi) {
		if (/\s+&\s+/.test(part)) {
			for (const chunk of part.split(/\s+&\s+/)) {
				const t = chunk.trim();
				if (t) out.push(t);
			}
			continue;
		}
		const andParts = part.split(/\s+and\s+/i);
		if (andParts.length === 2) {
			const [a, b] = andParts;
			const aTrim = (a ?? '').trim();
			const bTrim = (b ?? '').trim();
			if (aTrim && bTrim && aTrim.length < 48 && bTrim.length < 48) {
				out.push(aTrim, bTrim);
				continue;
			}
		}
		out.push(part);
	}
	return out;
}

function parseNameForFuzzy(text: string): { last: string; firstInitial: string } | null {
	const trimmed = text.trim();
	if (!trimmed) return null;
	if (trimmed.includes(',')) {
		const commaIdx = trimmed.indexOf(',');
		const last = trimmed.slice(0, commaIdx).trim().toLowerCase();
		const after = trimmed.slice(commaIdx + 1).trim();
		const firstTok = after.split(/\s+/).filter(Boolean)[0] ?? '';
		const firstInitial = firstTok.charAt(0).toLowerCase();
		if (!last) return null;
		return { last, firstInitial };
	}
	const tokens = trimmed.split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return null;
	const last = tokens[tokens.length - 1]!.toLowerCase();
	const firstTok = tokens[0] ?? '';
	const firstInitial = firstTok.charAt(0).toLowerCase();
	return { last, firstInitial };
}

export function matchPersonExact(name: string, people: PersonRow[]): PersonRow | null {
	const n = normalizePersonName(name);
	if (!n) return null;
	for (const p of people) {
		if (normalizePersonName(formatPersonFullName(p)) === n) return p;
		for (const alias of p.aliases ?? []) {
			if (normalizePersonName(alias) === n) return p;
		}
	}
	return null;
}

/** Same last name + same first initial as parsed from OL name; max 2 rows. */
export function matchPersonFuzzyCandidates(name: string, people: PersonRow[]): PersonRow[] {
	const parsed = parseNameForFuzzy(name);
	if (!parsed) return [];
	const matches = people.filter((p) => {
		if (p.last_name.toLowerCase() !== parsed.last) return false;
		const ini = p.first_name?.trim().charAt(0).toLowerCase() ?? '';
		return ini === parsed.firstInitial;
	});
	return matches.slice(0, 2);
}

export function matchSeries(olName: string, rows: SeriesRow[]): SeriesRow | null {
	const n = normalizeSeriesName(olName);
	if (!n || n.length < 3) return null;

	for (const s of rows) {
		if (normalizeSeriesName(s.name) === n) return s;
		if (s.abbreviation) {
			const abRaw = s.abbreviation.trim();
			if (abRaw.toLowerCase() === olName.trim().toLowerCase()) return s;
			if (normalizeSeriesName(abRaw) === n) return s;
		}
	}

	for (const s of rows) {
		const sn = normalizeSeriesName(s.name);
		if (sn.length >= 8 && (n.includes(sn) || sn.includes(n))) return s;
		if (s.abbreviation) {
			const ab = normalizeSeriesName(s.abbreviation);
			if (ab.length >= 3 && (n.includes(ab) || ab.includes(n))) return s;
		}
	}
	return null;
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * When exactly one canonical `bible_books.name` appears in title+subtitle (word-boundary match), return it.
 * Otherwise null (ambiguous or none).
 */
export function detectBibleBookFromTitle(
	title: string,
	subtitle: string,
	bibleBooks: { name: string }[]
): string | null {
	const hay = `${title} ${subtitle}`.toLowerCase();
	const sorted = [...bibleBooks].sort((a, b) => b.name.length - a.name.length);
	const matches: string[] = [];
	for (const b of sorted) {
		const n = b.name.toLowerCase();
		const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(n)}([^a-z0-9]|$)`, 'i');
		if (re.test(hay)) matches.push(b.name);
	}
	return matches.length === 1 ? matches[0]! : null;
}
