import { describe, expect, it } from 'vitest';
import {
	existingHouseholdIdForImport,
	householdNameFromPeople,
	parseSheet1Csv,
	parseUsAddressLine,
	splitCoupleName
} from '$lib/contacts/sheet-import';
import { matchVCardsToContacts, parseVCardFile } from '$lib/contacts/vcard';

describe('splitCoupleName', () => {
	it('splits shared last name', () => {
		expect(splitCoupleName('Tanner and Crystal Erisman')).toEqual([
			{ first_name: 'Tanner', last_name: 'Erisman' },
			{ first_name: 'Crystal', last_name: 'Erisman' }
		]);
	});
	it('inherits last name for second spouse', () => {
		expect(splitCoupleName('Jonathan Shaheen and Sara')).toEqual([
			{ first_name: 'Jonathan', last_name: 'Shaheen' },
			{ first_name: 'Sara', last_name: 'Shaheen' }
		]);
	});
	it('handles singles', () => {
		expect(splitCoupleName('Hannah Neathery')).toEqual([
			{ first_name: 'Hannah', last_name: 'Neathery' }
		]);
	});

	it('keeps compound last names', () => {
		expect(splitCoupleName('Hannah Ten Pas')).toEqual([
			{ first_name: 'Hannah', last_name: 'Ten Pas' }
		]);
	});

	it('strips Aunt/Uncle and inherits the shared last name', () => {
		expect(splitCoupleName('Aunt Mindy and Uncle Ric Schwab')).toEqual([
			{ first_name: 'Mindy', last_name: 'Schwab' },
			{ first_name: 'Ric', last_name: 'Schwab' }
		]);
	});

	it('keeps a parenthetical given name on first, surname last', () => {
		expect(splitCoupleName('Patrick (Weiqiang) Yu')).toEqual([
			{ first_name: 'Patrick (Weiqiang)', last_name: 'Yu' }
		]);
	});
});

describe('parseSheet1Csv', () => {
	it('parses grades and frequency letters', () => {
		const csv = `Name,Address,Retired?,Group,Giving,Relationship,Frequency
Tanner and Crystal Erisman,309 Weatherfield Pl. Lancaster PA 17603,,F&M,B,A,C
Benjamin Thomas,,,F&M,C,A,S
`;
		const rows = parseSheet1Csv(csv);
		expect(rows).toHaveLength(2);
		expect(rows[0]!.people).toHaveLength(2);
		expect(rows[0]!.frequency).toBe('common');
		expect(rows[0]!.giving).toBe('B');
		expect(rows[0]!.group).toBe('F&M');
		expect(rows[1]!.frequency).toBe('semiannual');
		expect(householdNameFromPeople(rows[0]!.people)).toBe('Tanner and Crystal Erisman');
	});

	it('accepts Semester as the S letter', () => {
		const csv = `Name,Frequency
Pat Lee,Semester
`;
		expect(parseSheet1Csv(csv)[0]!.frequency).toBe('semiannual');
	});
});

describe('parseUsAddressLine', () => {
	it('parses city state zip', () => {
		expect(parseUsAddressLine('309 Weatherfield Pl. Lancaster PA 17603')).toEqual({
			address_line_1: '309 Weatherfield Pl.',
			address_line_2: null,
			city: 'Lancaster',
			state: 'PA',
			postal_code: '17603',
			country: 'US'
		});
	});
});

describe('vcard', () => {
	it('parses FN N BDAY EMAIL', () => {
		const text = `BEGIN:VCARD
VERSION:3.0
N:Erisman;Tanner;;;
FN:Tanner Erisman
EMAIL:tanner@example.com
BDAY:19900315
END:VCARD
`;
		const cards = parseVCardFile(text);
		expect(cards).toHaveLength(1);
		expect(cards[0]!.first_name).toBe('Tanner');
		expect(cards[0]!.last_name).toBe('Erisman');
		expect(cards[0]!.birthday).toBe('1990-03-15');
		expect(cards[0]!.email).toBe('tanner@example.com');
	});

	it('matches by name', () => {
		const matches = matchVCardsToContacts(
			[{ fullName: 'Tanner Erisman', first_name: 'Tanner', last_name: 'Erisman', email: null, phone: null, birthday: null }],
			[{ id: '1', first_name: 'Tanner', last_name: 'Erisman', display_name: 'Tanner Erisman' }]
		);
		expect(matches[0]!.contactId).toBe('1');
	});
});

describe('existingHouseholdIdForImport', () => {
	it('returns the first existing household_id among partial matches', () => {
		expect(
			existingHouseholdIdForImport([
				undefined,
				{ household_id: 'hh-existing' },
				{ household_id: null }
			])
		).toBe('hh-existing');
	});

	it('returns null when nobody is attached yet', () => {
		expect(
			existingHouseholdIdForImport([undefined, { household_id: null }])
		).toBeNull();
	});
});
