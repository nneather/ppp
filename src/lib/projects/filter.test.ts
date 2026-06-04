import { describe, expect, it } from 'vitest';
import {
	ATTENTION_HEALTH,
	trendDirection,
	parseProjectFilters,
	isDefaultLifecycleFilter,
	countActiveProjectFilters,
	hasActiveProjectFilters,
	matchesFilter,
	computeVisibleNodeIds
} from '$lib/projects/filter';
import { DEFAULT_VISIBLE_LIFECYCLES } from '$lib/types/projects';
import type { LatestHealth, ProjectNode } from '$lib/types/projects';

function node(
	overrides: Partial<ProjectNode> & Pick<ProjectNode, 'id' | 'name'>
): ProjectNode {
	return {
		parent_id: null,
		description: null,
		lifecycle_status: 'active',
		start_date: null,
		end_date: null,
		sort_order: 0,
		depth: 0,
		children: [],
		...overrides
	};
}

describe('trendDirection', () => {
	it('returns none when no latest health', () => {
		expect(trendDirection(undefined)).toBe('none');
	});

	it('returns none with only one update', () => {
		const latest: LatestHealth = {
			health_status: 'watch',
			week_of: '2026-06-01',
			previous: null
		};
		expect(trendDirection(latest)).toBe('none');
	});

	it('returns up when health improved (lower rank index)', () => {
		expect(
			trendDirection({
				health_status: 'satisfactory',
				week_of: '2026-06-07',
				previous: 'watch'
			})
		).toBe('up');
	});

	it('returns down when health worsened', () => {
		expect(
			trendDirection({
				health_status: 'critical',
				week_of: '2026-06-07',
				previous: 'satisfactory'
			})
		).toBe('down');
	});

	it('returns flat when unchanged', () => {
		expect(
			trendDirection({
				health_status: 'watch',
				week_of: '2026-06-07',
				previous: 'watch'
			})
		).toBe('flat');
	});
});

describe('parseProjectFilters', () => {
	it('defaults lifecycle to active+paused+idea', () => {
		const f = parseProjectFilters(new URLSearchParams());
		expect(f.lifecycle).toEqual(new Set(['active', 'paused', 'idea']));
		expect(f.health).toBeNull();
		expect(f.domain).toBeNull();
	});

	it('parses attention health and domain', () => {
		const f = parseProjectFilters(new URLSearchParams('health=attention&domain=Work'));
		expect(f.health).toBe('attention');
		expect(f.domain).toBe('Work');
	});

	it('parses comma-separated lifecycle', () => {
		const f = parseProjectFilters(new URLSearchParams('lifecycle=done,archived'));
		expect(f.lifecycle).toEqual(new Set(['done', 'archived']));
	});
});

describe('active filter helpers', () => {
	it('isDefaultLifecycleFilter matches DEFAULT_VISIBLE_LIFECYCLES', () => {
		expect(isDefaultLifecycleFilter(DEFAULT_VISIBLE_LIFECYCLES)).toBe(true);
		expect(isDefaultLifecycleFilter(new Set(['done', 'archived']))).toBe(false);
	});

	it('countActiveProjectFilters returns 0 for defaults', () => {
		expect(countActiveProjectFilters(parseProjectFilters(new URLSearchParams()))).toBe(0);
	});

	it('counts health, domain, and non-default lifecycle', () => {
		expect(
			countActiveProjectFilters(
				parseProjectFilters(new URLSearchParams('health=attention&domain=Work'))
			)
		).toBe(2);
		expect(
			countActiveProjectFilters(parseProjectFilters(new URLSearchParams('lifecycle=done')))
		).toBe(1);
	});

	it('hasActiveProjectFilters reflects count', () => {
		expect(hasActiveProjectFilters(new URLSearchParams())).toBe(false);
		expect(hasActiveProjectFilters(new URLSearchParams('health=watch'))).toBe(true);
	});
});

describe('matchesFilter', () => {
	const work = node({ id: 'work', name: 'Work', parent_id: null, depth: 0 });
	const child = node({
		id: 'c1',
		name: 'Internship',
		parent_id: 'work',
		depth: 1,
		lifecycle_status: 'active'
	});
	work.children = [child];

	const latest: LatestHealth = {
		health_status: 'watch',
		week_of: '2026-06-01',
		previous: 'satisfactory'
	};

	it('attention filter matches watch/serious/critical', () => {
		expect(
			matchesFilter(child, latest, {
				lifecycle: new Set(['active']),
				health: 'attention',
				domain: null
			})
		).toBe(true);
		expect(ATTENTION_HEALTH.has('watch')).toBe(true);
	});

	it('excludes nodes without updates for specific health filter', () => {
		expect(
			matchesFilter(child, undefined, {
				lifecycle: new Set(['active']),
				health: 'watch',
				domain: null
			})
		).toBe(false);
	});
});

describe('computeVisibleNodeIds', () => {
	it('includes ancestors when child matches', () => {
		const domain = node({ id: 'd', name: 'Work', parent_id: null, depth: 0 });
		const child = node({
			id: 'c',
			name: 'Child',
			parent_id: 'd',
			depth: 1,
			lifecycle_status: 'active'
		});
		domain.children = [child];
		const tree = [domain];
		const latest: Record<string, LatestHealth> = {
			c: { health_status: 'watch', week_of: '2026-06-01', previous: null }
		};
		const filters = parseProjectFilters(new URLSearchParams('health=attention'));
		const visible = computeVisibleNodeIds(tree, latest, filters);
		expect(visible.has('d')).toBe(true);
		expect(visible.has('c')).toBe(true);
	});
});
