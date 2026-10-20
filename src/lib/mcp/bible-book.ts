/**
 * Resolve a user-typed Bible book name to the Protestant canon string used in DB.
 * Shared by ppp MCP tools (and any future callers).
 */

import { ALL_BIBLE_BOOK_NAMES, BIBLE_BOOK_NAMES } from '$lib/library/bible-book-names';

const ALIASES: Record<string, string> = {
	ps: 'Psalms',
	psalm: 'Psalms',
	song: 'Song of Songs',
	sos: 'Song of Songs',
	canticles: 'Song of Songs',
	qoheleth: 'Ecclesiastes',
	apocalypse: 'Revelation',
	rev: 'Revelation',
	mt: 'Matthew',
	mk: 'Mark',
	lk: 'Luke',
	jn: 'John',
	rom: 'Romans',
	'1 cor': '1 Corinthians',
	'2 cor': '2 Corinthians',
	'1 thess': '1 Thessalonians',
	'2 thess': '2 Thessalonians',
	'1 tim': '1 Timothy',
	'2 tim': '2 Timothy',
	'1 pet': '1 Peter',
	'2 pet': '2 Peter',
	'1 john': '1 John',
	'2 john': '2 John',
	'3 john': '3 John'
};

/** Resolve only when the caller passes `{ includeApocrypha: true }`. */
const APOCRYPHA_ALIASES: Record<string, string> = {
	ecclesiasticus: 'Sirach',
	sir: 'Sirach',
	wis: 'Wisdom of Solomon',
	tob: 'Tobit',
	jdt: 'Judith',
	bar: 'Baruch',
	'1 macc': '1 Maccabees',
	'2 macc': '2 Maccabees',
	'4 ezra': '2 Esdras'
};

export type BibleBookResolveOpts = { includeApocrypha?: boolean };

function namesFor(opts?: BibleBookResolveOpts): readonly string[] {
	return opts?.includeApocrypha ? ALL_BIBLE_BOOK_NAMES : BIBLE_BOOK_NAMES;
}

function normalizeKey(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/\./g, '')
		.replace(/\s+/g, ' ');
}

/**
 * Exact / alias / case-insensitive match. Returns null when ambiguous or unknown.
 * Apocrypha names and aliases resolve only with `{ includeApocrypha: true }`.
 */
export function resolveBibleBookName(raw: string, opts?: BibleBookResolveOpts): string | null {
	const key = normalizeKey(raw);
	if (!key) return null;

	const alias = ALIASES[key];
	if (alias) return alias;

	if (opts?.includeApocrypha) {
		const apocrypha = APOCRYPHA_ALIASES[key];
		if (apocrypha) return apocrypha;
	}

	const names = namesFor(opts);
	const exact = names.find((n) => normalizeKey(n) === key);
	if (exact) return exact;

	const prefixHits = names.filter((n) => normalizeKey(n).startsWith(key));
	if (prefixHits.length === 1) return prefixHits[0]!;

	return null;
}

export function bibleBookSuggestions(
	raw: string,
	limit = 8,
	opts?: BibleBookResolveOpts
): string[] {
	const names = namesFor(opts);
	const key = normalizeKey(raw);
	if (!key) return [...names].slice(0, limit);
	return names.filter((n) => normalizeKey(n).includes(key)).slice(0, limit);
}
