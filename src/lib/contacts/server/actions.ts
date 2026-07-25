import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ymdInChicago } from '$lib/invoicing/chicago-date';
import { cadenceToDays, isCadenceUnit } from '$lib/contacts/cadence';
import { householdEligibleForCardList } from '$lib/contacts/due';
import {
	listMemberToColumns,
	validateListMemberXor,
	type ListMemberParentInput
} from '$lib/contacts/list-member';
import { householdNameFromContact, isContactStatus } from '$lib/contacts/names';
import type { ContactStatus } from '$lib/types/contacts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function trimOrNull(v: FormDataEntryValue | null): string | null {
	if (v === null || v === undefined) return null;
	const t = String(v).trim();
	return t.length > 0 ? t : null;
}

function parseBool(v: FormDataEntryValue | null): boolean {
	if (v === null || v === undefined) return false;
	const s = String(v).toLowerCase();
	return s === 'on' || s === 'true' || s === '1' || s === 'yes';
}

/**
 * Months/years picker → day-equivalent, or null when amount empty (use default).
 * Accepts legacy `cadence_days` only as fallback if amount/unit absent.
 */
function parseCadenceDaysFromForm(fd: FormData): number | null | 'invalid' {
	const amountRaw = trimOrNull(fd.get('cadence_amount'));
	const unitRaw = trimOrNull(fd.get('cadence_unit'));
	if (amountRaw || unitRaw) {
		if (!amountRaw) return null;
		const amount = Number.parseInt(amountRaw, 10);
		if (!Number.isFinite(amount) || amount < 1) return 'invalid';
		if (!unitRaw || !isCadenceUnit(unitRaw)) return 'invalid';
		try {
			return cadenceToDays(amount, unitRaw);
		} catch {
			return 'invalid';
		}
	}
	const legacy = trimOrNull(fd.get('cadence_days'));
	if (!legacy) return null;
	const n = Number.parseInt(legacy, 10);
	if (!Number.isFinite(n) || n < 1) return 'invalid';
	return n;
}

type AddressFields = {
	address_line_1: string | null;
	address_line_2: string | null;
	city: string | null;
	state: string | null;
	postal_code: string | null;
	country: string | null;
};

function parseAddress(fd: FormData): AddressFields {
	return {
		address_line_1: trimOrNull(fd.get('address_line_1')),
		address_line_2: trimOrNull(fd.get('address_line_2')),
		city: trimOrNull(fd.get('city')),
		state: trimOrNull(fd.get('state')),
		postal_code: trimOrNull(fd.get('postal_code')),
		country: trimOrNull(fd.get('country'))
	};
}

function addressHasAny(a: AddressFields): boolean {
	return Boolean(
		a.address_line_1 || a.address_line_2 || a.city || a.state || a.postal_code || a.country
	);
}

// ─── Households ────────────────────────────────────────────────────────────

export async function createHouseholdAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const name = trimOrNull(fd.get('name'));
	if (!name) {
		return fail(400, { kind: 'createHousehold' as const, message: 'Household name is required.' });
	}

	const address = parseAddress(fd);
	const { data: inserted, error: insErr } = await supabase
		.from('households')
		.insert({
			name,
			...address,
			notes: trimOrNull(fd.get('notes')),
			created_by: userId
		} as never)
		.select('id')
		.single();

	if (insErr || !inserted) {
		console.error('[contacts] createHousehold', insErr);
		return fail(500, {
			kind: 'createHousehold' as const,
			message: insErr?.message ?? 'Could not create household.'
		});
	}

	return {
		kind: 'createHousehold' as const,
		success: true as const,
		householdId: (inserted as { id: string }).id
	};
}

export async function updateHouseholdAction(supabase: SupabaseClient, fd: FormData) {
	const householdId = trimOrNull(fd.get('household_id'));
	if (!householdId || !UUID_RE.test(householdId)) {
		return fail(400, { kind: 'updateHousehold' as const, message: 'Invalid household.' });
	}

	const name = trimOrNull(fd.get('name'));
	if (!name) {
		return fail(400, {
			kind: 'updateHousehold' as const,
			householdId,
			message: 'Household name is required.'
		});
	}

	const address = parseAddress(fd);
	const { error: updErr } = await supabase
		.from('households')
		.update({
			name,
			...address,
			notes: trimOrNull(fd.get('notes'))
		} as never)
		.eq('id', householdId)
		.is('deleted_at', null);

	if (updErr) {
		console.error('[contacts] updateHousehold', updErr);
		return fail(500, {
			kind: 'updateHousehold' as const,
			householdId,
			message: updErr.message
		});
	}

	return { kind: 'updateHousehold' as const, success: true as const, householdId };
}

/** H2: block soft-delete while live members remain (venues pattern). */
export async function softDeleteHouseholdAction(supabase: SupabaseClient, fd: FormData) {
	const householdId = trimOrNull(fd.get('household_id'));
	if (!householdId || !UUID_RE.test(householdId)) {
		return fail(400, { kind: 'softDeleteHousehold' as const, message: 'Invalid household.' });
	}

	const { count, error: countErr } = await supabase
		.from('contacts')
		.select('id', { count: 'exact', head: true })
		.eq('household_id', householdId)
		.is('deleted_at', null);

	if (countErr) {
		console.error('[contacts] softDeleteHousehold count', countErr);
		return fail(500, {
			kind: 'softDeleteHousehold' as const,
			householdId,
			message: countErr.message
		});
	}
	if ((count ?? 0) > 0) {
		return fail(400, {
			kind: 'softDeleteHousehold' as const,
			householdId,
			message: 'Move or clear household members before deleting this household.'
		});
	}

	const now = new Date().toISOString();
	const { error: delErr } = await supabase
		.from('households')
		.update({ deleted_at: now } as never)
		.eq('id', householdId)
		.is('deleted_at', null);

	if (delErr) {
		console.error('[contacts] softDeleteHousehold', delErr);
		return fail(500, {
			kind: 'softDeleteHousehold' as const,
			householdId,
			message: delErr.message
		});
	}

	return { kind: 'softDeleteHousehold' as const, success: true as const, householdId };
}

// ─── Contacts ──────────────────────────────────────────────────────────────

async function maybeCreateHouseholdOfOne(
	supabase: SupabaseClient,
	userId: string,
	opts: {
		first_name: string;
		last_name: string | null;
		address: AddressFields;
		existingHouseholdId: string | null;
	}
): Promise<{ householdId: string | null; error: string | null }> {
	if (opts.existingHouseholdId) {
		return { householdId: opts.existingHouseholdId, error: null };
	}
	if (!addressHasAny(opts.address)) {
		return { householdId: null, error: null };
	}

	const name = householdNameFromContact({
		first_name: opts.first_name,
		last_name: opts.last_name
	});
	const { data: inserted, error: insErr } = await supabase
		.from('households')
		.insert({
			name,
			...opts.address,
			created_by: userId
		} as never)
		.select('id')
		.single();

	if (insErr || !inserted) {
		console.error('[contacts] household-of-one', insErr);
		return { householdId: null, error: insErr?.message ?? 'Could not create household.' };
	}
	return { householdId: (inserted as { id: string }).id, error: null };
}

export async function createContactAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const first_name = trimOrNull(fd.get('first_name'));
	if (!first_name) {
		return fail(400, { kind: 'createContact' as const, message: 'First name is required.' });
	}

	const last_name = trimOrNull(fd.get('last_name'));
	const statusRaw = trimOrNull(fd.get('status')) ?? 'active';
	if (!isContactStatus(statusRaw)) {
		return fail(400, { kind: 'createContact' as const, message: 'Invalid status.' });
	}
	const status = statusRaw as ContactStatus;

	const cadence = parseCadenceDaysFromForm(fd);
	if (cadence === 'invalid') {
		return fail(400, {
			kind: 'createContact' as const,
			message: 'Cadence must be a positive number of months or years.'
		});
	}

	let household_id = trimOrNull(fd.get('household_id'));
	if (household_id && !UUID_RE.test(household_id)) {
		return fail(400, { kind: 'createContact' as const, message: 'Invalid household.' });
	}

	const address = parseAddress(fd);
	const hh = await maybeCreateHouseholdOfOne(supabase, userId, {
		first_name,
		last_name,
		address,
		existingHouseholdId: household_id
	});
	if (hh.error) {
		return fail(500, { kind: 'createContact' as const, message: hh.error });
	}
	household_id = hh.householdId;

	const { data: inserted, error: insErr } = await supabase
		.from('contacts')
		.insert({
			first_name,
			last_name,
			household_id,
			email: trimOrNull(fd.get('email')),
			phone: trimOrNull(fd.get('phone')),
			cadence_days: cadence,
			no_reminders: parseBool(fd.get('no_reminders')),
			status,
			notes: trimOrNull(fd.get('notes')),
			created_by: userId
		} as never)
		.select('id')
		.single();

	if (insErr || !inserted) {
		console.error('[contacts] createContact', insErr);
		return fail(500, {
			kind: 'createContact' as const,
			message: insErr?.message ?? 'Could not create contact.'
		});
	}

	return {
		kind: 'createContact' as const,
		success: true as const,
		contactId: (inserted as { id: string }).id,
		householdId: household_id
	};
}

export async function updateContactAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const contactId = trimOrNull(fd.get('contact_id'));
	if (!contactId || !UUID_RE.test(contactId)) {
		return fail(400, { kind: 'updateContact' as const, message: 'Invalid contact.' });
	}

	const first_name = trimOrNull(fd.get('first_name'));
	if (!first_name) {
		return fail(400, {
			kind: 'updateContact' as const,
			contactId,
			message: 'First name is required.'
		});
	}

	const last_name = trimOrNull(fd.get('last_name'));
	const statusRaw = trimOrNull(fd.get('status')) ?? 'active';
	if (!isContactStatus(statusRaw)) {
		return fail(400, {
			kind: 'updateContact' as const,
			contactId,
			message: 'Invalid status.'
		});
	}
	const status = statusRaw as ContactStatus;

	const cadence = parseCadenceDaysFromForm(fd);
	if (cadence === 'invalid') {
		return fail(400, {
			kind: 'updateContact' as const,
			contactId,
			message: 'Cadence must be a positive number of months or years.'
		});
	}

	let household_id = trimOrNull(fd.get('household_id'));
	if (household_id && !UUID_RE.test(household_id)) {
		return fail(400, {
			kind: 'updateContact' as const,
			contactId,
			message: 'Invalid household.'
		});
	}

	const { data: existing, error: loadErr } = await supabase
		.from('contacts')
		.select('id, household_id')
		.eq('id', contactId)
		.is('deleted_at', null)
		.maybeSingle();

	if (loadErr) {
		console.error('[contacts] updateContact load', loadErr);
		return fail(500, {
			kind: 'updateContact' as const,
			contactId,
			message: loadErr.message
		});
	}
	if (!existing) {
		return fail(404, {
			kind: 'updateContact' as const,
			contactId,
			message: 'Contact not found.'
		});
	}

	// Empty household select = clear. Address fields auto-create household-of-one (H1)
	// only when no household is selected.
	const address = parseAddress(fd);
	if (!household_id && addressHasAny(address)) {
		const hh = await maybeCreateHouseholdOfOne(supabase, userId, {
			first_name,
			last_name,
			address,
			existingHouseholdId: null
		});
		if (hh.error) {
			return fail(500, {
				kind: 'updateContact' as const,
				contactId,
				message: hh.error
			});
		}
		household_id = hh.householdId;
	}

	const { error: updErr } = await supabase
		.from('contacts')
		.update({
			first_name,
			last_name,
			household_id,
			email: trimOrNull(fd.get('email')),
			phone: trimOrNull(fd.get('phone')),
			cadence_days: cadence,
			no_reminders: parseBool(fd.get('no_reminders')),
			status,
			notes: trimOrNull(fd.get('notes'))
		} as never)
		.eq('id', contactId)
		.is('deleted_at', null);

	if (updErr) {
		console.error('[contacts] updateContact', updErr);
		return fail(500, {
			kind: 'updateContact' as const,
			contactId,
			message: updErr.message
		});
	}

	return {
		kind: 'updateContact' as const,
		success: true as const,
		contactId,
		householdId: household_id
	};
}

export async function softDeleteContactAction(supabase: SupabaseClient, fd: FormData) {
	const contactId = trimOrNull(fd.get('contact_id'));
	if (!contactId || !UUID_RE.test(contactId)) {
		return fail(400, { kind: 'softDeleteContact' as const, message: 'Invalid contact.' });
	}

	const now = new Date().toISOString();
	const { error: delErr } = await supabase
		.from('contacts')
		.update({ deleted_at: now } as never)
		.eq('id', contactId)
		.is('deleted_at', null);

	if (delErr) {
		console.error('[contacts] softDeleteContact', delErr);
		return fail(500, {
			kind: 'softDeleteContact' as const,
			contactId,
			message: delErr.message
		});
	}

	return { kind: 'softDeleteContact' as const, success: true as const, contactId };
}

// ─── Touches ───────────────────────────────────────────────────────────────

/** One-tap Log Contact — today (Chicago), null note, kind=meet. */
export async function logContactQuickAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const contactId = trimOrNull(fd.get('contact_id'));
	if (!contactId || !UUID_RE.test(contactId)) {
		return fail(400, { kind: 'logContactQuick' as const, message: 'Invalid contact.' });
	}

	const touched_on = ymdInChicago();
	const { error: insErr } = await supabase.from('contact_touches').insert({
		contact_id: contactId,
		touched_on,
		note: null,
		kind: 'meet',
		created_by: userId
	} as never);

	if (insErr) {
		console.error('[contacts] logContactQuick', insErr);
		return fail(500, {
			kind: 'logContactQuick' as const,
			contactId,
			message: insErr.message
		});
	}

	return {
		kind: 'logContactQuick' as const,
		success: true as const,
		contactId,
		touched_on
	};
}

/** Detailed meet touch — optional note + optional backdate (T1). */
export async function logContactDetailedAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const contactId = trimOrNull(fd.get('contact_id'));
	if (!contactId || !UUID_RE.test(contactId)) {
		return fail(400, { kind: 'logContactDetailed' as const, message: 'Invalid contact.' });
	}

	const touchedRaw = trimOrNull(fd.get('touched_on'));
	const touched_on = touchedRaw && DATE_RE.test(touchedRaw) ? touchedRaw : ymdInChicago();
	const note = trimOrNull(fd.get('note'));

	const { error: insErr } = await supabase.from('contact_touches').insert({
		contact_id: contactId,
		touched_on,
		note,
		kind: 'meet',
		created_by: userId
	} as never);

	if (insErr) {
		console.error('[contacts] logContactDetailed', insErr);
		return fail(500, {
			kind: 'logContactDetailed' as const,
			contactId,
			message: insErr.message
		});
	}

	return {
		kind: 'logContactDetailed' as const,
		success: true as const,
		contactId,
		touched_on
	};
}

/** Household-level meet log — fan out one kind=meet touch per live member. */
export async function logHouseholdTouchAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const householdId = trimOrNull(fd.get('household_id'));
	if (!householdId || !UUID_RE.test(householdId)) {
		return fail(400, { kind: 'logHouseholdTouch' as const, message: 'Invalid household.' });
	}

	const touchedRaw = trimOrNull(fd.get('touched_on'));
	const touched_on = touchedRaw && DATE_RE.test(touchedRaw) ? touchedRaw : ymdInChicago();
	const note = trimOrNull(fd.get('note'));

	const { data: members, error: memErr } = await supabase
		.from('contacts')
		.select('id')
		.eq('household_id', householdId)
		.is('deleted_at', null);

	if (memErr) {
		console.error('[contacts] logHouseholdTouch members', memErr);
		return fail(500, {
			kind: 'logHouseholdTouch' as const,
			householdId,
			message: memErr.message
		});
	}

	const ids = ((members ?? []) as { id: string }[]).map((m) => m.id);
	if (ids.length === 0) {
		return fail(400, {
			kind: 'logHouseholdTouch' as const,
			householdId,
			message: 'This household has no contacts to log.'
		});
	}

	const rows = ids.map((contact_id) => ({
		contact_id,
		touched_on,
		note,
		kind: 'meet' as const,
		created_by: userId
	}));

	const { error: insErr } = await supabase.from('contact_touches').insert(rows as never);
	if (insErr) {
		console.error('[contacts] logHouseholdTouch insert', insErr);
		return fail(500, {
			kind: 'logHouseholdTouch' as const,
			householdId,
			message: insErr.message
		});
	}

	return {
		kind: 'logHouseholdTouch' as const,
		success: true as const,
		householdId,
		touched_on,
		count: ids.length
	};
}

/**
 * Christmas-card (list) bulk log — kind=card for every live member of every
 * C2-eligible household currently on the list. Does not affect due-to-meet.
 */
export async function logListCardsAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const listId = trimOrNull(fd.get('list_id'));
	if (!listId || !UUID_RE.test(listId)) {
		return fail(400, { kind: 'logListCards' as const, message: 'Invalid list.' });
	}

	const touchedRaw = trimOrNull(fd.get('touched_on'));
	const touched_on = touchedRaw && DATE_RE.test(touchedRaw) ? touchedRaw : ymdInChicago();
	const note = trimOrNull(fd.get('note'));

	const { data: memberRows, error: memErr } = await supabase
		.from('contact_list_members')
		.select('household_id')
		.eq('list_id', listId)
		.is('deleted_at', null)
		.not('household_id', 'is', null);

	if (memErr) {
		console.error('[contacts] logListCards members', memErr);
		return fail(500, {
			kind: 'logListCards' as const,
			listId,
			message: memErr.message
		});
	}

	const householdIds = [
		...new Set(
			((memberRows ?? []) as { household_id: string | null }[])
				.map((r) => r.household_id)
				.filter((id): id is string => id != null)
		)
	];

	if (householdIds.length === 0) {
		return fail(400, {
			kind: 'logListCards' as const,
			listId,
			message: 'No households on this list to log cards for.'
		});
	}

	const { data: contacts, error: contactErr } = await supabase
		.from('contacts')
		.select('id, household_id, status')
		.in('household_id', householdIds)
		.is('deleted_at', null);

	if (contactErr) {
		console.error('[contacts] logListCards contacts', contactErr);
		return fail(500, {
			kind: 'logListCards' as const,
			listId,
			message: contactErr.message
		});
	}

	const liveByHousehold = new Map<string, { id: string; status: ContactStatus }[]>();
	for (const raw of (contacts ?? []) as {
		id: string;
		household_id: string;
		status: string;
	}[]) {
		if (!isContactStatus(raw.status)) continue;
		const list = liveByHousehold.get(raw.household_id) ?? [];
		list.push({ id: raw.id, status: raw.status });
		liveByHousehold.set(raw.household_id, list);
	}

	const contactIds: string[] = [];
	for (const hid of householdIds) {
		const live = liveByHousehold.get(hid) ?? [];
		if (!householdEligibleForCardList({ liveMembers: live })) continue;
		for (const m of live) contactIds.push(m.id);
	}

	if (contactIds.length === 0) {
		return fail(400, {
			kind: 'logListCards' as const,
			listId,
			message: 'No eligible household members to log cards for.'
		});
	}

	const rows = contactIds.map((contact_id) => ({
		contact_id,
		touched_on,
		note,
		kind: 'card' as const,
		created_by: userId
	}));

	const { error: insErr } = await supabase.from('contact_touches').insert(rows as never);
	if (insErr) {
		console.error('[contacts] logListCards insert', insErr);
		return fail(500, {
			kind: 'logListCards' as const,
			listId,
			message: insErr.message
		});
	}

	return {
		kind: 'logListCards' as const,
		success: true as const,
		listId,
		touched_on,
		count: contactIds.length
	};
}

/** Profile default meet cadence (months/years → days). Empty amount clears to app default. */
export async function updateContactCadenceDefaultAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const cadence = parseCadenceDaysFromForm(fd);
	if (cadence === 'invalid') {
		return fail(400, {
			kind: 'updateContactCadenceDefault' as const,
			message: 'Cadence must be a positive number of months or years.'
		});
	}

	const { error: updErr } = await supabase
		.from('profiles')
		.update({ contact_cadence_days_default: cadence } as never)
		.eq('id', userId);

	if (updErr) {
		console.error('[contacts] updateContactCadenceDefault', updErr);
		return fail(500, {
			kind: 'updateContactCadenceDefault' as const,
			message: updErr.message
		});
	}

	return {
		kind: 'updateContactCadenceDefault' as const,
		success: true as const,
		contact_cadence_days_default: cadence
	};
}

// ─── Lists ─────────────────────────────────────────────────────────────────

export async function createContactListAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const name = trimOrNull(fd.get('name'));
	if (!name) {
		return fail(400, { kind: 'createContactList' as const, message: 'List name is required.' });
	}

	const { data: inserted, error: insErr } = await supabase
		.from('contact_lists')
		.insert({
			name,
			notes: trimOrNull(fd.get('notes')),
			created_by: userId
		} as never)
		.select('id')
		.single();

	if (insErr || !inserted) {
		console.error('[contacts] createContactList', insErr);
		return fail(500, {
			kind: 'createContactList' as const,
			message: insErr?.message ?? 'Could not create list.'
		});
	}

	return {
		kind: 'createContactList' as const,
		success: true as const,
		listId: (inserted as { id: string }).id
	};
}

export async function updateContactListAction(supabase: SupabaseClient, fd: FormData) {
	const listId = trimOrNull(fd.get('list_id'));
	if (!listId || !UUID_RE.test(listId)) {
		return fail(400, { kind: 'updateContactList' as const, message: 'Invalid list.' });
	}

	const name = trimOrNull(fd.get('name'));
	if (!name) {
		return fail(400, {
			kind: 'updateContactList' as const,
			listId,
			message: 'List name is required.'
		});
	}

	const { error: updErr } = await supabase
		.from('contact_lists')
		.update({
			name,
			notes: trimOrNull(fd.get('notes'))
		} as never)
		.eq('id', listId)
		.is('deleted_at', null);

	if (updErr) {
		console.error('[contacts] updateContactList', updErr);
		return fail(500, {
			kind: 'updateContactList' as const,
			listId,
			message: updErr.message
		});
	}

	return { kind: 'updateContactList' as const, success: true as const, listId };
}

export async function softDeleteContactListAction(supabase: SupabaseClient, fd: FormData) {
	const listId = trimOrNull(fd.get('list_id'));
	if (!listId || !UUID_RE.test(listId)) {
		return fail(400, { kind: 'softDeleteContactList' as const, message: 'Invalid list.' });
	}

	const now = new Date().toISOString();

	// Soft-delete members first, then the list.
	const { error: memErr } = await supabase
		.from('contact_list_members')
		.update({ deleted_at: now } as never)
		.eq('list_id', listId)
		.is('deleted_at', null);

	if (memErr) {
		console.error('[contacts] softDeleteContactList members', memErr);
		return fail(500, {
			kind: 'softDeleteContactList' as const,
			listId,
			message: memErr.message
		});
	}

	const { error: delErr } = await supabase
		.from('contact_lists')
		.update({ deleted_at: now } as never)
		.eq('id', listId)
		.is('deleted_at', null);

	if (delErr) {
		console.error('[contacts] softDeleteContactList', delErr);
		return fail(500, {
			kind: 'softDeleteContactList' as const,
			listId,
			message: delErr.message
		});
	}

	return { kind: 'softDeleteContactList' as const, success: true as const, listId };
}

/**
 * Add member — contact XOR household.
 * Footgun NEW-D: revive soft-deleted membership by PK instead of onConflict.
 */
export async function addContactListMemberAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const listId = trimOrNull(fd.get('list_id'));
	if (!listId || !UUID_RE.test(listId)) {
		return fail(400, { kind: 'addContactListMember' as const, message: 'Invalid list.' });
	}

	const kindRaw = trimOrNull(fd.get('member_kind'));
	if (kindRaw !== 'contact' && kindRaw !== 'household') {
		return fail(400, {
			kind: 'addContactListMember' as const,
			listId,
			message: 'Choose a contact or household.'
		});
	}

	let parentInput: ListMemberParentInput;
	if (kindRaw === 'contact') {
		parentInput = { kind: 'contact', contact_id: trimOrNull(fd.get('contact_id')) };
	} else {
		parentInput = { kind: 'household', household_id: trimOrNull(fd.get('household_id')) };
	}

	let parent;
	try {
		parent = validateListMemberXor(parentInput);
	} catch (e) {
		return fail(400, {
			kind: 'addContactListMember' as const,
			listId,
			message: e instanceof Error ? e.message : 'Invalid member.'
		});
	}

	const cols = listMemberToColumns(parent);

	// Look for existing (incl. soft-deleted) membership to revive.
	let existingQ = supabase
		.from('contact_list_members')
		.select('id, deleted_at')
		.eq('list_id', listId);
	if (cols.contact_id) {
		existingQ = existingQ.eq('contact_id', cols.contact_id);
	} else {
		existingQ = existingQ.eq('household_id', cols.household_id!);
	}
	const { data: existingRows, error: existErr } = await existingQ.limit(1);
	if (existErr) {
		console.error('[contacts] addContactListMember lookup', existErr);
		return fail(500, {
			kind: 'addContactListMember' as const,
			listId,
			message: existErr.message
		});
	}

	const existing = (existingRows?.[0] ?? null) as {
		id: string;
		deleted_at: string | null;
	} | null;

	if (existing) {
		if (existing.deleted_at == null) {
			return fail(400, {
				kind: 'addContactListMember' as const,
				listId,
				message: 'Already on this list.'
			});
		}
		const { error: reviveErr } = await supabase
			.from('contact_list_members')
			.update({ deleted_at: null } as never)
			.eq('id', existing.id);
		if (reviveErr) {
			console.error('[contacts] addContactListMember revive', reviveErr);
			return fail(500, {
				kind: 'addContactListMember' as const,
				listId,
				message: reviveErr.message
			});
		}
		return {
			kind: 'addContactListMember' as const,
			success: true as const,
			listId,
			memberId: existing.id
		};
	}

	const { data: inserted, error: insErr } = await supabase
		.from('contact_list_members')
		.insert({
			list_id: listId,
			...cols,
			created_by: userId
		} as never)
		.select('id')
		.single();

	if (insErr || !inserted) {
		console.error('[contacts] addContactListMember', insErr);
		return fail(500, {
			kind: 'addContactListMember' as const,
			listId,
			message: insErr?.message ?? 'Could not add member.'
		});
	}

	return {
		kind: 'addContactListMember' as const,
		success: true as const,
		listId,
		memberId: (inserted as { id: string }).id
	};
}

export async function softDeleteContactListMemberAction(
	supabase: SupabaseClient,
	fd: FormData
) {
	const memberId = trimOrNull(fd.get('member_id'));
	if (!memberId || !UUID_RE.test(memberId)) {
		return fail(400, {
			kind: 'softDeleteContactListMember' as const,
			message: 'Invalid member.'
		});
	}

	const now = new Date().toISOString();
	const { error: delErr } = await supabase
		.from('contact_list_members')
		.update({ deleted_at: now } as never)
		.eq('id', memberId)
		.is('deleted_at', null);

	if (delErr) {
		console.error('[contacts] softDeleteContactListMember', delErr);
		return fail(500, {
			kind: 'softDeleteContactListMember' as const,
			memberId,
			message: delErr.message
		});
	}

	return {
		kind: 'softDeleteContactListMember' as const,
		success: true as const,
		memberId
	};
}
