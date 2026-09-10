import type { SupabaseClient } from '@supabase/supabase-js';
import {
	CONTACT_LIST_FILTERS,
	type ContactDueRow,
	type ContactFrequency,
	type ContactListDef,
	type ContactListFilter,
	type ContactListMemberRow,
	type ContactListRow,
	type ContactSearchHit,
	type ContactStatus,
	type ContactsListFilters,
	type ContactsPaceSummary,
	type GivingGrade,
	type HouseholdChildRow,
	type HouseholdGradeChangeRow,
	type HouseholdRow,
	type ListMembershipMaps,
	type PeriodHistoryRow,
	type RelationshipGrade
} from '$lib/types/contacts';
import {
	computePaceSummary,
	householdEligibleForCardList,
	selectContactsDue,
	type ContactDueCandidate
} from '$lib/contacts/due';
import {
	householdHasMailingAddress,
	type HouseholdListCandidate
} from '$lib/contacts/list-candidates';
import {
	isScheduledFrequency,
	recentClosedPeriods,
	touchFulfillsPeriod
} from '$lib/contacts/period';
import { contactMatchesQuery } from '$lib/contacts/search';
import { parseContactSort } from '$lib/contacts/sort';
import {
	contactDisplayName,
	effectiveCadenceDays,
	formatHouseholdAddress,
	isContactFrequency,
	isContactListKind,
	isContactStatus,
	isGivingGrade,
	isRelationshipGrade
} from '$lib/contacts/names';

const HOUSEHOLD_COLUMNS =
	'id, name, address_line_1, address_line_2, city, state, postal_code, country, notes, giving_grade, relationship_grade, address_updated_on';

const CONTACT_COLUMNS =
	'id, first_name, last_name, household_id, email, phone, cadence_days, no_reminders, status, notes, frequency, birthday';

type HouseholdDb = {
	id: string;
	name: string;
	address_line_1: string | null;
	address_line_2: string | null;
	city: string | null;
	state: string | null;
	postal_code: string | null;
	country: string | null;
	notes: string | null;
	giving_grade: string | null;
	relationship_grade: string | null;
	address_updated_on: string | null;
};

type ContactDb = {
	id: string;
	first_name: string;
	last_name: string | null;
	household_id: string | null;
	email: string | null;
	phone: string | null;
	cadence_days: number | null;
	no_reminders: boolean;
	status: string;
	notes: string | null;
	frequency: string;
	birthday: string | null;
};

function parseGradeGiving(v: string | null): GivingGrade | null {
	if (v && isGivingGrade(v)) return v;
	return null;
}

function parseGradeRel(v: string | null): RelationshipGrade | null {
	if (v && isRelationshipGrade(v)) return v;
	return null;
}

export function parseContactsListFilters(url: URL): ContactsListFilters {
	const statusRaw = url.searchParams.get('status');
	const status: ContactListFilter =
		statusRaw && (CONTACT_LIST_FILTERS as readonly string[]).includes(statusRaw)
			? (statusRaw as ContactListFilter)
			: 'active';
	const q = url.searchParams.get('q')?.trim() || null;
	const listId = url.searchParams.get('list_filter')?.trim() || null;
	const sort = parseContactSort(url.searchParams.get('sort'));
	return { status, q, listId, sort };
}

export async function loadHouseholds(supabase: SupabaseClient): Promise<{
	households: HouseholdRow[];
	error: string | null;
}> {
	const [hhRes, membersRes] = await Promise.all([
		supabase
			.from('households')
			.select(HOUSEHOLD_COLUMNS)
			.is('deleted_at', null)
			.order('name', { ascending: true }),
		supabase.from('contacts').select('household_id').is('deleted_at', null).not('household_id', 'is', null)
	]);

	if (hhRes.error) {
		console.error('[contacts] loadHouseholds', hhRes.error);
		return { households: [], error: hhRes.error.message };
	}
	if (membersRes.error) {
		console.error('[contacts] household member counts', membersRes.error);
	}

	const countByHh = new Map<string, number>();
	for (const row of membersRes.data ?? []) {
		const hid = (row as { household_id: string }).household_id;
		countByHh.set(hid, (countByHh.get(hid) ?? 0) + 1);
	}

	const households: HouseholdRow[] = ((hhRes.data ?? []) as HouseholdDb[]).map((h) => ({
		id: h.id,
		name: h.name,
		address_line_1: h.address_line_1,
		address_line_2: h.address_line_2,
		city: h.city,
		state: h.state,
		postal_code: h.postal_code,
		country: h.country,
		notes: h.notes,
		giving_grade: parseGradeGiving(h.giving_grade),
		relationship_grade: parseGradeRel(h.relationship_grade),
		address_updated_on: h.address_updated_on,
		memberCount: countByHh.get(h.id) ?? 0
	}));

	return { households, error: null };
}

export async function loadContacts(
	supabase: SupabaseClient,
	opts: {
		filters: ContactsListFilters;
		profileCadenceDefault: number | null;
		/** Preloaded membership maps — when filters.listId set, filter to members. */
		membershipMaps?: ListMembershipMaps | null;
	}
): Promise<{
	contacts: ContactListRow[];
	error: string | null;
}> {
	let q = supabase
		.from('contacts')
		.select(CONTACT_COLUMNS)
		.is('deleted_at', null)
		.order('last_name', { ascending: true, nullsFirst: false })
		.order('first_name', { ascending: true });

	if (opts.filters.status === 'active') {
		q = q.eq('status', 'active');
	} else if (opts.filters.status === 'retired') {
		q = q.eq('status', 'retired');
	}

	const contactsRes = await q;
	if (contactsRes.error) {
		console.error('[contacts] loadContacts', contactsRes.error);
		return { contacts: [], error: contactsRes.error.message };
	}

	let rows = (contactsRes.data ?? []) as ContactDb[];

	const listId = opts.filters.listId;
	if (listId && opts.membershipMaps) {
		const hhOnList = new Set(opts.membershipMaps.householdIdsByListId[listId] ?? []);
		const ctOnList = new Set(opts.membershipMaps.contactIdsByListId[listId] ?? []);
		rows = rows.filter(
			(r) => ctOnList.has(r.id) || (r.household_id != null && hhOnList.has(r.household_id))
		);
	}

	// `filters.q` is applied client-side so typing stays instant on the ~200-row roster.

	const contactIds = rows.map((r) => r.id);
	const householdIds = [...new Set(rows.map((r) => r.household_id).filter((id): id is string => id != null))];

	const [touchesRes, householdsRes] = await Promise.all([
		contactIds.length
			? supabase
					.from('contact_touches')
					.select('contact_id, touched_on')
					.in('contact_id', contactIds)
					.eq('kind', 'meet')
					.is('deleted_at', null)
			: Promise.resolve({ data: [] as { contact_id: string; touched_on: string }[], error: null }),
		householdIds.length
			? supabase
					.from('households')
					.select('id, name, giving_grade, relationship_grade')
					.in('id', householdIds)
					.is('deleted_at', null)
			: Promise.resolve({
					data: [] as {
						id: string;
						name: string;
						giving_grade: string | null;
						relationship_grade: string | null;
					}[],
					error: null
				})
	]);

	if (touchesRes.error) console.error('[contacts] last touches', touchesRes.error);
	if (householdsRes.error) console.error('[contacts] households for list', householdsRes.error);

	const lastByContact = new Map<string, string>();
	for (const t of touchesRes.data ?? []) {
		const row = t as { contact_id: string; touched_on: string };
		const prev = lastByContact.get(row.contact_id);
		if (!prev || row.touched_on > prev) lastByContact.set(row.contact_id, row.touched_on);
	}

	const hhMeta = new Map<
		string,
		{ name: string; giving: GivingGrade | null; rel: RelationshipGrade | null }
	>();
	for (const h of householdsRes.data ?? []) {
		const row = h as {
			id: string;
			name: string;
			giving_grade: string | null;
			relationship_grade: string | null;
		};
		hhMeta.set(row.id, {
			name: row.name,
			giving: parseGradeGiving(row.giving_grade),
			rel: parseGradeRel(row.relationship_grade)
		});
	}

	const contacts: ContactListRow[] = [];
	for (const raw of rows) {
		if (!isContactStatus(raw.status)) continue;
		const status = raw.status as ContactStatus;
		const freq = isContactFrequency(raw.frequency) ? raw.frequency : 'quarterly';
		const hh = raw.household_id ? hhMeta.get(raw.household_id) : null;
		contacts.push({
			id: raw.id,
			first_name: raw.first_name,
			last_name: raw.last_name,
			display_name: contactDisplayName(raw),
			household_id: raw.household_id,
			household_name: hh?.name ?? null,
			email: raw.email,
			phone: raw.phone,
			cadence_days: raw.cadence_days,
			effective_cadence_days: effectiveCadenceDays(
				raw.cadence_days,
				opts.profileCadenceDefault
			),
			frequency: freq,
			no_reminders: freq === 'common' || raw.no_reminders,
			status,
			notes: raw.notes,
			birthday: raw.birthday,
			last_touched_on: lastByContact.get(raw.id) ?? null,
			giving_grade: hh?.giving ?? null,
			relationship_grade: hh?.rel ?? null
		});
	}

	contacts.sort(
		(a, b) =>
			(a.last_name ?? '').localeCompare(b.last_name ?? '') ||
			a.first_name.localeCompare(b.first_name) ||
			a.id.localeCompare(b.id)
	);

	return { contacts, error: null };
}

export async function loadContactLists(supabase: SupabaseClient): Promise<{
	lists: ContactListDef[];
	error: string | null;
}> {
	const [listsRes, membersRes] = await Promise.all([
		supabase
			.from('contact_lists')
			.select('id, name, notes, sort_order, kind')
			.is('deleted_at', null)
			.order('sort_order', { ascending: true })
			.order('name', { ascending: true }),
		supabase.from('contact_list_members').select('list_id').is('deleted_at', null)
	]);

	if (listsRes.error) {
		console.error('[contacts] loadContactLists', listsRes.error);
		return { lists: [], error: listsRes.error.message };
	}
	if (membersRes.error) {
		console.error('[contacts] list member counts', membersRes.error);
	}

	const countByList = new Map<string, number>();
	for (const row of membersRes.data ?? []) {
		const lid = (row as { list_id: string }).list_id;
		countByList.set(lid, (countByList.get(lid) ?? 0) + 1);
	}

	const lists: ContactListDef[] = ((listsRes.data ?? []) as {
		id: string;
		name: string;
		notes: string | null;
		sort_order: number;
		kind: string;
	}[]).map((l) => ({
		id: l.id,
		name: l.name,
		notes: l.notes,
		sort_order: l.sort_order,
		kind: isContactListKind(l.kind) ? l.kind : 'standing',
		memberCount: countByList.get(l.id) ?? 0
	}));

	return { lists, error: null };
}

/** Live membership maps for sheet toggles + Lists-tab candidate onList flags. */
export async function loadListMembershipMaps(supabase: SupabaseClient): Promise<{
	maps: ListMembershipMaps;
	error: string | null;
}> {
	const empty: ListMembershipMaps = {
		householdIdsByListId: {},
		contactIdsByListId: {},
		listIdsByHouseholdId: {},
		listIdsByContactId: {}
	};

	const { data, error } = await supabase
		.from('contact_list_members')
		.select('list_id, contact_id, household_id')
		.is('deleted_at', null);

	if (error) {
		console.error('[contacts] loadListMembershipMaps', error);
		return { maps: empty, error: error.message };
	}

	const maps: ListMembershipMaps = {
		householdIdsByListId: {},
		contactIdsByListId: {},
		listIdsByHouseholdId: {},
		listIdsByContactId: {}
	};

	for (const raw of data ?? []) {
		const row = raw as {
			list_id: string;
			contact_id: string | null;
			household_id: string | null;
		};
		if (row.household_id) {
			const byList = maps.householdIdsByListId[row.list_id] ?? [];
			byList.push(row.household_id);
			maps.householdIdsByListId[row.list_id] = byList;
			const byHh = maps.listIdsByHouseholdId[row.household_id] ?? [];
			byHh.push(row.list_id);
			maps.listIdsByHouseholdId[row.household_id] = byHh;
		} else if (row.contact_id) {
			const byList = maps.contactIdsByListId[row.list_id] ?? [];
			byList.push(row.contact_id);
			maps.contactIdsByListId[row.list_id] = byList;
			const byCt = maps.listIdsByContactId[row.contact_id] ?? [];
			byCt.push(row.list_id);
			maps.listIdsByContactId[row.contact_id] = byCt;
		}
	}

	return { maps, error: null };
}

/**
 * Household candidates for Lists mass-add (includes onList + C2 + address flags).
 */
export async function loadHouseholdListCandidates(
	supabase: SupabaseClient,
	opts: { listId: string; onListHouseholdIds: ReadonlySet<string> }
): Promise<{
	candidates: HouseholdListCandidate[];
	error: string | null;
}> {
	const [hhRes, membersRes] = await Promise.all([
		supabase
			.from('households')
			.select(
				'id, name, address_line_1, address_line_2, city, state, postal_code, country'
			)
			.is('deleted_at', null)
			.order('name', { ascending: true }),
		supabase
			.from('contacts')
			.select('household_id, status')
			.is('deleted_at', null)
			.not('household_id', 'is', null)
	]);

	if (hhRes.error) {
		console.error('[contacts] loadHouseholdListCandidates', hhRes.error);
		return { candidates: [], error: hhRes.error.message };
	}
	if (membersRes.error) {
		console.error('[contacts] loadHouseholdListCandidates members', membersRes.error);
	}

	const liveByHousehold = new Map<string, { status: ContactStatus }[]>();
	for (const m of membersRes.data ?? []) {
		const row = m as { household_id: string; status: string };
		if (!isContactStatus(row.status)) continue;
		const list = liveByHousehold.get(row.household_id) ?? [];
		list.push({ status: row.status });
		liveByHousehold.set(row.household_id, list);
	}

	const candidates: HouseholdListCandidate[] = [];
	for (const h of (hhRes.data ?? []) as HouseholdDb[]) {
		const live = liveByHousehold.get(h.id) ?? [];
		candidates.push({
			id: h.id,
			name: h.name,
			onList: opts.onListHouseholdIds.has(h.id),
			cardEligible: householdEligibleForCardList({ liveMembers: live }),
			hasAddress: householdHasMailingAddress(h)
		});
	}

	return { candidates, error: null };
}

/**
 * List members for settings UI.
 * C2: household members with no live *active* contact are dropped from the
 * effective roster by default (membership rows remain in DB).
 */
export async function loadContactListMembers(
	supabase: SupabaseClient,
	listId: string,
	opts?: { includeIneligibleHouseholds?: boolean }
): Promise<{
	members: ContactListMemberRow[];
	/** Household memberships hidden by C2 (retired-only / empty). */
	hiddenRetiredOnlyCount: number;
	error: string | null;
}> {
	const includeIneligible = opts?.includeIneligibleHouseholds === true;

	const membersRes = await supabase
		.from('contact_list_members')
		.select('id, list_id, contact_id, household_id')
		.eq('list_id', listId)
		.is('deleted_at', null)
		.order('created_at', { ascending: true });

	if (membersRes.error) {
		console.error('[contacts] loadContactListMembers', membersRes.error);
		return { members: [], hiddenRetiredOnlyCount: 0, error: membersRes.error.message };
	}

	const rows = (membersRes.data ?? []) as {
		id: string;
		list_id: string;
		contact_id: string | null;
		household_id: string | null;
	}[];

	const contactIds = rows.map((r) => r.contact_id).filter((id): id is string => id != null);
	const householdIds = rows.map((r) => r.household_id).filter((id): id is string => id != null);

	const [contactsRes, householdsRes, hhMembersRes] = await Promise.all([
		contactIds.length
			? supabase
					.from('contacts')
					.select('id, first_name, last_name, status')
					.in('id', contactIds)
					.is('deleted_at', null)
			: Promise.resolve({
					data: [] as {
						id: string;
						first_name: string;
						last_name: string | null;
						status: string;
					}[],
					error: null
				}),
		householdIds.length
			? supabase
					.from('households')
					.select('id, name')
					.in('id', householdIds)
					.is('deleted_at', null)
			: Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
		householdIds.length
			? supabase
					.from('contacts')
					.select('household_id, status')
					.in('household_id', householdIds)
					.is('deleted_at', null)
			: Promise.resolve({
					data: [] as { household_id: string; status: string }[],
					error: null
				})
	]);

	if (contactsRes.error) console.error('[contacts] member contacts', contactsRes.error);
	if (householdsRes.error) console.error('[contacts] member households', householdsRes.error);
	if (hhMembersRes.error) console.error('[contacts] household live members', hhMembersRes.error);

	const contactLabel = new Map<string, string>();
	for (const c of contactsRes.data ?? []) {
		const row = c as {
			id: string;
			first_name: string;
			last_name: string | null;
			status: string;
		};
		contactLabel.set(row.id, contactDisplayName(row));
	}
	const hhLabel = new Map<string, string>();
	for (const h of householdsRes.data ?? []) {
		const row = h as { id: string; name: string };
		hhLabel.set(row.id, row.name);
	}

	const liveByHousehold = new Map<string, { status: ContactStatus }[]>();
	for (const m of hhMembersRes.data ?? []) {
		const row = m as { household_id: string; status: string };
		if (!isContactStatus(row.status)) continue;
		const list = liveByHousehold.get(row.household_id) ?? [];
		list.push({ status: row.status });
		liveByHousehold.set(row.household_id, list);
	}

	const members: ContactListMemberRow[] = [];
	let hiddenRetiredOnlyCount = 0;
	for (const r of rows) {
		if (r.contact_id) {
			members.push({
				id: r.id,
				list_id: r.list_id,
				contact_id: r.contact_id,
				household_id: null,
				label: contactLabel.get(r.contact_id) ?? 'Unknown contact',
				kind: 'contact'
			});
		} else if (r.household_id) {
			const live = liveByHousehold.get(r.household_id) ?? [];
			const eligible = householdEligibleForCardList({ liveMembers: live });
			if (!eligible) {
				hiddenRetiredOnlyCount += 1;
				if (!includeIneligible) continue;
			}
			members.push({
				id: r.id,
				list_id: r.list_id,
				contact_id: null,
				household_id: r.household_id,
				label: hhLabel.get(r.household_id) ?? 'Unknown household',
				kind: 'household',
				cardEligible: eligible
			});
		}
	}

	return { members, hiddenRetiredOnlyCount, error: null };
}

/**
 * Active contacts due for a meet (dashboard + MCP list_contacts_due).
 * Period-based: Q/S/A unfulfilled + not skipped; household-collapsed; oldest meet first.
 * `contacts_with_cadence` = scheduled-frequency active pool (household-collapsed).
 */
export async function loadContactsDue(
	supabase: SupabaseClient,
	opts: {
		todayYmd: string;
		profileCadenceDefault?: number | null;
		limit?: number;
	}
): Promise<{
	contacts: ContactDueRow[];
	contacts_with_cadence: number;
	pace: ContactsPaceSummary | null;
	error: string | null;
}> {
	const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);

	const contactsRes = await supabase
		.from('contacts')
		.select(CONTACT_COLUMNS)
		.is('deleted_at', null)
		.eq('status', 'active');

	if (contactsRes.error) {
		console.error('[contacts] loadContactsDue', contactsRes.error);
		return { contacts: [], contacts_with_cadence: 0, pace: null, error: contactsRes.error.message };
	}

	const rows = (contactsRes.data ?? []) as ContactDb[];
	const scheduled = rows.filter((r) => isContactFrequency(r.frequency) && isScheduledFrequency(r.frequency));
	const contactIds = scheduled.map((r) => r.id);
	const householdIds = [
		...new Set(scheduled.map((r) => r.household_id).filter((id): id is string => id != null))
	];

	const [touchesRes, householdsRes, skipsRes] = await Promise.all([
		contactIds.length
			? supabase
					.from('contact_touches')
					.select('contact_id, touched_on')
					.in('contact_id', contactIds)
					.eq('kind', 'meet')
					.is('deleted_at', null)
			: Promise.resolve({ data: [] as { contact_id: string; touched_on: string }[], error: null }),
		householdIds.length
			? supabase
					.from('households')
					.select('id, name, giving_grade, relationship_grade')
					.in('id', householdIds)
					.is('deleted_at', null)
			: Promise.resolve({
					data: [] as {
						id: string;
						name: string;
						giving_grade: string | null;
						relationship_grade: string | null;
					}[],
					error: null
				}),
		contactIds.length
			? supabase
					.from('contact_period_skips')
					.select('contact_id, period_key')
					.in('contact_id', contactIds)
					.is('deleted_at', null)
			: Promise.resolve({
					data: [] as { contact_id: string; period_key: string }[],
					error: null
				})
	]);

	if (touchesRes.error) console.error('[contacts] due last touches', touchesRes.error);
	if (householdsRes.error) console.error('[contacts] due households', householdsRes.error);
	if (skipsRes.error) console.error('[contacts] due skips', skipsRes.error);

	const lastByContact = new Map<string, string>();
	for (const t of touchesRes.data ?? []) {
		const row = t as { contact_id: string; touched_on: string };
		const prev = lastByContact.get(row.contact_id);
		if (!prev || row.touched_on > prev) lastByContact.set(row.contact_id, row.touched_on);
	}

	const hhMeta = new Map<
		string,
		{ name: string; giving: GivingGrade | null; rel: RelationshipGrade | null }
	>();
	for (const h of householdsRes.data ?? []) {
		const row = h as {
			id: string;
			name: string;
			giving_grade: string | null;
			relationship_grade: string | null;
		};
		hhMeta.set(row.id, {
			name: row.name,
			giving: parseGradeGiving(row.giving_grade),
			rel: parseGradeRel(row.relationship_grade)
		});
	}

	const skipsByContact = new Map<string, string[]>();
	for (const s of skipsRes.data ?? []) {
		const row = s as { contact_id: string; period_key: string };
		const arr = skipsByContact.get(row.contact_id) ?? [];
		arr.push(row.period_key);
		skipsByContact.set(row.contact_id, arr);
	}

	const candidates: ContactDueCandidate[] = [];
	for (const raw of scheduled) {
		if (!isContactStatus(raw.status) || raw.status !== 'active') continue;
		const freq = raw.frequency as ContactFrequency;
		const hh = raw.household_id ? hhMeta.get(raw.household_id) : null;
		candidates.push({
			id: raw.id,
			display_name: contactDisplayName(raw),
			frequency: freq,
			last_touched_on: lastByContact.get(raw.id) ?? null,
			household_id: raw.household_id,
			household_name: hh?.name ?? null,
			status: 'active',
			skipped_period_keys: skipsByContact.get(raw.id) ?? [],
			giving_grade: hh?.giving ?? null,
			relationship_grade: hh?.rel ?? null
		});
	}

	const allDue = selectContactsDue(candidates, { todayYmd: opts.todayYmd });
	const due = allDue.slice(0, limit);

	// Total obligations = unique households (or contacts) with scheduled freq
	const obligationKeys = new Set(
		candidates.map((c) => c.household_id ?? `contact:${c.id}`)
	);
	const pace = computePaceSummary(allDue, obligationKeys.size);

	return {
		contacts: due,
		contacts_with_cadence: obligationKeys.size,
		pace,
		error: null
	};
}

export async function loadHouseholdChildren(
	supabase: SupabaseClient,
	householdId: string
): Promise<{ children: HouseholdChildRow[]; error: string | null }> {
	const { data, error } = await supabase
		.from('household_children')
		.select('id, household_id, first_name, last_name, birthday, notes, sort_order')
		.eq('household_id', householdId)
		.is('deleted_at', null)
		.order('sort_order', { ascending: true })
		.order('first_name', { ascending: true });
	if (error) {
		console.error('[contacts] loadHouseholdChildren', error);
		return { children: [], error: error.message };
	}
	return { children: (data ?? []) as HouseholdChildRow[], error: null };
}

export async function loadHouseholdGradeChanges(
	supabase: SupabaseClient,
	householdId: string
): Promise<{ changes: HouseholdGradeChangeRow[]; error: string | null }> {
	const { data, error } = await supabase
		.from('household_grade_changes')
		.select('id, household_id, changed_on, giving_grade, relationship_grade, note')
		.eq('household_id', householdId)
		.is('deleted_at', null)
		.order('changed_on', { ascending: false })
		.limit(40);
	if (error) {
		console.error('[contacts] loadHouseholdGradeChanges', error);
		return { changes: [], error: error.message };
	}
	const changes: HouseholdGradeChangeRow[] = [];
	for (const raw of data ?? []) {
		const r = raw as {
			id: string;
			household_id: string;
			changed_on: string;
			giving_grade: string | null;
			relationship_grade: string | null;
			note: string | null;
		};
		changes.push({
			id: r.id,
			household_id: r.household_id,
			changed_on: r.changed_on,
			giving_grade: parseGradeGiving(r.giving_grade),
			relationship_grade: parseGradeRel(r.relationship_grade),
			note: r.note
		});
	}
	return { changes, error: null };
}

/** Simple period history for the pace strip (quarterly on-ramp focused). */
export async function loadPeriodHistory(
	supabase: SupabaseClient,
	opts: { todayYmd: string }
): Promise<{ history: PeriodHistoryRow[]; error: string | null }> {
	const freq = 'quarterly' as const;
	const closed = recentClosedPeriods(freq, opts.todayYmd, 3);
	if (closed.length === 0) return { history: [], error: null };

	const contactsRes = await supabase
		.from('contacts')
		.select('id, frequency')
		.is('deleted_at', null)
		.eq('status', 'active')
		.eq('frequency', freq);
	if (contactsRes.error) {
		return { history: [], error: contactsRes.error.message };
	}
	const ids = ((contactsRes.data ?? []) as { id: string }[]).map((r) => r.id);
	if (ids.length === 0) {
		return {
			history: closed.map((p) => ({
				period_key: p.key,
				period_end: p.end,
				frequency: freq,
				hit: 0,
				skipped: 0,
				missed: 0
			})),
			error: null
		};
	}

	const [touchesRes, skipsRes] = await Promise.all([
		supabase
			.from('contact_touches')
			.select('contact_id, touched_on')
			.in('contact_id', ids)
			.eq('kind', 'meet')
			.is('deleted_at', null),
		supabase
			.from('contact_period_skips')
			.select('contact_id, period_key')
			.in('contact_id', ids)
			.is('deleted_at', null)
	]);

	const history: PeriodHistoryRow[] = [];
	for (const p of closed) {
		let hit = 0;
		let skipped = 0;
		let missed = 0;
		const skipSet = new Set(
			((skipsRes.data ?? []) as { contact_id: string; period_key: string }[])
				.filter((s) => s.period_key === p.key)
				.map((s) => s.contact_id)
		);
		for (const id of ids) {
			if (skipSet.has(id)) {
				skipped += 1;
				continue;
			}
			const touches = ((touchesRes.data ?? []) as { contact_id: string; touched_on: string }[])
				.filter((t) => t.contact_id === id)
				.map((t) => t.touched_on);
			const fulfilled = touches.some((t) => touchFulfillsPeriod(t, p));
			if (fulfilled) hit += 1;
			else missed += 1;
		}
		history.push({
			period_key: p.key,
			period_end: p.end,
			frequency: freq,
			hit,
			skipped,
			missed
		});
	}
	return { history, error: null };
}

/**
 * Fuzzy name search for MCP search_contacts (first/last/household name).
 */
export async function searchContacts(
	supabase: SupabaseClient,
	opts: {
		q: string;
		profileCadenceDefault: number | null;
		limit?: number;
	}
): Promise<{
	contacts: ContactSearchHit[];
	error: string | null;
}> {
	const qText = opts.q.trim().toLowerCase();
	const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
	if (!qText) return { contacts: [], error: null };

	const [contactsRes, householdsRes] = await Promise.all([
		supabase.from('contacts').select(CONTACT_COLUMNS).is('deleted_at', null),
		supabase
			.from('households')
			.select(HOUSEHOLD_COLUMNS)
			.is('deleted_at', null)
	]);

	if (contactsRes.error) {
		console.error('[contacts] searchContacts', contactsRes.error);
		return { contacts: [], error: contactsRes.error.message };
	}
	if (householdsRes.error) {
		console.error('[contacts] search households', householdsRes.error);
	}

	const hhById = new Map<string, HouseholdDb>();
	for (const h of (householdsRes.data ?? []) as HouseholdDb[]) {
		hhById.set(h.id, h);
	}

	const rows = (contactsRes.data ?? []) as ContactDb[];
	const matched = rows.filter((r) => {
		const hh = r.household_id ? hhById.get(r.household_id) : null;
		return contactMatchesQuery(
			{
				display_name: contactDisplayName(r),
				first_name: r.first_name,
				last_name: r.last_name,
				household_name: hh?.name ?? null,
				email: r.email,
				phone: r.phone
			},
			qText
		);
	});

	const contactIds = matched.map((r) => r.id);
	const touchesRes = contactIds.length
		? await supabase
				.from('contact_touches')
				.select('contact_id, touched_on')
				.in('contact_id', contactIds)
				.eq('kind', 'meet')
				.is('deleted_at', null)
		: { data: [] as { contact_id: string; touched_on: string }[], error: null };

	if (touchesRes.error) console.error('[contacts] search touches', touchesRes.error);

	const lastByContact = new Map<string, string>();
	for (const t of touchesRes.data ?? []) {
		const row = t as { contact_id: string; touched_on: string };
		const prev = lastByContact.get(row.contact_id);
		if (!prev || row.touched_on > prev) lastByContact.set(row.contact_id, row.touched_on);
	}

	const hits: ContactSearchHit[] = [];
	for (const raw of matched) {
		if (!isContactStatus(raw.status)) continue;
		const hh = raw.household_id ? hhById.get(raw.household_id) : null;
		const freq = isContactFrequency(raw.frequency) ? raw.frequency : 'quarterly';
		hits.push({
			id: raw.id,
			display_name: contactDisplayName(raw),
			email: raw.email,
			phone: raw.phone,
			household_id: raw.household_id,
			household_name: hh?.name ?? null,
			address_summary: hh ? formatHouseholdAddress(hh) : null,
			frequency: freq,
			effective_cadence_days: effectiveCadenceDays(raw.cadence_days, opts.profileCadenceDefault),
			last_touched_on: lastByContact.get(raw.id) ?? null,
			status: raw.status,
			no_reminders: freq === 'common' || raw.no_reminders
		});
	}

	hits.sort(
		(a, b) =>
			a.display_name.localeCompare(b.display_name) || a.id.localeCompare(b.id)
	);

	return { contacts: hits.slice(0, limit), error: null };
}
