/**
 * Composable roster sort for `/contacts` (Contacts + Households tabs).
 * URL: `?sort=frequency,list` — name is default and always the last tiebreaker.
 */

import { nameLetterHeader } from '$lib/contacts/search';
import {
	CONTACT_FREQUENCY_LABELS,
	CONTACT_SORT_KEYS,
	HOUSEHOLD_SORT_KEYS,
	type ContactFrequency,
	type ContactListDef,
	type ContactListRow,
	type ContactSortKey,
	type ContactsListFilters,
	type HouseholdRow,
	type ListMembershipMaps
} from '$lib/types/contacts';

const SORT_KEY_SET = new Set<string>(CONTACT_SORT_KEYS);
const HOUSEHOLD_KEY_SET = new Set<string>(HOUSEHOLD_SORT_KEYS);

const FREQUENCY_RANK: Record<ContactFrequency, number> = {
	common: 0,
	quarterly: 1,
	semiannual: 2,
	annual: 3,
	none: 4
};

const UNLISTED_ORDER = 10_000;

export type ContactSortContext = {
	listsById: Record<
		string,
		Pick<ContactListDef, 'id' | 'name' | 'sort_order' | 'kind'>
	>;
	listIdsByContactId: Record<string, string[]>;
	listIdsByHouseholdId: Record<string, string[]>;
};

export const DEFAULT_CONTACT_SORT: ContactSortKey[] = ['name'];

export function isContactSortKey(v: string): v is ContactSortKey {
	return SORT_KEY_SET.has(v);
}

export function parseContactSort(raw: string | null | undefined): ContactSortKey[] {
	if (!raw?.trim()) return [...DEFAULT_CONTACT_SORT];
	const keys: ContactSortKey[] = [];
	for (const part of raw.split(',')) {
		const k = part.trim();
		if (!isContactSortKey(k)) continue;
		if (keys.includes(k)) continue;
		keys.push(k);
		if (keys.length >= 2) break;
	}
	return keys.length > 0 ? keys : [...DEFAULT_CONTACT_SORT];
}

export function isDefaultContactSort(keys: readonly ContactSortKey[]): boolean {
	return keys.length === 1 && keys[0] === 'name';
}

export function applicableSortKeys(
	keys: readonly ContactSortKey[],
	entity: 'contact' | 'household'
): ContactSortKey[] {
	const allowed = entity === 'household' ? HOUSEHOLD_KEY_SET : SORT_KEY_SET;
	const filtered = keys.filter((k) => allowed.has(k));
	return filtered.length > 0 ? filtered : [...DEFAULT_CONTACT_SORT];
}

export function contactsListFiltersToSearchParams(opts: {
	tab?: 'contacts' | 'households' | 'lists';
	filters: ContactsListFilters;
	selectedListId?: string | null;
}): URLSearchParams {
	const params = new URLSearchParams();
	const tab = opts.tab ?? 'contacts';
	if (tab !== 'contacts') params.set('tab', tab);
	if (opts.filters.status !== 'active') params.set('status', opts.filters.status);
	if (opts.filters.q) params.set('q', opts.filters.q);
	if (opts.filters.listId) params.set('list_filter', opts.filters.listId);
	if (!isDefaultContactSort(opts.filters.sort)) {
		params.set('sort', opts.filters.sort.join(','));
	}
	if (tab === 'lists' && opts.selectedListId) {
		params.set('list', opts.selectedListId);
	}
	return params;
}

export function buildSortContext(
	lists: readonly ContactListDef[],
	maps: Pick<ListMembershipMaps, 'listIdsByContactId' | 'listIdsByHouseholdId'>
): ContactSortContext {
	const listsById: ContactSortContext['listsById'] = {};
	for (const l of lists) {
		listsById[l.id] = {
			id: l.id,
			name: l.name,
			sort_order: l.sort_order,
			kind: l.kind
		};
	}
	return {
		listsById,
		listIdsByContactId: maps.listIdsByContactId,
		listIdsByHouseholdId: maps.listIdsByHouseholdId
	};
}

function uniqueIds(ids: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const id of ids) {
		if (seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}
	return out;
}

function resolvedLists(
	ids: readonly string[],
	ctx: ContactSortContext
): Pick<ContactListDef, 'id' | 'name' | 'sort_order' | 'kind'>[] {
	const out: Pick<ContactListDef, 'id' | 'name' | 'sort_order' | 'kind'>[] = [];
	for (const id of uniqueIds(ids)) {
		const def = ctx.listsById[id];
		if (def) out.push(def);
	}
	return out.sort(
		(a, b) =>
			a.sort_order - b.sort_order || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
	);
}

function contactListIds(
	contactId: string,
	householdId: string | null,
	ctx: ContactSortContext
): string[] {
	return uniqueIds([
		...(ctx.listIdsByContactId[contactId] ?? []),
		...(householdId ? (ctx.listIdsByHouseholdId[householdId] ?? []) : [])
	]);
}

function orderedListDefs(
	ids: readonly string[],
	ctx: ContactSortContext
): Pick<ContactListDef, 'id' | 'name' | 'sort_order' | 'kind'>[] {
	const defs = resolvedLists(ids, ctx);
	const standing = defs.filter((d) => d.kind === 'standing');
	const adHoc = defs.filter((d) => d.kind !== 'standing');
	return [...standing, ...adHoc];
}

/** Standing lists first (by list sort_order), then ad hoc. */
export function listNamesForContact(
	contactId: string,
	householdId: string | null,
	ctx: ContactSortContext
): string[] {
	return orderedListDefs(contactListIds(contactId, householdId, ctx), ctx).map((d) => d.name);
}

export function listNamesForHousehold(householdId: string, ctx: ContactSortContext): string[] {
	return orderedListDefs(ctx.listIdsByHouseholdId[householdId] ?? [], ctx).map((d) => d.name);
}

function listSortKey(ids: readonly string[], ctx: ContactSortContext): [number, string] {
	const defs = orderedListDefs(ids, ctx);
	if (defs.length === 0) return [UNLISTED_ORDER, ''];
	const primary = defs[0]!;
	return [primary.sort_order, defs.map((d) => d.name).join('\0')];
}

function gradeRank(g: string | null | undefined): number {
	if (!g) return 99;
	return g.charCodeAt(0) - 64;
}

function compareName(
	aLast: string | null,
	aFirst: string,
	aId: string,
	bLast: string | null,
	bFirst: string,
	bId: string
): number {
	// Empty last name sorts by first name so groups match nameLetterHeader
	// (Madonna → M, not a stray M block at the top of the roster).
	const aKey = aLast?.trim() || aFirst;
	const bKey = bLast?.trim() || bFirst;
	return aKey.localeCompare(bKey) || aFirst.localeCompare(bFirst) || aId.localeCompare(bId);
}

function compareByKey(
	key: ContactSortKey,
	a: {
		id: string;
		first_name: string;
		last_name: string | null;
		display_name: string;
		frequency?: ContactFrequency;
		giving_grade: string | null;
		relationship_grade: string | null;
		last_touched_on?: string | null;
		household_id?: string | null;
		listIds: readonly string[];
	},
	b: {
		id: string;
		first_name: string;
		last_name: string | null;
		display_name: string;
		frequency?: ContactFrequency;
		giving_grade: string | null;
		relationship_grade: string | null;
		last_touched_on?: string | null;
		household_id?: string | null;
		listIds: readonly string[];
	},
	ctx: ContactSortContext
): number {
	switch (key) {
		case 'name':
			return compareName(
				a.last_name,
				a.first_name,
				a.id,
				b.last_name,
				b.first_name,
				b.id
			);
		case 'frequency': {
			const ar = FREQUENCY_RANK[a.frequency ?? 'none'] ?? 9;
			const br = FREQUENCY_RANK[b.frequency ?? 'none'] ?? 9;
			return ar - br;
		}
		case 'list': {
			const [ao, an] = listSortKey(a.listIds, ctx);
			const [bo, bn] = listSortKey(b.listIds, ctx);
			return ao - bo || an.localeCompare(bn);
		}
		case 'giving':
			return gradeRank(a.giving_grade) - gradeRank(b.giving_grade);
		case 'relationship':
			return gradeRank(a.relationship_grade) - gradeRank(b.relationship_grade);
		case 'last_meet': {
			const at = a.last_touched_on ?? '';
			const bt = b.last_touched_on ?? '';
			if (at === bt) return 0;
			if (!at) return -1;
			if (!bt) return 1;
			return at.localeCompare(bt);
		}
	}
}

export function sortContacts(
	rows: readonly ContactListRow[],
	keys: readonly ContactSortKey[],
	ctx: ContactSortContext
): ContactListRow[] {
	const spec = applicableSortKeys(keys, 'contact');
	return [...rows].sort((a, b) => {
		const aIds = contactListIds(a.id, a.household_id, ctx);
		const bIds = contactListIds(b.id, b.household_id, ctx);
		for (const key of spec) {
			const cmp = compareByKey(
				key,
				{ ...a, listIds: aIds },
				{ ...b, listIds: bIds },
				ctx
			);
			if (cmp !== 0) return cmp;
		}
		return compareName(
			a.last_name,
			a.first_name,
			a.id,
			b.last_name,
			b.first_name,
			b.id
		);
	});
}

export function sortHouseholds(
	rows: readonly HouseholdRow[],
	keys: readonly ContactSortKey[],
	ctx: ContactSortContext
): HouseholdRow[] {
	const spec = applicableSortKeys(keys, 'household');
	return [...rows].sort((a, b) => {
		const aIds = ctx.listIdsByHouseholdId[a.id] ?? [];
		const bIds = ctx.listIdsByHouseholdId[b.id] ?? [];
		for (const key of spec) {
			const cmp = compareByKey(
				key,
				{
					id: a.id,
					first_name: a.name,
					last_name: '',
					display_name: a.name,
					giving_grade: a.giving_grade,
					relationship_grade: a.relationship_grade,
					listIds: aIds
				},
				{
					id: b.id,
					first_name: b.name,
					last_name: '',
					display_name: b.name,
					giving_grade: b.giving_grade,
					relationship_grade: b.relationship_grade,
					listIds: bIds
				},
				ctx
			);
			if (cmp !== 0) return cmp;
		}
		return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
	});
}

export function contactGroupLabel(
	row: ContactListRow,
	primary: ContactSortKey,
	ctx: ContactSortContext
): string | null {
	switch (primary) {
		case 'frequency':
			return CONTACT_FREQUENCY_LABELS[row.frequency];
		case 'list': {
			const names = listNamesForContact(row.id, row.household_id, ctx);
			return names[0] ?? 'No list';
		}
		case 'giving':
			return row.giving_grade ? `Giving ${row.giving_grade}` : 'No giving grade';
		case 'relationship':
			return row.relationship_grade
				? `Relationship ${row.relationship_grade}`
				: 'No relationship grade';
		case 'name':
			return nameLetterHeader(row.last_name, row.first_name);
		default:
			return null;
	}
}

export function householdGroupLabel(
	row: HouseholdRow,
	primary: ContactSortKey,
	ctx: ContactSortContext
): string | null {
	switch (primary) {
		case 'list': {
			const names = listNamesForHousehold(row.id, ctx);
			return names[0] ?? 'No list';
		}
		case 'giving':
			return row.giving_grade ? `Giving ${row.giving_grade}` : 'No giving grade';
		case 'relationship':
			return row.relationship_grade
				? `Relationship ${row.relationship_grade}`
				: 'No relationship grade';
		case 'name':
			return nameLetterHeader(row.name);
		default:
			return null;
	}
}

export function groupSortedRows<T>(
	rows: readonly T[],
	headerOf: (row: T) => string | null
): { header: string | null; rows: T[] }[] {
	const out: { header: string | null; rows: T[] }[] = [];
	for (const row of rows) {
		const header = headerOf(row);
		const last = out[out.length - 1];
		if (last && last.header === header) {
			last.rows.push(row);
		} else {
			out.push({ header, rows: [row] });
		}
	}
	return out;
}

/** First occurrence of each header — keyed A–Z jump cannot repeat a letter. */
export function uniqueGroupHeaders(headers: readonly (string | null)[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const h of headers) {
		if (h == null || seen.has(h)) continue;
		seen.add(h);
		out.push(h);
	}
	return out;
}
