import type { SupabaseClient } from '@supabase/supabase-js';
import {
	CONTACT_LIST_FILTERS,
	type ContactListDef,
	type ContactListFilter,
	type ContactListMemberRow,
	type ContactListRow,
	type ContactStatus,
	type ContactsListFilters,
	type HouseholdRow
} from '$lib/types/contacts';
import {
	contactDisplayName,
	effectiveCadenceDays,
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

export async function loadContactListMembers(
	supabase: SupabaseClient,
	listId: string
): Promise<{
	members: ContactListMemberRow[];
	error: string | null;
}> {
	const membersRes = await supabase
		.from('contact_list_members')
		.select('id, list_id, contact_id, household_id')
		.eq('list_id', listId)
		.is('deleted_at', null)
		.order('created_at', { ascending: true });

	if (membersRes.error) {
		console.error('[contacts] loadContactListMembers', membersRes.error);
		return { members: [], error: membersRes.error.message };
	}

	const rows = (membersRes.data ?? []) as {
		id: string;
		list_id: string;
		contact_id: string | null;
		household_id: string | null;
	}[];

	const contactIds = rows.map((r) => r.contact_id).filter((id): id is string => id != null);
	const householdIds = rows.map((r) => r.household_id).filter((id): id is string => id != null);

	const [contactsRes, householdsRes] = await Promise.all([
		contactIds.length
			? supabase
					.from('contacts')
					.select('id, first_name, last_name')
					.in('id', contactIds)
					.is('deleted_at', null)
			: Promise.resolve({
					data: [] as { id: string; first_name: string; last_name: string | null }[],
					error: null
				}),
		householdIds.length
			? supabase
					.from('households')
					.select('id, name')
					.in('id', householdIds)
					.is('deleted_at', null)
			: Promise.resolve({ data: [] as { id: string; name: string }[], error: null })
	]);

	if (contactsRes.error) console.error('[contacts] member contacts', contactsRes.error);
	if (householdsRes.error) console.error('[contacts] member households', householdsRes.error);

	const contactLabel = new Map<string, string>();
	for (const c of contactsRes.data ?? []) {
		const row = c as { id: string; first_name: string; last_name: string | null };
		contactLabel.set(row.id, contactDisplayName(row));
	}
	const hhLabel = new Map<string, string>();
	for (const h of householdsRes.data ?? []) {
		const row = h as { id: string; name: string };
		hhLabel.set(row.id, row.name);
	}

	const members: ContactListMemberRow[] = [];
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
			members.push({
				id: r.id,
				list_id: r.list_id,
				contact_id: null,
				household_id: r.household_id,
				label: hhLabel.get(r.household_id) ?? 'Unknown household',
				kind: 'household'
			});
		}
	}

	return { members, error: null };
}
