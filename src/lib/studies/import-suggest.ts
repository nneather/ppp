/**
 * Import checklist + which resource sets to offer first ([243]).
 *
 * Expository (`topical` false): commentary set for each Bible book in the
 * passage, NT/OT language tools for those testaments, then Systematic Theology.
 * Topical: sets whose name or genre/topic rule overlaps the topic text;
 * commentary sets still appear when a passage is set.
 */
import { BIBLE_BOOK_NAMES } from '$lib/library/bible-book-names';
import { bibleBookFromRules, type ResourceSetKind, type ResourceSetRule } from './resource-sets';

export const NT_LANGUAGE_SET_NAME = 'NT language tools';
export const OT_LANGUAGE_SET_NAME = 'OT language tools';
export const SYSTEMATIC_THEOLOGY_SET_NAME = 'Systematic Theology';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ImportSetSummary = {
	id: string;
	name: string;
	kind: ResourceSetKind;
	rules: ResourceSetRule[];
};

export type PaperSuggestInput = {
	topical: boolean;
	passageDisplay: string | null;
	topic: string | null;
};

export type SuggestionReason = 'passage' | 'testament' | 'topical' | 'expository';

export const SUGGESTION_REASON_LABELS: Record<SuggestionReason, string> = {
	passage: 'Passage',
	testament: 'Testament',
	topical: 'Topic',
	expository: 'Expository'
};

export type SetSuggestion = {
	id: string;
	name: string;
	reason: SuggestionReason;
};

export type ImportCandidate = {
	bookId: string | null;
	essayId: string | null;
	title: string;
	notes: string | null;
	/** Checklist subtitle. Not stored on the study source. */
	hint?: string | null;
};

export type ImportChecklistRow = ImportCandidate & {
	key: string;
	attached: boolean;
};

function normalizePassageAliases(input: string): string {
	return input
		.replace(/\bsong of solomon\b/gi, 'Song of Songs')
		.replace(/\bpsalms?\b/gi, 'Psalms');
}

export function bibleBooksInDisplay(input: string | null | undefined): string[] {
	const raw = normalizePassageAliases(input?.trim() ?? '');
	if (!raw) return [];
	let hay = ` ${raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ')} `;
	const names = [...BIBLE_BOOK_NAMES].sort((a, b) => b.length - a.length);
	const found: string[] = [];
	for (const name of names) {
		const needle = ` ${name.toLowerCase()} `;
		if (!hay.includes(needle)) continue;
		found.push(name);
		hay = hay.split(needle).join(' ');
	}
	const order = new Map(BIBLE_BOOK_NAMES.map((n, i) => [n, i]));
	found.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
	return found;
}

function testamentOf(book: string): 'ot' | 'nt' | null {
	const i = BIBLE_BOOK_NAMES.indexOf(book);
	if (i < 0) return null;
	const matthew = BIBLE_BOOK_NAMES.indexOf('Matthew');
	return i < matthew ? 'ot' : 'nt';
}

function looseMatch(a: string, b: string): boolean {
	if (a === b) return true;
	if (a.length >= 4 && b.includes(a)) return true;
	if (b.length >= 4 && a.includes(b)) return true;
	return false;
}

function topicHits(topic: string, set: ImportSetSummary): boolean {
	const t = topic.trim().toLowerCase();
	if (!t) return false;
	if (looseMatch(t, set.name.toLowerCase())) return true;
	for (const rule of set.rules) {
		if (rule.kind === 'bible_book') continue;
		if (looseMatch(t, rule.value.toLowerCase())) return true;
	}
	return false;
}

function commentarySetFor(book: string, sets: ImportSetSummary[]): ImportSetSummary | null {
	return (
		sets.find((s) => s.kind === 'bible_book' && bibleBookFromRules(s.rules) === book) ?? null
	);
}

export function suggestResourceSets(
	paper: PaperSuggestInput,
	sets: ImportSetSummary[]
): SetSuggestion[] {
	const books = bibleBooksInDisplay(paper.passageDisplay);
	const out: SetSuggestion[] = [];
	const seen = new Set<string>();

	function push(set: ImportSetSummary | null | undefined, reason: SuggestionReason) {
		if (!set || seen.has(set.id)) return;
		seen.add(set.id);
		out.push({ id: set.id, name: set.name, reason });
	}

	if (paper.topical) {
		const topic = paper.topic?.trim() ?? '';
		if (topic) {
			for (const set of sets) {
				if (topicHits(topic, set)) push(set, 'topical');
			}
		}
		for (const book of books) push(commentarySetFor(book, sets), 'passage');
		return out;
	}

	for (const book of books) push(commentarySetFor(book, sets), 'passage');

	const testaments = new Set(books.map(testamentOf).filter((t): t is 'ot' | 'nt' => t != null));
	if (testaments.has('ot')) {
		push(
			sets.find((s) => s.name === OT_LANGUAGE_SET_NAME),
			'testament'
		);
	}
	if (testaments.has('nt')) {
		push(
			sets.find((s) => s.name === NT_LANGUAGE_SET_NAME),
			'testament'
		);
	}
	push(
		sets.find((s) => s.name === SYSTEMATIC_THEOLOGY_SET_NAME),
		'expository'
	);
	return out;
}

export function groupImportSets(sets: ImportSetSummary[]): {
	bibleBooks: ImportSetSummary[];
	language: ImportSetSummary[];
	custom: ImportSetSummary[];
} {
	const canon = new Map(BIBLE_BOOK_NAMES.map((name, i) => [name, i]));
	const byName = (a: ImportSetSummary, b: ImportSetSummary) =>
		a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
	const bibleBooks = sets
		.filter((s) => s.kind === 'bible_book')
		.slice()
		.sort((a, b) => {
			const ai = canon.get(bibleBookFromRules(a.rules) ?? '') ?? 999;
			const bi = canon.get(bibleBookFromRules(b.rules) ?? '') ?? 999;
			if (ai !== bi) return ai - bi;
			return byName(a, b);
		});
	return {
		bibleBooks,
		language: sets.filter((s) => s.kind === 'language').slice().sort(byName),
		custom: sets.filter((s) => s.kind === 'custom').slice().sort(byName)
	};
}

/** Set imports keep the set name. Prior papers land in `From: <title>`. */
export function importGroupName(kind: 'set' | 'paper', name: string): string {
	const trimmed = name.trim();
	if (kind === 'paper') return `From: ${trimmed}`;
	return trimmed;
}

export function catalogKey(bookId: string | null, essayId: string | null): string {
	if (essayId) return `e:${essayId}`;
	if (bookId) return `b:${bookId}`;
	return '';
}

export function buildImportChecklist(
	candidates: ImportCandidate[],
	attachedBookIds: readonly string[],
	attachedEssayIds: readonly string[]
): ImportChecklistRow[] {
	const books = new Set(attachedBookIds);
	const essays = new Set(attachedEssayIds);
	const rows: ImportChecklistRow[] = [];
	for (const c of candidates) {
		const key = catalogKey(c.bookId, c.essayId);
		if (!key) continue;
		const attached = c.essayId ? essays.has(c.essayId) : !!c.bookId && books.has(c.bookId);
		rows.push({ ...c, key, attached });
	}
	return rows;
}

/** Current group name equals a resource set name → that set can be excluded. */
export function setIdForGroupName(
	groupName: string | null | undefined,
	sets: readonly { id: string; name: string }[]
): string | null {
	if (!groupName) return null;
	return sets.find((s) => s.name === groupName)?.id ?? null;
}

export function parsePaperListShow(raw: string | null | undefined): 'active' | 'archived' {
	return raw === 'archived' ? 'archived' : 'active';
}

export function parseImportTarget(
	raw: string | null | undefined
): { kind: 'set' | 'paper' | 'sections'; id: string } | null {
	if (!raw) return null;
	if (raw === 'sections') return { kind: 'sections', id: 'sections' };
	const idx = raw.indexOf(':');
	if (idx < 0) return null;
	const kind = raw.slice(0, idx);
	const id = raw.slice(idx + 1);
	if ((kind !== 'set' && kind !== 'paper') || !UUID_RE.test(id)) return null;
	return { kind, id };
}
