import { describe, expect, it } from 'vitest';
import {
	healthChangedThisWeek,
	projectSuggestions,
	resolveProject,
	type ProjectResolveInput
} from '../project';

const projects: ProjectResolveInput[] = [
	{ id: '11111111-1111-4111-8111-111111111111', name: 'Education' },
	{ id: '22222222-2222-4222-8222-222222222222', name: 'Summer Hebrew' },
	{ id: '33333333-3333-4333-8333-333333333333', name: 'Summer Greek' },
	{ id: '44444444-4444-4444-8444-444444444444', name: 'Personal' }
];

describe('resolveProject', () => {
	it('matches exact UUID', () => {
		expect(resolveProject('11111111-1111-4111-8111-111111111111', projects)?.name).toBe(
			'Education'
		);
	});

	it('returns null for unknown UUID', () => {
		expect(resolveProject('99999999-9999-4999-8999-999999999999', projects)).toBeNull();
	});

	it('matches exact name case-insensitively', () => {
		expect(resolveProject('education', projects)?.id).toBe(
			'11111111-1111-4111-8111-111111111111'
		);
	});

	it('resolves unique prefixes', () => {
		expect(resolveProject('Person', projects)?.name).toBe('Personal');
	});

	it('resolves unique substring when prefix fails', () => {
		expect(resolveProject('Hebrew', projects)?.name).toBe('Summer Hebrew');
	});

	it('returns null for unknown / ambiguous', () => {
		expect(resolveProject('', projects)).toBeNull();
		expect(resolveProject('xyzzy', projects)).toBeNull();
		expect(resolveProject('Summer', projects)).toBeNull();
	});
});

describe('projectSuggestions', () => {
	it('lists name hits', () => {
		expect(projectSuggestions('Summer', projects)).toEqual([
			'Summer Hebrew',
			'Summer Greek'
		]);
	});
});

describe('healthChangedThisWeek', () => {
	it('true only when both present and unequal', () => {
		expect(healthChangedThisWeek('serious', 'watch')).toBe(true);
		expect(healthChangedThisWeek('watch', 'watch')).toBe(false);
		expect(healthChangedThisWeek('watch', null)).toBe(false);
		expect(healthChangedThisWeek(null, 'watch')).toBe(false);
		expect(healthChangedThisWeek(null, null)).toBe(false);
	});
});
