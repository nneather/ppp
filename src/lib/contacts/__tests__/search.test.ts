import { describe, expect, it } from 'vitest';
import {
	contactMatchesQuery,
	haystackFromParts,
	householdMatchesQuery,
	nameLetterHeader,
	queryMatchesHaystack,
	tokenizeContactQuery
} from '$lib/contacts/search';

const tom = {
	display_name: 'Tom Jones',
	first_name: 'Tom',
	last_name: 'Jones',
	household_name: 'The Jones Family',
	email: 'tom@example.com',
	phone: '(214) 555-0199'
};

describe('tokenizeContactQuery', () => {
	it('splits on whitespace and lowercases', () => {
		expect(tokenizeContactQuery('  Tom   JONES ')).toEqual(['tom', 'jones']);
	});
});

describe('queryMatchesHaystack', () => {
	it('empty query matches everything', () => {
		expect(queryMatchesHaystack('', 'tom jones')).toBe(true);
		expect(queryMatchesHaystack('   ', 'tom jones')).toBe(true);
	});

	it('requires every token (AND)', () => {
		const hay = haystackFromParts(['Tom Jones', 'The Jones Family']);
		expect(queryMatchesHaystack('tom', hay)).toBe(true);
		expect(queryMatchesHaystack('jones', hay)).toBe(true);
		expect(queryMatchesHaystack('tom jo', hay)).toBe(true);
		expect(queryMatchesHaystack('tom smith', hay)).toBe(false);
	});
});

describe('contactMatchesQuery', () => {
	it('matches last name, household, email, and list', () => {
		expect(contactMatchesQuery(tom, 'jones')).toBe(true);
		expect(contactMatchesQuery(tom, 'family')).toBe(true);
		expect(contactMatchesQuery(tom, 'tom@example')).toBe(true);
		expect(contactMatchesQuery(tom, 'church', ['Church'])).toBe(true);
		expect(contactMatchesQuery(tom, 'zzz')).toBe(false);
	});

	it('matches phone digits without punctuation', () => {
		expect(contactMatchesQuery(tom, '214555')).toBe(true);
		expect(contactMatchesQuery(tom, '555-0199')).toBe(true);
	});
});

describe('householdMatchesQuery', () => {
	const hh = {
		name: 'The Jones Family',
		address_line_1: '123 Main St',
		address_line_2: null,
		city: 'Dallas',
		state: 'TX',
		postal_code: '75201',
		notes: null
	};

	it('matches name, address, members, and lists', () => {
		expect(householdMatchesQuery(hh, 'jones')).toBe(true);
		expect(householdMatchesQuery(hh, 'dallas')).toBe(true);
		expect(householdMatchesQuery(hh, '75201')).toBe(true);
		expect(householdMatchesQuery(hh, 'tom', { memberNames: ['Tom Jones'] })).toBe(true);
		expect(householdMatchesQuery(hh, 'christmas', { listNames: ['Christmas cards'] })).toBe(
			true
		);
		expect(householdMatchesQuery(hh, 'austin')).toBe(false);
	});
});

describe('nameLetterHeader', () => {
	it('uses last name, then first, then #', () => {
		expect(nameLetterHeader('Jones', 'Tom')).toBe('J');
		expect(nameLetterHeader(null, 'Madonna')).toBe('M');
		expect(nameLetterHeader('  ', '')).toBe('#');
		expect(nameLetterHeader('neathery')).toBe('N');
	});
});
