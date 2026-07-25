import type { SupabaseClient } from '@supabase/supabase-js';
import {
	CONTACT_LIST_FILTERS,
	type ContactDueRow,
	type ContactListDef,
	type ContactListFilter,
	type ContactListMemberRow,
	type ContactListRow,
	type ContactSearchHit,
	type ContactStatus,
	type ContactsListFilters,
	type HouseholdRow
} from '$lib/types/contacts';
import {
	householdEligibleForCardList,
	selectContactsDue,
	type ContactDueCandidate
} from '$lib/contacts/due';
import {
	contactDisplayName,
	effectiveCadenceDays,
	formatHouseholdAddress,
	isContactStatus
} from '$lib/contacts/names';

const HOUSEHOLD_COLUMNS =
	'id, name, address_line_1, address_line_2, city, state, postal_code, country, notes';

const CONTACT_COLUMNS =
	'id, first_name, last_name, household_id, email, phone, cadence_days, no_reminders, status, notes';

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
};

export function parseContactsListFilters(url: URL): ContactsListFilters {
	const statusRaw = url.searchParams.get('status');
	const status: ContactListFilter =
		statusRaw && (CONTACT_LIST_FILTERS as readonly string[]).includes(statusRaw)
			? (statusRaw as ContactListFilter)
			: 'active';
	const q = url.searchParams.get('q')?.trim() || null;
	return { status, q };
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
		...h,
		memberCount: countByHh.get(h.id) ?? 0
	}));

	return { households, error: null };
}

export async function loadContacts(
	supabase: SupabaseClient,
	opts: {
		filters: ContactsListFilters;
		profileCadenceDefault: number | null;
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

	const qText = opts.filters.q?.toLowerCase() ?? null;
	if (qText) {
		rows = rows.filter((r) => {
			const name = contactDisplayName(r).toLowerCase();
			const email = (r.email ?? '').toLowerCase();
			const phone = (r.phone ?? '').toLowerCase();
			return name.includes(qText) || email.includes(qText) || phone.includes(qText);
		});
	}

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
					.select('id, name')
					.in('id', householdIds)
					.is('deleted_at', null)
			: Promise.resolve({ data: [] as { id: string; name: string }[], error: null })
	]);

	if (touchesRes.error) console.error('[contacts] last touches', touchesRes.error);
	if (householdsRes.error) console.error('[contacts] households for list', householdsRes.error);

	const lastByContact = new Map<string, string>();
	for (const t of touchesRes.data ?? []) {
		const row = t as { contact_id: string; touched_on: string };
		const prev = lastByContact.get(row.contact_id);
		if (!prev || row.touched_on > prev) lastByContact.set(row.contact_id, row.touched_on);
	}

	const hhName = new Map<string, string>();
	for (const h of householdsRes.data ?? []) {
		const row = h as { id: string; name: string };
		hhName.set(row.id, row.name);
	}

	const contacts: ContactListRow[] = [];
	for (const raw of rows) {
		if (!isContactStatus(raw.status)) continue;
		const status = raw.status as ContactStatus;
		contacts.push({
			id: raw.id,
			first_name: raw.first_name,
			last_name: raw.last_name,
			display_name: contactDisplayName(raw),
			household_id: raw.household_id,
			household_name: raw.household_id ? (hhName.get(raw.household_id) ?? null) : null,
			email: raw.email,
			phone: raw.phone,
			cadence_days: raw.cadence_days,
			effective_cadence_days: effectiveCadenceDays(
				raw.cadence_days,
				opts.profileCadenceDefault
			),
			no_reminders: raw.no_reminders,
			status,
			notes: raw.notes,
			last_touched_on: lastByContact.get(raw.id) ?? null
		});
	}

	// Sort by last name then first (display)
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
			.select('id, name, notes, sort_order')
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
	}[]).map((l) => ({
		...l,
		memberCount: countByList.get(l.id) ?? 0
	}));

	return { lists, error: null };
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
 */
export async function loadContactsDue(
	supabase: SupabaseClient,
	opts: {
		todayYmd: string;
		profileCadenceDefault: number | null;
		limit?: number;
	}
): Promise<{
	contacts: ContactDueRow[];
	error: string | null;
}> {
	const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);

	const contactsRes = await supabase
		.from('contacts')
		.select(CONTACT_COLUMNS)
		.is('deleted_at', null)
		.eq('status', 'active')
		.eq('no_reminders', false);

	if (contactsRes.error) {
		console.error('[contacts] loadContactsDue', contactsRes.error);
		return { contacts: [], error: contactsRes.error.message };
	}

	const rows = (contactsRes.data ?? []) as ContactDb[];
	const contactIds = rows.map((r) => r.id);
	const householdIds = [
		...new Set(rows.map((r) => r.household_id).filter((id): id is string => id != null))
	];

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
					.select('id, name')
					.in('id', householdIds)
					.is('deleted_at', null)
			: Promise.resolve({ data: [] as { id: string; name: string }[], error: null })
	]);

	if (touchesRes.error) console.error('[contacts] due last touches', touchesRes.error);
	if (householdsRes.error) console.error('[contacts] due households', householdsRes.error);

	const lastByContact = new Map<string, string>();
	for (const t of touchesRes.data ?? []) {
		const row = t as { contact_id: string; touched_on: string };
		const prev = lastByContact.get(row.contact_id);
		if (!prev || row.touched_on > prev) lastByContact.set(row.contact_id, row.touched_on);
	}

	const hhName = new Map<string, string>();
	for (const h of householdsRes.data ?? []) {
		const row = h as { id: string; name: string };
		hhName.set(row.id, row.name);
	}

	const candidates: ContactDueCandidate[] = [];
	for (const raw of rows) {
		if (!isContactStatus(raw.status) || raw.status !== 'active') continue;
		candidates.push({
			id: raw.id,
			display_name: contactDisplayName(raw),
			effective_cadence_days: effectiveCadenceDays(raw.cadence_days, opts.profileCadenceDefault),
			last_touched_on: lastByContact.get(raw.id) ?? null,
			household_name: raw.household_id ? (hhName.get(raw.household_id) ?? null) : null,
			no_reminders: raw.no_reminders,
			status: 'active'
		});
	}

	return {
		contacts: selectContactsDue(candidates, { todayYmd: opts.todayYmd, limit }),
		error: null
	};
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
		const name = contactDisplayName(r).toLowerCase();
		const hh = r.household_id ? hhById.get(r.household_id) : null;
		const hhName = (hh?.name ?? '').toLowerCase();
		const email = (r.email ?? '').toLowerCase();
		const phone = (r.phone ?? '').toLowerCase();
		return (
			name.includes(qText) ||
			hhName.includes(qText) ||
			email.includes(qText) ||
			phone.includes(qText)
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
		hits.push({
			id: raw.id,
			display_name: contactDisplayName(raw),
			email: raw.email,
			phone: raw.phone,
			household_id: raw.household_id,
			household_name: hh?.name ?? null,
			address_summary: hh ? formatHouseholdAddress(hh) : null,
			effective_cadence_days: effectiveCadenceDays(raw.cadence_days, opts.profileCadenceDefault),
			last_touched_on: lastByContact.get(raw.id) ?? null,
			status: raw.status,
			no_reminders: raw.no_reminders
		});
	}

	hits.sort(
		(a, b) =>
			a.display_name.localeCompare(b.display_name) || a.id.localeCompare(b.id)
	);

	return { contacts: hits.slice(0, limit), error: null };
}
