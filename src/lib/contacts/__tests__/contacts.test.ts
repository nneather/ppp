import { describe, expect, it } from 'vitest';
import {
	contactDisplayName,
	effectiveCadenceDays,
	formatHouseholdAddress,
	householdNameFromContact
} from '$lib/contacts/names';
import {
	daysOverdueForContact,
	householdEligibleForCardList,
	isContactDue,
	selectContactsDue
} from '$lib/contacts/due';
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
		expect(listMemberToColumns({ kind: 'contact', contact_id: contactId })).toEqual({
			contact_id: contactId,
			household_id: null
		});
		expect(listMemberToColumns({ kind: 'household', household_id: householdId })).toEqual({
			contact_id: null,
			household_id: householdId
		});
	});
	it('rejects missing id', () => {
		expect(() => validateListMemberXor({ kind: 'contact', contact_id: '' })).toThrow();
	});
});

describe('isContactDue / daysOverdueForContact', () => {
	const today = '2026-07-24';

	it('treats never-touched active as due', () => {
		expect(
			isContactDue({
				status: 'active',
				no_reminders: false,
				last_touched_on: null,
				effective_cadence_days: 90,
				todayYmd: today
			})
		).toBe(true);
		expect(daysOverdueForContact(null, 90, today)).toBeNull();
	});

	it('excludes no_reminders and retired', () => {
		expect(
			isContactDue({
				status: 'active',
				no_reminders: true,
				last_touched_on: null,
				effective_cadence_days: 90,
				todayYmd: today
			})
		).toBe(false);
		expect(
			isContactDue({
				status: 'retired',
				no_reminders: false,
				last_touched_on: null,
				effective_cadence_days: 90,
				todayYmd: today
			})
		).toBe(false);
	});

	it('is due when last touch is exactly cadence days ago', () => {
		expect(daysOverdueForContact('2026-04-25', 90, today)).toBe(0);
		expect(
			isContactDue({
				status: 'active',
				no_reminders: false,
				last_touched_on: '2026-04-25',
				effective_cadence_days: 90,
				todayYmd: today
			})
		).toBe(true);
	});

	it('is not due inside the cadence window', () => {
		expect(daysOverdueForContact('2026-07-01', 90, today)).toBeLessThan(0);
		expect(
			isContactDue({
				status: 'active',
				no_reminders: false,
				last_touched_on: '2026-07-01',
				effective_cadence_days: 90,
				todayYmd: today
			})
		).toBe(false);
	});
});

describe('selectContactsDue', () => {
	it('sorts never-touched first then most overdue', () => {
		const rows = selectContactsDue(
			[
				{
					id: 'a',
					display_name: 'Alice',
					effective_cadence_days: 90,
					last_touched_on: '2026-01-01',
					household_name: null,
					no_reminders: false,
					status: 'active'
				},
				{
					id: 'b',
					display_name: 'Bob',
					effective_cadence_days: 90,
					last_touched_on: null,
					household_name: null,
					no_reminders: false,
					status: 'active'
				},
				{
					id: 'c',
					display_name: 'Carol',
					effective_cadence_days: 90,
					last_touched_on: '2026-07-01',
					household_name: null,
					no_reminders: false,
					status: 'active'
				}
			],
			{ todayYmd: '2026-07-24', limit: 10 }
		);
		expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
		expect(rows[0]!.days_overdue).toBeNull();
		expect(rows[1]!.days_overdue).toBeGreaterThan(0);
	});
});

describe('householdEligibleForCardList (C2)', () => {
	it('requires at least one active member', () => {
		expect(
			householdEligibleForCardList({
				liveMembers: [{ status: 'retired' }, { status: 'retired' }]
			})
		).toBe(false);
		expect(
			householdEligibleForCardList({
				liveMembers: [{ status: 'retired' }, { status: 'active' }]
			})
		).toBe(true);
		expect(householdEligibleForCardList({ liveMembers: [] })).toBe(false);
	});
});
