import { describe, expect, it } from 'vitest';
import { groupPaperSources, type PaperGroupView } from '../paper-sources';

function grp(id: string, name: string, sort_order: number): PaperGroupView {
	return { id, name, sort_order };
}

function src(id: string, groupId: string | null) {
	return { id, groupId };
}

describe('groupPaperSources', () => {
	it('returns a single ungrouped bucket when there are no groups', () => {
		const sources = [src('a', null), src('b', null)];
		const buckets = groupPaperSources(sources, []);
		expect(buckets).toHaveLength(1);
		expect(buckets[0].group).toBeNull();
		expect(buckets[0].sources.map((s) => s.id)).toEqual(['a', 'b']);
	});

	it('puts ungrouped first, then groups in the given order', () => {
		const groups = [grp('g1', 'Primary', 0), grp('g2', 'Commentaries', 1)];
		const sources = [src('a', 'g2'), src('b', null), src('c', 'g1'), src('d', 'g1')];
		const buckets = groupPaperSources(sources, groups);
		expect(buckets.map((b) => b.group?.id ?? null)).toEqual([null, 'g1', 'g2']);
		expect(buckets[0].sources.map((s) => s.id)).toEqual(['b']);
		expect(buckets[1].sources.map((s) => s.id)).toEqual(['c', 'd']);
		expect(buckets[2].sources.map((s) => s.id)).toEqual(['a']);
	});

	it('keeps empty groups as empty buckets', () => {
		const groups = [grp('g1', 'Primary', 0)];
		const buckets = groupPaperSources([src('a', null)], groups);
		expect(buckets).toHaveLength(2);
		expect(buckets[1].group?.id).toBe('g1');
		expect(buckets[1].sources).toEqual([]);
	});

	it('falls back to ungrouped when a source points at a group that is not live', () => {
		const groups = [grp('g1', 'Primary', 0)];
		const sources = [src('a', 'gone'), src('b', 'g1')];
		const buckets = groupPaperSources(sources, groups);
		expect(buckets[0].sources.map((s) => s.id)).toEqual(['a']);
		expect(buckets[1].sources.map((s) => s.id)).toEqual(['b']);
	});

	it('preserves relative source order inside each bucket', () => {
		const groups = [grp('g1', 'Primary', 0)];
		const sources = [src('c', 'g1'), src('a', 'g1'), src('b', 'g1')];
		const buckets = groupPaperSources(sources, groups);
		expect(buckets[1].sources.map((s) => s.id)).toEqual(['c', 'a', 'b']);
	});
});
