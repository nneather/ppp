import { describe, expect, it } from 'vitest';
import {
	applicableSortKeys,
	buildSortContext,
	contactGroupLabel,
	contactsListFiltersToSearchParams,
	groupSortedRows,
	householdGroupLabel,
	listNamesForContact,
	parseContactSort,
	sortContacts,
	sortHouseholds
} from '$lib/contacts/sort';
import type {
	ContactListDef,
	ContactListRow,
	ContactSortKey,
	HouseholdRow
} from '$lib/types/contacts';

function list(
	id: string,
	name: string,
	opts?: { sort_order?: number; kind?: 'standing' | 'ad_hoc' }
): ContactListDef {
	return {
		id,
		name,
		notes: null,
		sort_order: opts?.sort_order ?? 0,
		kind: opts?.kind ?? 'standing',
		memberCount: 0
	};
}

function contact(
	id: string,
	opts: Partial<ContactListRow> & { first_name: string }
): ContactListRow {
	return {
		id,
		first_name: opts.first_name,
		last_name: opts.last_name ?? 'Smith',
		display_name: opts.display_name ?? `${opts.first_name} ${opts.last_name ?? 'Smith'}`,
		household_id: opts.household_id ?? null,
		household_name: opts.household_name ?? null,
		email: null,
		phone: null,
		cadence_days: null,
		effective_cadence_days: 90,
		frequency: opts.frequency ?? 'quarterly',
		no_reminders: false,
		status: 'active',
		notes: null,
		birthday: null,
		last_touched_on: opts.last_touched_on ?? null,
		giving_grade: opts.giving_grade ?? null,
		relationship_grade: opts.relationship_grade ?? null
	};
}

function household(id: string, name: string, opts?: Partial<HouseholdRow>): HouseholdRow {
	return {
		id,
		name,
		address_line_1: null,
		address_line_2: null,
		city: null,
		state: null,
		postal_code: null,
		country: null,
		notes: null,
		giving_grade: opts?.giving_grade ?? null,
		relationship_grade: opts?.relationship_grade ?? null,
		address_updated_on: null,
		memberCount: opts?.memberCount ?? 1
	};
}

const church = list('l-church', 'Church', { sort_order: 0 });
const family = list('l-family', 'Family', { sort_order: 1 });
const cards = list('l-cards', 'Christmas cards', { sort_order: 9, kind: 'ad_hoc' });

const ctx = buildSortContext([church, family, cards], {
	listIdsByContactId: {
		alice: ['l-church']
	},
	listIdsByHouseholdId: {
		'hh-family': ['l-family'],
		'hh-church': ['l-church']
	}
});

describe('parseContactSort', () => {
	it('defaults to name', () => {
		expect(parseContactSort(null)).toEqual(['name']);
		expect(parseContactSort('')).toEqual(['name']);
		expect(parseContactSort('nope')).toEqual(['name']);
	});

	it('parses up to two unique valid keys', () => {
		expect(parseContactSort('frequency,list')).toEqual(['frequency', 'list']);
		expect(parseContactSort('list,frequency')).toEqual(['list', 'frequency']);
		expect(parseContactSort('giving,frequency,name')).toEqual(['giving', 'frequency']);
		expect(parseContactSort('frequency,frequency,list')).toEqual(['frequency', 'list']);
	});
});

describe('contactsListFiltersToSearchParams', () => {
	it('omits default status and name sort', () => {
		const p = contactsListFiltersToSearchParams({
			filters: { status: 'active', q: null, listId: null, sort: ['name'] }
		});
		expect(p.toString()).toBe('');
	});

	it('emits sort, list_filter, and tab', () => {
		const p = contactsListFiltersToSearchParams({
			tab: 'households',
			filters: {
				status: 'all',
				q: 'tom',
				listId: 'l-church',
				sort: ['frequency', 'list']
			}
		});
		expect(p.get('tab')).toBe('households');
		expect(p.get('status')).toBe('all');
		expect(p.get('q')).toBe('tom');
		expect(p.get('list_filter')).toBe('l-church');
		expect(p.get('sort')).toBe('frequency,list');
	});
});

describe('sortContacts', () => {
	const alice = contact('alice', {
		first_name: 'Alice',
		frequency: 'annual',
		giving_grade: 'A',
		household_id: 'hh-church'
	});
	const bob = contact('bob', {
		first_name: 'Bob',
		frequency: 'quarterly',
		giving_grade: 'C',
		household_id: 'hh-family'
	});
	const cara = contact('cara', {
		first_name: 'Cara',
		frequency: 'quarterly',
		giving_grade: 'B',
		household_id: null
	});

	it('sorts by frequency then list (standing first)', () => {
		const sorted = sortContacts([alice, bob, cara], ['frequency', 'list'], ctx);
		expect(sorted.map((c) => c.first_name)).toEqual(['Bob', 'Cara', 'Alice']);
	});

	it('sorts by list then frequency', () => {
		const sorted = sortContacts([alice, bob, cara], ['list', 'frequency'], ctx);
		// Church (Alice via HH), Family (Bob), unlisted Cara last
		expect(sorted.map((c) => c.first_name)).toEqual(['Alice', 'Bob', 'Cara']);
	});

	it('sorts by giving (A first, ungraded last)', () => {
		const dan = contact('dan', { first_name: 'Dan', giving_grade: null });
		const sorted = sortContacts([bob, dan, alice], ['giving'], ctx);
		expect(sorted.map((c) => c.first_name)).toEqual(['Alice', 'Bob', 'Dan']);
	});

	it('sorts last meet with never-logged first', () => {
		const early = contact('e', { first_name: 'Early', last_touched_on: '2026-01-01' });
		const late = contact('l', { first_name: 'Late', last_touched_on: '2026-08-01' });
		const never = contact('n', { first_name: 'Never', last_touched_on: null });
		const sorted = sortContacts([late, never, early], ['last_meet'], ctx);
		expect(sorted.map((c) => c.first_name)).toEqual(['Never', 'Early', 'Late']);
	});

	it('uses person XOR household membership for list names', () => {
		expect(listNamesForContact('alice', 'hh-church', ctx)).toEqual(['Church']);
		expect(listNamesForContact('bob', 'hh-family', ctx)).toEqual(['Family']);
		expect(listNamesForContact('cara', null, ctx)).toEqual([]);
	});
});

describe('sortHouseholds', () => {
	it('ignores frequency and sorts by giving then name', () => {
		const a = household('h1', 'Zed', { giving_grade: 'A' });
		const b = household('h2', 'Ann', { giving_grade: 'B' });
		const c = household('h3', 'Bea', { giving_grade: 'B' });
		const sorted = sortHouseholds([c, a, b], ['frequency', 'giving'] as ContactSortKey[], ctx);
		expect(sorted.map((h) => h.name)).toEqual(['Zed', 'Ann', 'Bea']);
	});
});

describe('group headers', () => {
	it('labels frequency groups', () => {
		const c = contact('alice', { first_name: 'Alice', frequency: 'semiannual' });
		expect(contactGroupLabel(c, 'frequency', ctx)).toBe('Semester');
		expect(contactGroupLabel(c, 'name', ctx)).toBe('S');
		expect(householdGroupLabel(household('hh-j', 'The Jones Family'), 'name', ctx)).toBe('T');
	});

	it('splits sorted rows when the header changes', () => {
		const groups = groupSortedRows(
			[
				contact('a', { first_name: 'A', frequency: 'quarterly' }),
				contact('b', { first_name: 'B', frequency: 'quarterly' }),
				contact('c', { first_name: 'C', frequency: 'annual' })
			],
			(row) => contactGroupLabel(row, 'frequency', ctx)
		);
		expect(groups.map((g) => [g.header, g.rows.length])).toEqual([
			['Quarterly', 2],
			['Annual', 1]
		]);
	});
});

describe('applicableSortKeys', () => {
	it('drops contact-only keys on households', () => {
		expect(applicableSortKeys(['frequency', 'list'], 'household')).toEqual(['list']);
		expect(applicableSortKeys(['last_meet'], 'household')).toEqual(['name']);
	});
});
