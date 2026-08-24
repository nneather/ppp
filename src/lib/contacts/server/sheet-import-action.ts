/**
 * Idempotent Sheet1 + Potential Invite import into contacts module.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
	householdNameFromPeople,
	parseNameListCsv,
	parseSheet1Csv,
	parseUsAddressLine,
	splitCoupleName,
	type Sheet1Row
} from '$lib/contacts/sheet-import';
import { contactDisplayName } from '$lib/contacts/names';

const ADDRESS_AS_OF = '2026-01-01';
const POTENTIAL_INVITE = 'Potential Invite';

export type ImportSheetResult = {
	householdsCreated: number;
	contactsCreated: number;
	listsEnsured: string[];
	membershipsAdded: number;
	skipped: number;
	errors: string[];
};

async function ensureStandingList(
	supabase: SupabaseClient,
	userId: string,
	name: string
): Promise<string | null> {
	const { data: existing } = await supabase
		.from('contact_lists')
		.select('id')
		.eq('name', name)
		.is('deleted_at', null)
		.maybeSingle();
	if (existing) return (existing as { id: string }).id;

	const { data: inserted, error } = await supabase
		.from('contact_lists')
		.insert({
			name,
			kind: 'standing',
			notes: 'Imported from Christmas Cards sheet Group column',
			created_by: userId
		} as never)
		.select('id')
		.single();
	if (error || !inserted) {
		console.error('[contacts] ensureStandingList', error);
		return null;
	}
	return (inserted as { id: string }).id;
}

async function ensureAdHocList(
	supabase: SupabaseClient,
	userId: string,
	name: string,
	notes: string
): Promise<string | null> {
	const { data: existing } = await supabase
		.from('contact_lists')
		.select('id')
		.eq('name', name)
		.is('deleted_at', null)
		.maybeSingle();
	if (existing) return (existing as { id: string }).id;

	const { data: inserted, error } = await supabase
		.from('contact_lists')
		.insert({
			name,
			kind: 'ad_hoc',
			notes,
			created_by: userId
		} as never)
		.select('id')
		.single();
	if (error || !inserted) {
		console.error('[contacts] ensureAdHocList', error);
		return null;
	}
	return (inserted as { id: string }).id;
}

async function ensureHouseholdMembership(
	supabase: SupabaseClient,
	userId: string,
	listId: string,
	householdId: string
): Promise<boolean> {
	const { data: live } = await supabase
		.from('contact_list_members')
		.select('id, deleted_at')
		.eq('list_id', listId)
		.eq('household_id', householdId)
		.maybeSingle();

	if (live && !(live as { deleted_at: string | null }).deleted_at) return false;
	if (live) {
		await supabase
			.from('contact_list_members')
			.update({ deleted_at: null } as never)
			.eq('id', (live as { id: string }).id);
		return true;
	}
	const { error } = await supabase.from('contact_list_members').insert({
		list_id: listId,
		household_id: householdId,
		contact_id: null,
		created_by: userId
	} as never);
	return !error;
}

function findExistingContact(
	live: { id: string; first_name: string; last_name: string | null; household_id: string | null }[],
	first: string,
	last: string | null
): (typeof live)[0] | undefined {
	const fl = first.toLowerCase();
	const ll = (last ?? '').toLowerCase();
	return live.find(
		(c) =>
			c.first_name.toLowerCase() === fl && (c.last_name ?? '').toLowerCase() === ll
	);
}

export async function importSheet1AndPotentialInvite(
	supabase: SupabaseClient,
	userId: string,
	opts: {
		sheet1Csv: string;
		peopleForThingsCsv?: string | null;
	}
): Promise<ImportSheetResult> {
	const result: ImportSheetResult = {
		householdsCreated: 0,
		contactsCreated: 0,
		listsEnsured: [],
		membershipsAdded: 0,
		skipped: 0,
		errors: []
	};

	const rows = parseSheet1Csv(opts.sheet1Csv);
	if (rows.length === 0) {
		result.errors.push('No Sheet1 rows parsed.');
		return result;
	}

	const { data: existingContacts } = await supabase
		.from('contacts')
		.select('id, first_name, last_name, household_id')
		.is('deleted_at', null);
	const liveContacts = (existingContacts ?? []) as {
		id: string;
		first_name: string;
		last_name: string | null;
		household_id: string | null;
	}[];

	const groupListIds = new Map<string, string>();

	for (const row of rows) {
		try {
			await importOneRow(supabase, userId, row, liveContacts, groupListIds, result);
		} catch (e) {
			result.errors.push(`${row.rawName}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	result.listsEnsured = [...groupListIds.keys()];

	if (opts.peopleForThingsCsv?.trim()) {
		const inviteId = await ensureAdHocList(
			supabase,
			userId,
			POTENTIAL_INVITE,
			'From People for Things sheet — do not seed Christmas cards'
		);
		if (inviteId) {
			result.listsEnsured.push(POTENTIAL_INVITE);
			const names = parseNameListCsv(opts.peopleForThingsCsv);
			const { data: households } = await supabase
				.from('households')
				.select('id, name')
				.is('deleted_at', null);
			const hhByNorm = new Map(
				((households ?? []) as { id: string; name: string }[]).map((h) => [
					h.name.toLowerCase().replace(/\s+/g, ' '),
					h.id
				])
			);
			// Also index by contact display names → household
			const { data: allContacts } = await supabase
				.from('contacts')
				.select('first_name, last_name, household_id')
				.is('deleted_at', null);
			for (const c of (allContacts ?? []) as {
				first_name: string;
				last_name: string | null;
				household_id: string | null;
			}[]) {
				if (!c.household_id) continue;
				const dn = contactDisplayName(c).toLowerCase();
				hhByNorm.set(dn, c.household_id);
			}

			for (const raw of names) {
				const hhName = householdNameFromPeople(splitCoupleName(raw));
				const hid =
					hhByNorm.get(hhName.toLowerCase()) ??
					hhByNorm.get(raw.toLowerCase().replace(/\s+/g, ' '));
				if (!hid) continue;
				const added = await ensureHouseholdMembership(supabase, userId, inviteId, hid);
				if (added) result.membershipsAdded += 1;
			}
		}
	}

	return result;
}

async function importOneRow(
	supabase: SupabaseClient,
	userId: string,
	row: Sheet1Row,
	liveContacts: {
		id: string;
		first_name: string;
		last_name: string | null;
		household_id: string | null;
	}[],
	groupListIds: Map<string, string>,
	result: ImportSheetResult
) {
	// Skip if all people already exist
	const existingPeople = row.people.map((p) =>
		findExistingContact(liveContacts, p.first_name, p.last_name)
	);
	if (existingPeople.every(Boolean)) {
		result.skipped += 1;
		const hhId = existingPeople[0]!.household_id;
		if (hhId && row.group) {
			let listId = groupListIds.get(row.group);
			if (!listId) {
				listId = (await ensureStandingList(supabase, userId, row.group)) ?? undefined;
				if (listId) groupListIds.set(row.group, listId);
			}
			if (listId) {
				const added = await ensureHouseholdMembership(supabase, userId, listId, hhId);
				if (added) result.membershipsAdded += 1;
			}
		}
		return;
	}

	const addr = parseUsAddressLine(row.addressRaw);
	const hhName = householdNameFromPeople(row.people);

	const { data: hhIns, error: hhErr } = await supabase
		.from('households')
		.insert({
			name: hhName,
			...addr,
			giving_grade: row.giving,
			relationship_grade: row.relationship,
			address_updated_on: row.addressRaw ? ADDRESS_AS_OF : null,
			created_by: userId
		} as never)
		.select('id')
		.single();

	if (hhErr || !hhIns) {
		throw new Error(hhErr?.message ?? 'household insert failed');
	}
	const householdId = (hhIns as { id: string }).id;
	result.householdsCreated += 1;

	if (row.giving || row.relationship) {
		await supabase.from('household_grade_changes').insert({
			household_id: householdId,
			changed_on: ADDRESS_AS_OF,
			giving_grade: row.giving,
			relationship_grade: row.relationship,
			note: 'Sheet import',
			created_by: userId
		} as never);
	}

	for (const p of row.people) {
		const already = findExistingContact(liveContacts, p.first_name, p.last_name);
		if (already) continue;
		const { data: cIns, error: cErr } = await supabase
			.from('contacts')
			.insert({
				first_name: p.first_name,
				last_name: p.last_name,
				household_id: householdId,
				frequency: row.frequency,
				no_reminders: row.frequency === 'common',
				status: row.retired ? 'retired' : 'active',
				created_by: userId
			} as never)
			.select('id, first_name, last_name, household_id')
			.single();
		if (cErr || !cIns) {
			throw new Error(cErr?.message ?? 'contact insert failed');
		}
		liveContacts.push(cIns as (typeof liveContacts)[0]);
		result.contactsCreated += 1;
	}

	if (row.group) {
		let listId = groupListIds.get(row.group);
		if (!listId) {
			listId = (await ensureStandingList(supabase, userId, row.group)) ?? undefined;
			if (listId) groupListIds.set(row.group, listId);
		}
		if (listId) {
			const added = await ensureHouseholdMembership(supabase, userId, listId, householdId);
			if (added) result.membershipsAdded += 1;
		}
	}
}
