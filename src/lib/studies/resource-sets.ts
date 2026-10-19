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
import { titleSortKey } from '$lib/library/title-sort';
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

/** include = in set; exclude = not included (listed); dismiss = gone from both lists. */
export const SET_OVERRIDE_KINDS = ['include', 'exclude', 'dismiss'] as const;
export type SetOverrideKind = (typeof SET_OVERRIDE_KINDS)[number];

export type CatalogRef = {
	bookId: string | null;
	essayId: string | null;
};

export type RuleCandidate = CatalogRef & {
	title: string;
	/** ISO timestamp of the catalog row (max across a collapsed series). */
	createdAt: string | null;
	/** Live series. Volumes that share a series and a title roll up to one row. */
	seriesId?: string | null;
	volumeNumber?: string | null;
	seriesAbbreviation?: string | null;
};

export type SetOverride = CatalogRef & {
	kind: SetOverrideKind;
	title: string | null;
	/** False keeps the book in the set and out of import / the bibliography. */
	bibliographical?: boolean;
	seriesId?: string | null;
	volumeNumber?: string | null;
	seriesAbbreviation?: string | null;
};

export type SetMemberAuthor = {
	personId: string;
	label: string;
};

export type ResolvedMember = CatalogRef & {
	title: string;
	/** Short author line ("First Last"). Null when the catalog row has no people. */
	authors: string | null;
	/** Linked people for the author line (library author filter). */
	authorLinks: SetMemberAuthor[];
	/** Catalog page for the title (book detail, or essay hash on the parent). */
	href: string | null;
	origin: 'rule' | 'include';
	isNew: boolean;
	/** False: still listed on the set, omitted from study import and auto-attach. */
	bibliographical: boolean;
	seriesId: string | null;
	volumeNumber: string | null;
	seriesAbbreviation: string | null;
	/** Every volume book in this row. The representative `bookId` is first. */
	volumeBookIds: string[];
	volumeCount: number;
};

export type ResourceSetListItem = {
	id: string;
	name: string;
	slug: string;
	kind: ResourceSetKind;
	sectionId: string;
	sortOrder: number;
	/** Bible book name when the set's first rule is `bible_book`. */
	bibleBook: string | null;
	memberCount: number;
	newCount: number;
};

export type ResourceSetSectionMeta = {
	id: string;
	name: string;
	slug: string;
	/** Kind assigned to sets created in this section. */
	setKind: ResourceSetKind;
	/** Bible-book commentary section. No new sets. */
	locked: boolean;
	sortOrder: number;
};

export type ResourceSetSectionGroup = ResourceSetSectionMeta & {
	items: ResourceSetListItem[];
};

/** Live slug. Empty when the name has no letters or digits. */
export function slugifyResourceName(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** Bible-book rows read as the book. The section already says what they are. */
export function resourceSetListLabel(item: Pick<ResourceSetListItem, 'name' | 'bibleBook'>): string {
	return item.bibleBook ?? item.name;
}

const MATTHEW_INDEX = BIBLE_BOOK_NAMES.indexOf('Matthew');

export function testamentOfBibleBook(name: string | null | undefined): 'ot' | 'nt' | null {
	if (!name) return null;
	const i = BIBLE_BOOK_NAMES.indexOf(name);
	if (i < 0) return null;
	return i < MATTHEW_INDEX ? 'ot' : 'nt';
}

export function filterResourceSetItems(
	items: ResourceSetListItem[],
	query: string
): ResourceSetListItem[] {
	const q = query.trim().toLowerCase();
	if (!q) return items;
	return items.filter((item) => {
		const label = resourceSetListLabel(item).toLowerCase();
		return label.includes(q) || item.name.toLowerCase().includes(q);
	});
}

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

function bibliographicalFor(overrides: SetOverride[], key: string): boolean {
	for (const o of overrides) {
		if (refKey(o) === key && o.bibliographical === false) return false;
	}
	return true;
}

export function resolveSetMembers(input: {
	candidates: RuleCandidate[];
	overrides: SetOverride[];
	lastReviewedAt: string | null;
}): { included: ResolvedMember[]; excluded: ResolvedMember[] } {
	const excludedKeys = new Set(
		input.overrides.filter((o) => o.kind === 'exclude' && refKey(o)).map((o) => refKey(o))
	);
	const dismissedKeys = new Set(
		input.overrides.filter((o) => o.kind === 'dismiss' && refKey(o)).map((o) => refKey(o))
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
		if (seen.has(key) || excludedKeys.has(key) || dismissedKeys.has(key)) continue;
		seen.add(key);
		included.push({
			bookId: c.bookId,
			essayId: c.essayId,
			title: c.title.trim() || 'Untitled',
			authors: null,
			authorLinks: [],
			href: null,
			origin: 'rule',
			isNew: isNewSince(c.createdAt, input.lastReviewedAt),
			bibliographical: bibliographicalFor(input.overrides, key),
			seriesId: c.seriesId ?? null,
			volumeNumber: c.volumeNumber ?? null,
			seriesAbbreviation: c.seriesAbbreviation ?? null,
			volumeBookIds: c.bookId ? [c.bookId] : [],
			volumeCount: c.bookId ? 1 : 0
		});
	}

	for (const o of input.overrides) {
		if (o.kind !== 'include') continue;
		const key = refKey(o);
		if (!key || seen.has(key) || excludedKeys.has(key) || dismissedKeys.has(key)) continue;
		seen.add(key);
		const cand = candidateByKey.get(key);
		included.push({
			bookId: o.bookId,
			essayId: o.essayId,
			title: (cand?.title ?? o.title ?? '').trim() || 'Untitled',
			authors: null,
			authorLinks: [],
			href: null,
			origin: 'include',
			isNew: false,
			bibliographical: o.bibliographical !== false,
			seriesId: cand?.seriesId ?? o.seriesId ?? null,
			volumeNumber: cand?.volumeNumber ?? o.volumeNumber ?? null,
			seriesAbbreviation: cand?.seriesAbbreviation ?? o.seriesAbbreviation ?? null,
			volumeBookIds: o.bookId ? [o.bookId] : [],
			volumeCount: o.bookId ? 1 : 0
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
			authors: null,
			authorLinks: [],
			href: null,
			origin: cand ? 'rule' : 'include',
			isNew: false,
			bibliographical: o.bibliographical !== false,
			seriesId: cand?.seriesId ?? o.seriesId ?? null,
			volumeNumber: cand?.volumeNumber ?? o.volumeNumber ?? null,
			seriesAbbreviation: cand?.seriesAbbreviation ?? o.seriesAbbreviation ?? null,
			volumeBookIds: o.bookId ? [o.bookId] : [],
			volumeCount: o.bookId ? 1 : 0
		});
	}

	return {
		included: collapseVolumeSets(included),
		excluded: collapseVolumeSets(excluded)
	};
}

function volumeGroupKey(member: ResolvedMember): string | null {
	if (!member.seriesId || member.essayId || !member.bookId) return null;
	const title = member.title.trim().toLowerCase().replace(/\s+/g, ' ');
	if (!title) return null;
	return `${member.seriesId}\n${title}`;
}

function volumeRank(volumeNumber: string | null): number {
	if (!volumeNumber) return Number.POSITIVE_INFINITY;
	const n = Number.parseInt(volumeNumber, 10);
	return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function mergeVolumeSet(group: ResolvedMember[]): ResolvedMember {
	const ranked = group.slice().sort((a, b) => {
		const byVolume = volumeRank(a.volumeNumber) - volumeRank(b.volumeNumber);
		if (byVolume !== 0) return byVolume;
		return (a.bookId ?? '').localeCompare(b.bookId ?? '');
	});
	const lead = ranked[0]!;
	const volumeBookIds = ranked.flatMap((member) => (member.bookId ? [member.bookId] : []));
	return {
		...lead,
		bookId: lead.bookId,
		isNew: group.some((member) => member.isNew),
		bibliographical: group.every((member) => member.bibliographical),
		origin: group.every((member) => member.origin === 'include') ? 'include' : 'rule',
		seriesAbbreviation: group.find((member) => member.seriesAbbreviation)?.seriesAbbreviation ?? null,
		volumeBookIds,
		volumeCount: volumeBookIds.length
	};
}

/** Same series and the same title (HALAT, TDNT) become one row. Different titles in a series stay separate. */
export function collapseVolumeSets(members: ResolvedMember[]): ResolvedMember[] {
	const groups = new Map<string, ResolvedMember[]>();
	const order: string[] = [];
	let solo = 0;
	for (const member of members) {
		const key = volumeGroupKey(member) ?? `solo:${solo++}`;
		if (!groups.has(key)) {
			groups.set(key, []);
			order.push(key);
		}
		groups.get(key)!.push(member);
	}
	const out: ResolvedMember[] = [];
	for (const key of order) {
		const group = groups.get(key)!;
		out.push(group.length > 1 && !key.startsWith('solo:') ? mergeVolumeSet(group) : group[0]!);
	}
	out.sort((a, b) => titleSortKey(a.title).localeCompare(titleSortKey(b.title)));
	return out;
}

export type VolumeSearchRow = {
	id: string;
	title: string;
	seriesId: string | null;
	volumeNumber: string | null;
	seriesAbbreviation: string | null;
};

export type VolumeSearchGroup = {
	id: string;
	title: string;
	bookIds: string[];
	seriesAbbreviation: string | null;
	volumeCount: number;
};

/** Search hits: same series and the same title become one add target. */
export function groupVolumeSearchHits(rows: VolumeSearchRow[]): VolumeSearchGroup[] {
	const seen = new Set<string>();
	const unique: VolumeSearchRow[] = [];
	for (const row of rows) {
		if (seen.has(row.id)) continue;
		seen.add(row.id);
		unique.push(row);
	}
	const groups = new Map<string, VolumeSearchRow[]>();
	const order: string[] = [];
	let solo = 0;
	for (const row of unique) {
		const title = row.title.trim().toLowerCase().replace(/\s+/g, ' ');
		const key = row.seriesId && title ? `${row.seriesId}\n${title}` : `solo:${solo++}`;
		if (!groups.has(key)) {
			groups.set(key, []);
			order.push(key);
		}
		groups.get(key)!.push(row);
	}
	const out: VolumeSearchGroup[] = [];
	for (const key of order) {
		const group = groups.get(key)!;
		const ranked = group.slice().sort((a, b) => {
			const byVolume = volumeRank(a.volumeNumber) - volumeRank(b.volumeNumber);
			if (byVolume !== 0) return byVolume;
			return a.id.localeCompare(b.id);
		});
		const lead = ranked[0]!;
		const bookIds = ranked.map((row) => row.id);
		out.push({
			id: lead.id,
			title: lead.title.trim() || 'Untitled',
			bookIds,
			seriesAbbreviation: ranked.find((row) => row.seriesAbbreviation)?.seriesAbbreviation ?? null,
			volumeCount: bookIds.length
		});
	}
	out.sort((a, b) => titleSortKey(a.title).localeCompare(titleSortKey(b.title)));
	return out;
}

export function citeableSetMembers<T extends { bibliographical: boolean }>(members: T[]): T[] {
	return members.filter((m) => m.bibliographical);
}

export function countNewMembers(included: ResolvedMember[]): number {
	return included.reduce((n, m) => n + (m.isNew ? 1 : 0), 0);
}

function bySetSort(a: ResourceSetListItem, b: ResourceSetListItem): number {
	if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
	return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function byCanon(a: ResourceSetListItem, b: ResourceSetListItem): number {
	const canon = new Map(BIBLE_BOOK_NAMES.map((name, i) => [name, i]));
	const ai = a.bibleBook ? (canon.get(a.bibleBook) ?? 999) : 999;
	const bi = b.bibleBook ? (canon.get(b.bibleBook) ?? 999) : 999;
	if (ai !== bi) return ai - bi;
	return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

export function groupResourceSetList(items: ResourceSetListItem[]): {
	bibleBooks: ResourceSetListItem[];
	language: ResourceSetListItem[];
	custom: ResourceSetListItem[];
} {
	return {
		bibleBooks: items.filter((i) => i.kind === 'bible_book').slice().sort(byCanon),
		language: items.filter((i) => i.kind === 'language').slice().sort(bySetSort),
		custom: items.filter((i) => i.kind === 'custom').slice().sort(bySetSort)
	};
}

/** Sections with no sets stay, so a new section is visible before its first set. */
export function groupSetsIntoSections(
	sections: ResourceSetSectionMeta[],
	items: ResourceSetListItem[]
): ResourceSetSectionGroup[] {
	const bySection = new Map<string, ResourceSetListItem[]>();
	for (const item of items) {
		const list = bySection.get(item.sectionId) ?? [];
		list.push(item);
		bySection.set(item.sectionId, list);
	}
	return sections
		.slice()
		.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
		.map((section) => {
			const raw = bySection.get(section.id) ?? [];
			const sorted =
				section.slug === 'bible-books' || section.setKind === 'bible_book'
					? raw.slice().sort(byCanon)
					: raw.slice().sort(bySetSort);
			return { ...section, items: sorted };
		});
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
