import { describe, expect, it } from 'vitest';
import { buildDomainColorByProjectId } from '$lib/projects/project-colors';

describe('buildDomainColorByProjectId', () => {
	it('maps children to root domain color', () => {
		const map = buildDomainColorByProjectId([
			{ id: 'work', parent_id: null, color: 'ocean' },
			{ id: 'edu', parent_id: null, color: 'amber' },
			{ id: 'inbox', parent_id: 'work', color: null },
			{ id: 'nested', parent_id: 'inbox', color: 'rose' }
		]);
		expect(map.work).toBe('ocean');
		expect(map.inbox).toBe('ocean');
		expect(map.nested).toBe('ocean');
		expect(map.edu).toBe('amber');
	});

	it('returns null when root has no color', () => {
		const map = buildDomainColorByProjectId([
			{ id: 'root', parent_id: null, color: null },
			{ id: 'child', parent_id: 'root', color: 'teal' }
		]);
		expect(map.root).toBeNull();
		expect(map.child).toBeNull();
	});
});
