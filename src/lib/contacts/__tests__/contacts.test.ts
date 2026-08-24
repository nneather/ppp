import { describe, expect, it } from 'vitest';
import {
	cadenceToDays,
	daysToCadence,
	formatCadenceLabel
} from '$lib/contacts/cadence';
import {
	contactDisplayName,
	effectiveCadenceDays,
	formatEffectiveCadence,
	formatHouseholdAddress,
	householdNameFromContact
} from '$lib/contacts/names';
import {
	computePaceSummary,
	dueFanoutContactIds,
	householdEligibleForCardList,
	isContactDueForPeriod,
	selectContactsDue
} from '$lib/contacts/due';
import {
	filterContactListCandidates,
	filterHouseholdListCandidates,
	householdHasMailingAddress
} from '$lib/contacts/list-candidates';
import { listMemberToColumns, validateListMemberXor } from '$lib/contacts/list-member';
import {
	activePeriodForFrequency,
	periodFromKey,
	recentClosedPeriods,
	touchFulfillsPeriod
} from '$lib/contacts/period';

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

describe('cadence months/years ↔ days', () => {
	it('converts months and years to day-equivalent', () => {
		expect(cadenceToDays(3, 'months')).toBe(90);
		expect(cadenceToDays(1, 'years')).toBe(365);
		expect(cadenceToDays(2, 'years')).toBe(730);
	});
	it('rejects non-positive amounts', () => {
		expect(() => cadenceToDays(0, 'months')).toThrow();
	});
	it('round-trips exact multiples', () => {
		expect(daysToCadence(90)).toEqual({ amount: 3, unit: 'months' });
		expect(daysToCadence(365)).toEqual({ amount: 1, unit: 'years' });
		expect(daysToCadence(null)).toBeNull();
	});
	it('formats labels for UI', () => {
		expect(formatCadenceLabel(90)).toBe('3 months');
		expect(formatCadenceLabel(365)).toBe('1 year');
		expect(formatCadenceLabel(30)).toBe('1 month');
		expect(formatEffectiveCadence(90)).toBe('every 3 months');
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

describe('period due (isContactDueForPeriod + selectContactsDue)', () => {
	const today = '2026-08-24';

	it('treats quarterly never-touched as due (on-ramp Q4)', () => {
		const r = isContactDueForPeriod({
			status: 'active',
			frequency: 'quarterly',
			last_touched_on: null,
			skipped_period_keys: [],
			todayYmd: today
		});
		expect(r.due).toBe(true);
		expect(r.period?.key).toBe('q:2026-Q4');
	});

	it('excludes common, none, and retired', () => {
		expect(
			isContactDueForPeriod({
				status: 'active',
				frequency: 'common',
				last_touched_on: null,
				skipped_period_keys: [],
				todayYmd: today
			}).due
		).toBe(false);
		expect(
			isContactDueForPeriod({
				status: 'active',
				frequency: 'none',
				last_touched_on: null,
				skipped_period_keys: [],
				todayYmd: today
			}).due
		).toBe(false);
		expect(
			isContactDueForPeriod({
				status: 'retired',
				frequency: 'quarterly',
				last_touched_on: null,
				skipped_period_keys: [],
				todayYmd: today
			}).due
		).toBe(false);
	});

	it('fulfills when meet is inside the active period', () => {
		expect(
			isContactDueForPeriod({
				status: 'active',
				frequency: 'quarterly',
				last_touched_on: '2026-08-01',
				skipped_period_keys: [],
				todayYmd: today
			}).due
		).toBe(false);
	});

	it('stays due when last meet was before the period', () => {
		expect(
			isContactDueForPeriod({
				status: 'active',
				frequency: 'quarterly',
				last_touched_on: '2026-06-01',
				skipped_period_keys: [],
				todayYmd: today
			}).due
		).toBe(true);
	});

	it('skips when period_key is in skipped set', () => {
		expect(
			isContactDueForPeriod({
				status: 'active',
				frequency: 'quarterly',
				last_touched_on: null,
				skipped_period_keys: ['q:2026-Q4'],
				todayYmd: today
			}).due
		).toBe(false);
	});

	it('sorts oldest last-meet first and collapses households', () => {
		const rows = selectContactsDue(
			[
				{
					id: 'a',
					display_name: 'Alice',
					frequency: 'quarterly',
					last_touched_on: '2026-01-01',
					household_id: 'hh1',
					household_name: 'The Smiths',
					skipped_period_keys: [],
					status: 'active',
					giving_grade: 'B',
					relationship_grade: 'A'
				},
				{
					id: 'a2',
					display_name: 'Adam',
					frequency: 'quarterly',
					last_touched_on: null,
					household_id: 'hh1',
					household_name: 'The Smiths',
					skipped_period_keys: [],
					status: 'active',
					giving_grade: 'B',
					relationship_grade: 'A'
				},
				{
					id: 'b',
					display_name: 'Bob',
					frequency: 'quarterly',
					last_touched_on: null,
					household_id: null,
					household_name: null,
					skipped_period_keys: [],
					status: 'active',
					giving_grade: null,
					relationship_grade: null
				},
				{
					id: 'c',
					display_name: 'Carol',
					frequency: 'quarterly',
					last_touched_on: '2026-08-01',
					household_id: null,
					household_name: null,
					skipped_period_keys: [],
					status: 'active',
					giving_grade: null,
					relationship_grade: null
				}
			],
			{ todayYmd: today, limit: 10 }
		);
		// Carol fulfilled; Alice+Adam collapse to one household (null last-meet wins)
		expect(rows).toHaveLength(2);
		expect(rows.map((r) => r.display_name).sort()).toEqual(['Bob', 'The Smiths']);
		const smiths = rows.find((r) => r.display_name === 'The Smiths');
		expect(smiths?.contact_id).toBe('a2');
	});

	it('treats a 2026 meet as fulfilling a:2027 (pre-start)', () => {
		expect(
			isContactDueForPeriod({
				status: 'active',
				frequency: 'annual',
				last_touched_on: '2026-08-24',
				skipped_period_keys: [],
				todayYmd: today
			}).due
		).toBe(false);
		expect(
			isContactDueForPeriod({
				status: 'active',
				frequency: 'annual',
				last_touched_on: null,
				skipped_period_keys: [],
				todayYmd: today
			}).due
		).toBe(true);
	});

	it('clears annual due when a:2027 is skipped in 2026', () => {
		expect(
			isContactDueForPeriod({
				status: 'active',
				frequency: 'annual',
				last_touched_on: null,
				skipped_period_keys: ['a:2027'],
				todayYmd: today
			}).due
		).toBe(false);
	});
});

describe('touchFulfillsPeriod pre-start annual', () => {
	const annual = activePeriodForFrequency('annual', '2026-08-24');

	it('counts 2026-01-01 through period end toward a:2027', () => {
		expect(touchFulfillsPeriod('2026-01-01', annual)).toBe(true);
		expect(touchFulfillsPeriod('2026-08-24', annual)).toBe(true);
		expect(touchFulfillsPeriod('2027-06-01', annual)).toBe(true);
		expect(touchFulfillsPeriod('2027-12-31', annual)).toBe(true);
	});

	it('does not count 2025 or after 2027', () => {
		expect(touchFulfillsPeriod('2025-12-31', annual)).toBe(false);
		expect(touchFulfillsPeriod('2028-01-01', annual)).toBe(false);
		expect(touchFulfillsPeriod(null, annual)).toBe(false);
	});

	it('does not pre-start quarterly (June stay unfulfilled for Jul–Dec on-ramp)', () => {
		const q = activePeriodForFrequency('quarterly', '2026-08-24');
		expect(touchFulfillsPeriod('2026-06-01', q)).toBe(false);
		expect(touchFulfillsPeriod('2026-07-01', q)).toBe(true);
	});
});

describe('dueFanoutContactIds (couple Log/Skip contract)', () => {
	const members = [
		{
			id: 'alice',
			household_id: 'hh1',
			status: 'active' as const,
			frequency: 'quarterly' as const
		},
		{
			id: 'adam',
			household_id: 'hh1',
			status: 'active' as const,
			frequency: 'annual' as const
		},
		{
			id: 'common',
			household_id: 'hh1',
			status: 'active' as const,
			frequency: 'common' as const
		},
		{
			id: 'retired',
			household_id: 'hh1',
			status: 'retired' as const,
			frequency: 'quarterly' as const
		},
		{
			id: 'other-hh',
			household_id: 'hh2',
			status: 'active' as const,
			frequency: 'quarterly' as const
		}
	];

	it('fans out to active scheduled household members only', () => {
		expect(
			dueFanoutContactIds({ contact_id: 'alice', household_id: 'hh1' }, members).sort()
		).toEqual(['adam', 'alice']);
	});

	it('returns the posted contact when no household', () => {
		expect(
			dueFanoutContactIds({ contact_id: 'bob', household_id: null }, members)
		).toEqual(['bob']);
	});
});

describe('computePaceSummary (uncapped remaining)', () => {
	it('counts remaining from the full due set, not the display slice', () => {
		const rows = selectContactsDue(
			Array.from({ length: 12 }, (_, i) => ({
				id: `c${i}`,
				display_name: `Person ${String(i).padStart(2, '0')}`,
				frequency: 'quarterly' as const,
				last_touched_on: null,
				household_id: null,
				household_name: null,
				skipped_period_keys: [],
				status: 'active' as const,
				giving_grade: null,
				relationship_grade: null
			})),
			{ todayYmd: '2026-08-24', limit: 5 }
		);
		expect(rows).toHaveLength(5);
		const all = selectContactsDue(
			Array.from({ length: 12 }, (_, i) => ({
				id: `c${i}`,
				display_name: `Person ${String(i).padStart(2, '0')}`,
				frequency: 'quarterly' as const,
				last_touched_on: null,
				household_id: null,
				household_name: null,
				skipped_period_keys: [],
				status: 'active' as const,
				giving_grade: null,
				relationship_grade: null
			})),
			{ todayYmd: '2026-08-24' }
		);
		expect(computePaceSummary(all, 12)).toEqual({ remaining: 12, total: 12 });
		expect(computePaceSummary(rows, 12)).toEqual({ remaining: 5, total: 12 });
	});
});

describe('activePeriodForFrequency on-ramp', () => {
	it('keeps Q and S on H2/Q4 through end of 2026', () => {
		expect(activePeriodForFrequency('quarterly', '2026-08-24').key).toBe('q:2026-Q4');
		expect(activePeriodForFrequency('semiannual', '2026-08-24').key).toBe('s:2026-H2');
		expect(activePeriodForFrequency('annual', '2026-08-24').key).toBe('a:2027');
		expect(activePeriodForFrequency('annual', '2026-08-24').end).toBe('2027-12-31');
	});

	it('scores closed q:2026-Q4 via the Jul–Dec on-ramp window', () => {
		const closed = recentClosedPeriods('quarterly', '2027-01-15', 2);
		expect(closed[0]?.key).toBe('q:2026-Q4');
		expect(closed[0]?.start).toBe('2026-07-01');
		expect(periodFromKey('q:2026-Q4')?.start).toBe('2026-07-01');
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

describe('filterHouseholdListCandidates', () => {
	const base = [
		{
			id: 'h1',
			name: 'Adams',
			onList: false,
			cardEligible: true,
			hasAddress: true
		},
		{
			id: 'h2',
			name: 'Baker',
			onList: true,
			cardEligible: true,
			hasAddress: true
		},
		{
			id: 'h3',
			name: 'Clark',
			onList: false,
			cardEligible: true,
			hasAddress: false
		},
		{
			id: 'h4',
			name: 'Retired Only',
			onList: false,
			cardEligible: false,
			hasAddress: true
		}
	];

	it('excludes C2-ineligible always', () => {
		const rows = filterHouseholdListCandidates(base, { scope: 'all' });
		expect(rows.map((r) => r.id)).toEqual(['h1', 'h2', 'h3']);
	});

	it('not_on_list drops already-on', () => {
		const rows = filterHouseholdListCandidates(base, { scope: 'not_on_list' });
		expect(rows.map((r) => r.id)).toEqual(['h1', 'h3']);
	});

	it('has_address requires address and not on list', () => {
		const rows = filterHouseholdListCandidates(base, { scope: 'has_address' });
		expect(rows.map((r) => r.id)).toEqual(['h1']);
	});

	it('filters by search query', () => {
		const rows = filterHouseholdListCandidates(base, {
			scope: 'not_on_list',
			q: 'ada'
		});
		expect(rows.map((r) => r.id)).toEqual(['h1']);
	});
});

describe('filterContactListCandidates', () => {
	const base = [
		{ id: 'c1', display_name: 'Tom Jones', onList: false },
		{ id: 'c2', display_name: 'Sarah Lee', onList: true },
		{ id: 'c3', display_name: 'Tom Brady', onList: false }
	];

	it('not_on_list excludes members', () => {
		expect(
			filterContactListCandidates(base, { scope: 'not_on_list' }).map((r) => r.id)
		).toEqual(['c3', 'c1']);
	});

	it('all keeps on-list rows and searches', () => {
		expect(
			filterContactListCandidates(base, { scope: 'all', q: 'tom' }).map((r) => r.id)
		).toEqual(['c3', 'c1']);
	});
});

describe('householdHasMailingAddress', () => {
	it('detects any address field', () => {
		expect(
			householdHasMailingAddress({
				address_line_1: null,
				address_line_2: null,
				city: 'Madison',
				state: null,
				postal_code: null,
				country: null
			})
		).toBe(true);
		expect(
			householdHasMailingAddress({
				address_line_1: null,
				address_line_2: null,
				city: null,
				state: null,
				postal_code: null,
				country: null
			})
		).toBe(false);
	});
});
