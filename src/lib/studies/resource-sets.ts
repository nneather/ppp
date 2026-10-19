/**
 * Client-safe resource-set resolution ([243]).
 *
 * Members are not stored as a materialized list. At read time:
 * rule matches ∪ include overrides − exclude overrides.
 * A `bible_book` rule is Commentary coverage for that book; the Commentary
 * genre is applied by the caller when it builds `candidates`, then collapsed
 * with the by-book helper before this function runs.
 *
 * `lastReviewedAt` null means the set has never been marked reviewed, so
 * nothing counts as "new" (the seed would otherwise badge the whole catalog).
 */
import { BIBLE_BOOK_NAMES } from '$lib/library/bible-book-names';
import {
	collapseCommentaryHits,
	commentaryCollapseKey
} from '$lib/sermons/by-book';
import type { ByBookShelfHit } from '$lib/types/sermons';

export const RESOURCE_SET_RULE_KINDS = ['bible_book', 'genre', 'topic'] as const;
export type ResourceSetRuleKind = (typeof RESOURCE_SET_RULE_KINDS)[number];

export type ResourceSetRule = {
	kind: ResourceSetRuleKind;
	value: string;
};

export const RESOURCE_SET_KINDS = ['bible_book', 'language', 'custom'] as const;
export type ResourceSetKind = (typeof RESOURCE_SET_KINDS)[number];

export const SET_OVERRIDE_KINDS = ['include', 'exclude'] as const;
export type SetOverrideKind = (typeof SET_OVERRIDE_KINDS)[number];

export type CatalogRef = {
	bookId: string | null;
	essayId: string | null;
};

export type RuleCandidate = CatalogRef & {
	title: string;
	/** ISO timestamp of the catalog row (max across a collapsed series). */
	createdAt: string | null;
};

export type SetOverride = CatalogRef & {
	kind: SetOverrideKind;
	title: string | null;
};

export type ResolvedMember = CatalogRef & {
	title: string;
	origin: 'rule' | 'include';
	isNew: boolean;
};

export type ResourceSetListItem = {
	id: string;
	name: string;
	slug: string;
	kind: ResourceSetKind;
	sortOrder: number;
	/** Bible book name when the set's first rule is `bible_book`. */
	bibleBook: string | null;
	memberCount: number;
	newCount: number;
};

export function refKey(ref: CatalogRef): string {
	if (ref.essayId) return `e:${ref.essayId}`;
	if (ref.bookId) return `b:${ref.bookId}`;
	return '';
}

export function parseResourceSetRules(raw: unknown): ResourceSetRule[] {
	if (!Array.isArray(raw)) return [];
	const out: ResourceSetRule[] = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const kind = (item as { kind?: unknown }).kind;
		const value = (item as { value?: unknown }).value;
		if (
			(kind === 'bible_book' || kind === 'genre' || kind === 'topic') &&
			typeof value === 'string' &&
			value.trim().length > 0
		) {
			out.push({ kind, value: value.trim() });
		}
	}
	return out;
}

export function bibleBookFromRules(rules: ResourceSetRule[]): string | null {
	const hit = rules.find((r) => r.kind === 'bible_book');
	return hit?.value ?? null;
}

/** Chip text. Bible-book rules imply Commentary; that genre is not stored on the row. */
export function ruleChipLabel(rule: ResourceSetRule): string {
	if (rule.kind === 'bible_book') return `Commentary · ${rule.value}`;
	if (rule.kind === 'genre') return rule.value;
	return `Topic · ${rule.value}`;
}

function isNewSince(createdAt: string | null, lastReviewedAt: string | null): boolean {
	if (!lastReviewedAt || !createdAt) return false;
	return createdAt > lastReviewedAt;
}

export function resolveSetMembers(input: {
	candidates: RuleCandidate[];
	overrides: SetOverride[];
	lastReviewedAt: string | null;
}): { included: ResolvedMember[]; excluded: ResolvedMember[] } {
	const excludedKeys = new Set(
		input.overrides.filter((o) => o.kind === 'exclude' && refKey(o)).map((o) => refKey(o))
	);
	const candidateByKey = new Map<string, RuleCandidate>();
	for (const c of input.candidates) {
		const key = refKey(c);
		if (key && !candidateByKey.has(key)) candidateByKey.set(key, c);
	}

	const included: ResolvedMember[] = [];
	const seen = new Set<string>();

	for (const c of candidateByKey.values()) {
		const key = refKey(c);
		if (seen.has(key) || excludedKeys.has(key)) continue;
		seen.add(key);
		included.push({
			bookId: c.bookId,
			essayId: c.essayId,
			title: c.title.trim() || 'Untitled',
			origin: 'rule',
			isNew: isNewSince(c.createdAt, input.lastReviewedAt)
		});
	}

	for (const o of input.overrides) {
		if (o.kind !== 'include') continue;
		const key = refKey(o);
		if (!key || seen.has(key) || excludedKeys.has(key)) continue;
		seen.add(key);
		const cand = candidateByKey.get(key);
		included.push({
			bookId: o.bookId,
			essayId: o.essayId,
			title: (cand?.title ?? o.title ?? '').trim() || 'Untitled',
			origin: 'include',
			isNew: false
		});
	}

	const excluded: ResolvedMember[] = [];
	for (const o of input.overrides) {
		if (o.kind !== 'exclude') continue;
		const key = refKey(o);
		if (!key) continue;
		const cand = candidateByKey.get(key);
		excluded.push({
			bookId: o.bookId,
			essayId: o.essayId,
			title: (cand?.title ?? o.title ?? '').trim() || 'Untitled',
			origin: cand ? 'rule' : 'include',
			isNew: false
		});
	}

	included.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
	excluded.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
	return { included, excluded };
}

export function countNewMembers(included: ResolvedMember[]): number {
	return included.reduce((n, m) => n + (m.isNew ? 1 : 0), 0);
}

export function groupResourceSetList(items: ResourceSetListItem[]): {
	bibleBooks: ResourceSetListItem[];
	language: ResourceSetListItem[];
	custom: ResourceSetListItem[];
} {
	const canon = new Map(BIBLE_BOOK_NAMES.map((name, i) => [name, i]));
	const bibleBooks = items
		.filter((i) => i.kind === 'bible_book')
		.slice()
		.sort((a, b) => {
			const ai = a.bibleBook ? (canon.get(a.bibleBook) ?? 999) : 999;
			const bi = b.bibleBook ? (canon.get(b.bibleBook) ?? 999) : 999;
			if (ai !== bi) return ai - bi;
			return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
		});
	const bySort = (a: ResourceSetListItem, b: ResourceSetListItem) => {
		if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
		return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
	};
	return {
		bibleBooks,
		language: items.filter((i) => i.kind === 'language').slice().sort(bySort),
		custom: items.filter((i) => i.kind === 'custom').slice().sort(bySort)
	};
}

type HitWithCreated = ByBookShelfHit & { createdAt: string | null };

/**
 * Collapse commentary hits the same way By book does, then one candidate per
 * surviving hit. `createdAt` is the newest row in the collapse group so a
 * newly acquired volume badges the series.
 */
export function candidatesFromCommentaryHits(hits: HitWithCreated[]): RuleCandidate[] {
	const parentsWithEssay = new Set<string>();
	for (const hit of hits) {
		if (hit.kind === 'essay') parentsWithEssay.add(hit.bookId);
	}
	const surviving =
		parentsWithEssay.size === 0
			? hits
			: hits.filter((hit) => !(hit.kind === 'book' && parentsWithEssay.has(hit.bookId)));
	const byKey = new Map<string, HitWithCreated[]>();
	for (const hit of surviving) {
		const key = commentaryCollapseKey(hit);
		const list = byKey.get(key) ?? [];
		list.push(hit);
		byKey.set(key, list);
	}
	return collapseCommentaryHits(hits).map((hit) => {
		const group = byKey.get(commentaryCollapseKey(hit)) ?? [];
		let createdAt: string | null = null;
		for (const g of group) {
			if (g.createdAt && (!createdAt || g.createdAt > createdAt)) createdAt = g.createdAt;
		}
		if (hit.kind === 'essay' && hit.essayId) {
			return {
				bookId: null,
				essayId: hit.essayId,
				title: hit.title,
				createdAt
			};
		}
		return { bookId: hit.bookId, essayId: null, title: hit.title, createdAt };
	});
}
