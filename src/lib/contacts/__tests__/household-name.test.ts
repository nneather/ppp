import { describe, expect, it } from 'vitest';
import { suggestHouseholdName } from '$lib/contacts/names';

const p = (first_name: string, last_name: string | null = null) => ({ first_name, last_name });

describe('suggestHouseholdName', () => {
	it('one person is just their name', () => {
		expect(suggestHouseholdName([p('Jordan', 'Gibbs')])).toBe('Jordan Gibbs');
	});
	it('shared last name → "A and B Last"', () => {
		expect(suggestHouseholdName([p('Jordan', 'Gibbs'), p('Taylor', 'Gibbs')])).toBe(
			'Jordan and Taylor Gibbs'
		);
	});
	it('different last names → full names', () => {
		expect(suggestHouseholdName([p('Ben', 'Kroese'), p('Claire', 'Kilgore')])).toBe(
			'Ben Kroese and Claire Kilgore'
		);
	});
	it('three people → commas', () => {
		expect(suggestHouseholdName([p('A', 'Smith'), p('B', 'Smith'), p('C', 'Smith')])).toBe(
			'A, B and C Smith'
		);
	});
	it('ignores blank first names; empty → ""', () => {
		expect(suggestHouseholdName([p('  ', 'X')])).toBe('');
	});
});
