import { describe, expect, it } from 'vitest';
import {
	contactDisplayName,
	effectiveCadenceDays,
	formatHouseholdAddress,
	householdNameFromContact
} from '$lib/contacts/names';
import { listMemberToColumns, validateListMemberXor } from '$lib/contacts/list-member';

describe('contactDisplayName', () => {
	it('joins first and last', () => {
		expect(contactDisplayName({ first_name: 'Tom', last_name: 'Jones' })).toBe('Tom Jones');
	});
	it('uses first alone when last missing', () => {
		expect(contactDisplayName({ first_name: 'Madonna', last_name: null })).toBe('Madonna');
	});
});

describe('householdNameFromContact', () => {
	it('matches display name for household-of-one', () => {
		expect(householdNameFromContact({ first_name: 'Sarah', last_name: 'Lee' })).toBe(
			'Sarah Lee'
		);
	});
});

describe('effectiveCadenceDays', () => {
	it('prefers contact override', () => {
		expect(effectiveCadenceDays(30, 90)).toBe(30);
	});
	it('falls back to profile default', () => {
		expect(effectiveCadenceDays(null, 60)).toBe(60);
	});
	it('falls back to app constant 90', () => {
		expect(effectiveCadenceDays(null, null)).toBe(90);
	});
	it('ignores non-positive values', () => {
		expect(effectiveCadenceDays(0, -5)).toBe(90);
	});
});

describe('formatHouseholdAddress', () => {
	it('formats city/state/postal', () => {
		expect(
			formatHouseholdAddress({
				address_line_1: '123 Main St',
				address_line_2: null,
				city: 'Madison',
				state: 'WI',
				postal_code: '53703',
				country: 'US'
			})
		).toBe('123 Main St · Madison, WI 53703');
	});
	it('returns null when empty', () => {
		expect(
			formatHouseholdAddress({
				address_line_1: null,
				address_line_2: null,
				city: null,
				state: null,
				postal_code: null,
				country: null
			})
		).toBeNull();
	});
});

describe('validateListMemberXor', () => {
	const contactId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
	const householdId = '11111111-2222-3333-4444-555555555555';

	it('accepts contact', () => {
		expect(validateListMemberXor({ kind: 'contact', contact_id: contactId })).toEqual({
			kind: 'contact',
			contact_id: contactId
		});
	});
	it('accepts household', () => {
		expect(validateListMemberXor({ kind: 'household', household_id: householdId })).toEqual({
			kind: 'household',
			household_id: householdId
		});
	});
	it('maps to columns', () => {
		expect(
			listMemberToColumns({ kind: 'contact', contact_id: contactId })
		).toEqual({ contact_id: contactId, household_id: null });
		expect(
			listMemberToColumns({ kind: 'household', household_id: householdId })
		).toEqual({ contact_id: null, household_id: householdId });
	});
	it('rejects missing id', () => {
		expect(() => validateListMemberXor({ kind: 'contact', contact_id: '' })).toThrow();
	});
});
