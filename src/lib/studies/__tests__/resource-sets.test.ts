import { describe, expect, it } from 'vitest';
import type { ByBookShelfHit } from '$lib/types/sermons';
import {
	candidatesFromCommentaryHits,
	countNewMembers,
	groupResourceSetList,
	parseResourceSetRules,
	resolveSetMembers,
	type ResourceSetListItem,
	type RuleCandidate,
	type SetOverride
} from '../resource-sets';

function cand(partial: Partial<RuleCandidate> & Pick<RuleCandidate, 'title'>): RuleCandidate {
	return {
		bookId: partial.bookId ?? null,
		essayId: partial.essayId ?? null,
		title: partial.title,
		createdAt: partial.createdAt ?? null
	};
}

function ov(
	kind: SetOverride['kind'],
	bookId: string,
	title: string | null = null
): SetOverride {
	return { kind, bookId, essayId: null, title };
}

describe('parseResourceSetRules', () => {
	it('keeps known kinds and drops junk', () => {
		expect(
			parseResourceSetRules([
				{ kind: 'bible_book', value: 'Romans' },
				{ kind: 'genre', value: '  Greek Language Tools  ' },
				{ kind: 'nope', value: 'x' },
				{ kind: 'topic', value: '' }
			])
		).toEqual([
			{ kind: 'bible_book', value: 'Romans' },
			{ kind: 'genre', value: 'Greek Language Tools' }
		]);
	});
});

describe('resolveSetMembers', () => {
	const candidates = [
		cand({ bookId: 'a', title: 'Alpha', createdAt: '2026-10-01T00:00:00Z' }),
		cand({ bookId: 'b', title: 'Beta', createdAt: '2026-10-18T00:00:00Z' })
	];

	it('returns rule matches and badges rows newer than last review', () => {
		const { included, excluded } = resolveSetMembers({
			candidates,
			overrides: [],
			lastReviewedAt: '2026-10-10T00:00:00Z'
		});
		expect(excluded).toEqual([]);
		expect(included.map((m) => [m.title, m.isNew])).toEqual([
			['Alpha', false],
			['Beta', true]
		]);
		expect(countNewMembers(included)).toBe(1);
	});

	it('treats a never-reviewed set as having no new rows', () => {
		const { included } = resolveSetMembers({
			candidates,
			overrides: [],
			lastReviewedAt: null
		});
		expect(countNewMembers(included)).toBe(0);
	});

	it('drops excludes and adds includes that are not rule matches', () => {
		const { included, excluded } = resolveSetMembers({
			candidates,
			overrides: [ov('exclude', 'a', 'Alpha'), ov('include', 'c', 'Gamma')],
			lastReviewedAt: null
		});
		expect(included.map((m) => m.title)).toEqual(['Beta', 'Gamma']);
		expect(included.find((m) => m.title === 'Gamma')?.origin).toBe('include');
		expect(excluded.map((m) => m.title)).toEqual(['Alpha']);
	});

	it('lets exclude win over a sticky include of the same book', () => {
		const { included, excluded } = resolveSetMembers({
			candidates: [],
			overrides: [ov('include', 'c', 'Gamma'), ov('exclude', 'c', 'Gamma')],
			lastReviewedAt: null
		});
		expect(included).toEqual([]);
		expect(excluded.map((m) => m.title)).toEqual(['Gamma']);
	});
});

describe('groupResourceSetList', () => {
	it('orders Bible books in canon order and buckets the other kinds', () => {
		const items: ResourceSetListItem[] = [
			item('language', 'OT language tools', 1),
			item('bible_book', 'Commentaries: Romans', 0, 'Romans'),
			item('custom', 'Systematic Theology', 0),
			item('bible_book', 'Commentaries: Genesis', 0, 'Genesis'),
			item('language', 'NT language tools', 0)
		];
		const grouped = groupResourceSetList(items);
		expect(grouped.bibleBooks.map((i) => i.bibleBook)).toEqual(['Genesis', 'Romans']);
		expect(grouped.language.map((i) => i.name)).toEqual([
			'NT language tools',
			'OT language tools'
		]);
		expect(grouped.custom.map((i) => i.name)).toEqual(['Systematic Theology']);
	});
});

describe('candidatesFromCommentaryHits', () => {
	it('collapses a series to one candidate and keeps the newest created_at', () => {
		const base = (title: string, createdAt: string): ByBookShelfHit & { createdAt: string } => ({
			kind: 'book',
			bookId: title,
			essayId: null,
			title,
			authorShort: null,
			seriesLabel: 'NICNT',
			seriesId: 'series-1',
			authorKey: 'person-1',
			rating: null,
			genre: 'Commentary',
			href: `/library/books/${title}`,
			createdAt
		});
		const out = candidatesFromCommentaryHits([
			base('Romans', '2020-01-01T00:00:00Z'),
			base('1 Corinthians', '2026-10-01T00:00:00Z')
		]);
		expect(out).toHaveLength(1);
		expect(out[0]?.createdAt).toBe('2026-10-01T00:00:00Z');
	});
});

function item(
	kind: ResourceSetListItem['kind'],
	name: string,
	sortOrder: number,
	bibleBook: string | null = null
): ResourceSetListItem {
	return {
		id: name,
		name,
		slug: name,
		kind,
		sortOrder,
		bibleBook,
		memberCount: 0,
		newCount: 0
	};
}
