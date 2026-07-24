import { describe, expect, it } from 'vitest';
import { courseSuggestions, resolveCourse, type CourseResolveInput } from '../course';

const courses: CourseResolveInput[] = [
	{ id: '1', name: 'Psalms and Wisdom Literature', code: 'OT512' },
	{ id: '2', name: 'Hebrews', code: null },
	{ id: '3', name: 'Greek Exegesis', code: 'NT502' }
];

describe('resolveCourse', () => {
	it('matches exact code case-insensitively', () => {
		expect(resolveCourse('ot512', courses)?.id).toBe('1');
		expect(resolveCourse('NT502', courses)?.id).toBe('3');
	});

	it('matches exact name case-insensitively', () => {
		expect(resolveCourse('hebrews', courses)?.id).toBe('2');
	});

	it('resolves unique prefixes on name or code', () => {
		expect(resolveCourse('Psalms', courses)?.id).toBe('1');
		expect(resolveCourse('OT5', courses)?.id).toBe('1');
		expect(resolveCourse('Greek', courses)?.id).toBe('3');
	});

	it('resolves unique substring when prefix fails', () => {
		expect(resolveCourse('Wisdom', courses)?.id).toBe('1');
	});

	it('returns null for unknown / ambiguous', () => {
		expect(resolveCourse('', courses)).toBeNull();
		expect(resolveCourse('xyzzy', courses)).toBeNull();
		// Both "Hebrews" and nothing else — wait, single. Use a fake collision:
		const collide: CourseResolveInput[] = [
			{ id: 'a', name: 'Greek I', code: 'NT501' },
			{ id: 'b', name: 'Greek II', code: 'NT502' }
		];
		expect(resolveCourse('Greek', collide)).toBeNull();
	});
});

describe('courseSuggestions', () => {
	it('labels with code when present', () => {
		expect(courseSuggestions('psalm', courses)).toEqual([
			'Psalms and Wisdom Literature (OT512)'
		]);
	});
});
