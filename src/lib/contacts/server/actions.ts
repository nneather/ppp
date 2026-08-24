import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ymdInChicago } from '$lib/invoicing/chicago-date';
import { dueFanoutContactIds, householdEligibleForCardList } from '$lib/contacts/due';
import {
	listMemberToColumns,
	validateListMemberXor,
	type ListMemberParentInput
} from '$lib/contacts/list-member';
import {
	householdNameFromContact,
	isContactFrequency,
	isContactListKind,
	isContactStatus,
	isGivingGrade,
	isRelationshipGrade,
	parseFrequency
} from '$lib/contacts/names';
import { activePeriodForFrequency, isScheduledFrequency } from '$lib/contacts/period';
import type {
	ContactFrequency,
	ContactListKind,
	ContactStatus,
	GivingGrade,
	RelationshipGrade
} from '$lib/types/contacts';

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

async function loadHouseholdFanoutMembers(
	supabase: SupabaseClient,
	householdId: string
): Promise<{
	members: { id: string; household_id: string | null; status: ContactStatus; frequency: ContactFrequency }[];
	error: string | null;
}> {
	const { data, error } = await supabase
		.from('contacts')
		.select('id, household_id, status, frequency')
		.eq('household_id', householdId)
		.is('deleted_at', null);
	if (error) return { members: [], error: error.message };
	const members: {
		id: string;
		household_id: string | null;
		status: ContactStatus;
		frequency: ContactFrequency;
	}[] = [];
	for (const raw of (data ?? []) as {
		id: string;
		household_id: string | null;
		status: string;
		frequency: string;
	}[]) {
		if (!isContactStatus(raw.status) || !isContactFrequency(raw.frequency)) continue;
		members.push({
			id: raw.id,
			household_id: raw.household_id,
			status: raw.status,
			frequency: raw.frequency
		});
	}
	return { members, error: null };
}

async function upsertPeriodSkip(
	supabase: SupabaseClient,
	userId: string,
	opts: { contactId: string; periodKey: string; skippedOn: string; note: string | null }
): Promise<string | null> {
	const { data: existing } = await supabase
		.from('contact_period_skips')
		.select('id, deleted_at')
		.eq('contact_id', opts.contactId)
		.eq('period_key', opts.periodKey)
		.maybeSingle();

	if (existing && !(existing as { deleted_at: string | null }).deleted_at) {
		return null;
	}

	if (existing) {
		const { error: reviveErr } = await supabase
			.from('contact_period_skips')
			.update({
				deleted_at: null,
				skipped_on: opts.skippedOn,
				note: opts.note
			} as never)
			.eq('id', (existing as { id: string }).id);
		return reviveErr?.message ?? null;
	}

	const { error: insErr } = await supabase.from('contact_period_skips').insert({
		contact_id: opts.contactId,
		period_key: opts.periodKey,
		skipped_on: opts.skippedOn,
		note: opts.note,
		created_by: userId
	} as never);
	return insErr?.message ?? null;
}

/**
 * Frequency picker (C/Q/S/A/N or enum). Defaults to quarterly.
 */
function parseFrequencyFromForm(fd: FormData): ContactFrequency | 'invalid' {
	const raw = trimOrNull(fd.get('frequency'));
	if (!raw) return 'quarterly';
	const parsed = parseFrequency(raw);
	if (!isContactFrequency(parsed)) return 'invalid';
	return parsed;
}

function parseGivingFromForm(fd: FormData): GivingGrade | null | 'invalid' {
	const raw = trimOrNull(fd.get('giving_grade'));
	if (!raw) return null;
	if (!isGivingGrade(raw)) return 'invalid';
	return raw;
}

function parseRelFromForm(fd: FormData): RelationshipGrade | null | 'invalid' {
	const raw = trimOrNull(fd.get('relationship_grade'));
	if (!raw) return null;
	if (!isRelationshipGrade(raw)) return 'invalid';
	return raw;
}

function parseListKindFromForm(fd: FormData): ContactListKind {
	const raw = trimOrNull(fd.get('kind'));
	if (raw && isContactListKind(raw)) return raw;
	return 'standing';
}

/** @deprecated Rolling cadence — kept for legacy forms that still post amount/unit. */
function parseCadenceDaysFromForm(_fd: FormData): number | null | 'invalid' {
	return null;
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
	const giving = parseGivingFromForm(fd);
	if (giving === 'invalid') {
		return fail(400, { kind: 'createHousehold' as const, message: 'Invalid giving grade.' });
	}
	const rel = parseRelFromForm(fd);
	if (rel === 'invalid') {
		return fail(400, {
			kind: 'createHousehold' as const,
			message: 'Invalid relationship grade.'
		});
	}
	const addressStamp = addressHasAny(address) ? ymdInChicago() : null;

	const { data: inserted, error: insErr } = await supabase
		.from('households')
		.insert({
			name,
			...address,
			notes: trimOrNull(fd.get('notes')),
			giving_grade: giving,
			relationship_grade: rel,
			address_updated_on: addressStamp,
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

	const householdId = (inserted as { id: string }).id;
	const sync = await syncEntityListMemberships(supabase, userId, {
		kind: 'household',
		entityId: householdId,
		desiredListIds: parseDesiredListIds(fd)
	});
	if (sync.error) {
		return fail(500, {
			kind: 'createHousehold' as const,
			message: sync.error
		});
	}

	return {
		kind: 'createHousehold' as const,
		success: true as const,
		householdId
	};
}

export async function updateHouseholdAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
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
	const giving = parseGivingFromForm(fd);
	if (giving === 'invalid') {
		return fail(400, {
			kind: 'updateHousehold' as const,
			householdId,
			message: 'Invalid giving grade.'
		});
	}
	const rel = parseRelFromForm(fd);
	if (rel === 'invalid') {
		return fail(400, {
			kind: 'updateHousehold' as const,
			householdId,
			message: 'Invalid relationship grade.'
		});
	}

	const { data: existing } = await supabase
		.from('households')
		.select(
			'address_line_1, address_line_2, city, state, postal_code, country, giving_grade, relationship_grade, address_updated_on'
		)
		.eq('id', householdId)
		.is('deleted_at', null)
		.maybeSingle();

	const prev = existing as {
		address_line_1: string | null;
		address_line_2: string | null;
		city: string | null;
		state: string | null;
		postal_code: string | null;
		country: string | null;
		giving_grade: string | null;
		relationship_grade: string | null;
		address_updated_on: string | null;
	} | null;

	const addressChanged =
		prev != null &&
		(prev.address_line_1 !== address.address_line_1 ||
			prev.address_line_2 !== address.address_line_2 ||
			prev.city !== address.city ||
			prev.state !== address.state ||
			prev.postal_code !== address.postal_code ||
			prev.country !== address.country);

	const gradesChanged =
		prev != null &&
		(prev.giving_grade !== giving || prev.relationship_grade !== rel);

	const patch: Record<string, unknown> = {
		name,
		...address,
		notes: trimOrNull(fd.get('notes')),
		giving_grade: giving,
		relationship_grade: rel
	};
	if (addressChanged) {
		patch.address_updated_on = ymdInChicago();
	}

	const { error: updErr } = await supabase
		.from('households')
		.update(patch as never)
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

	if (gradesChanged) {
		await supabase.from('household_grade_changes').insert({
			household_id: householdId,
			changed_on: ymdInChicago(),
			giving_grade: giving,
			relationship_grade: rel,
			created_by: userId
		} as never);
	}

	const sync = await syncEntityListMemberships(supabase, userId, {
		kind: 'household',
		entityId: householdId,
		desiredListIds: parseDesiredListIds(fd)
	});
	if (sync.error) {
		return fail(500, {
			kind: 'updateHousehold' as const,
			householdId,
			message: sync.error
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
			address_updated_on: ymdInChicago(),
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

	const frequency = parseFrequencyFromForm(fd);
	if (frequency === 'invalid') {
		return fail(400, { kind: 'createContact' as const, message: 'Invalid frequency.' });
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

	const birthday = trimOrNull(fd.get('birthday'));
	if (birthday && !DATE_RE.test(birthday)) {
		return fail(400, { kind: 'createContact' as const, message: 'Invalid birthday.' });
	}

	const { data: inserted, error: insErr } = await supabase
		.from('contacts')
		.insert({
			first_name,
			last_name,
			household_id,
			email: trimOrNull(fd.get('email')),
			phone: trimOrNull(fd.get('phone')),
			frequency,
			no_reminders: frequency === 'common',
			cadence_days: null,
			status,
			notes: trimOrNull(fd.get('notes')),
			birthday,
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

	const contactId = (inserted as { id: string }).id;
	const sync = await syncEntityListMemberships(supabase, userId, {
		kind: 'contact',
		entityId: contactId,
		desiredListIds: parseDesiredListIds(fd)
	});
	if (sync.error) {
		return fail(500, {
			kind: 'createContact' as const,
			message: sync.error
		});
	}

	return {
		kind: 'createContact' as const,
		success: true as const,
		contactId,
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

	const frequency = parseFrequencyFromForm(fd);
	if (frequency === 'invalid') {
		return fail(400, {
			kind: 'updateContact' as const,
			contactId,
			message: 'Invalid frequency.'
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

	const birthday = trimOrNull(fd.get('birthday'));
	if (birthday && !DATE_RE.test(birthday)) {
		return fail(400, {
			kind: 'updateContact' as const,
			contactId,
			message: 'Invalid birthday.'
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
			frequency,
			no_reminders: frequency === 'common',
			cadence_days: null,
			status,
			notes: trimOrNull(fd.get('notes')),
			birthday
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

	const sync = await syncEntityListMemberships(supabase, userId, {
		kind: 'contact',
		entityId: contactId,
		desiredListIds: parseDesiredListIds(fd)
	});
	if (sync.error) {
		return fail(500, {
			kind: 'updateContact' as const,
			contactId,
			message: sync.error
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

	const householdIdRaw = trimOrNull(fd.get('household_id'));
	const householdId =
		householdIdRaw && UUID_RE.test(householdIdRaw) ? householdIdRaw : null;

	const touched_on = ymdInChicago();
	let ids = [contactId];
	if (householdId) {
		const { members, error: memErr } = await loadHouseholdFanoutMembers(supabase, householdId);
		if (memErr) {
			console.error('[contacts] logContactQuick fan-out', memErr);
			return fail(500, {
				kind: 'logContactQuick' as const,
				contactId,
				message: memErr
			});
		}
		ids = dueFanoutContactIds({ contact_id: contactId, household_id: householdId }, members);
	}

	const rows = ids.map((id) => ({
		contact_id: id,
		touched_on,
		note: null,
		kind: 'meet' as const,
		created_by: userId
	}));

	const { error: insErr } = await supabase.from('contact_touches').insert(rows as never);

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

/** Household-level meet log — fan out one kind=meet touch per live active member. */
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
		.eq('status', 'active')
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
			kind: parseListKindFromForm(fd),
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
			notes: trimOrNull(fd.get('notes')),
			kind: parseListKindFromForm(fd)
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
async function upsertListMember(
	supabase: SupabaseClient,
	userId: string,
	opts: {
		listId: string;
		contact_id: string | null;
		household_id: string | null;
	}
): Promise<{ memberId: string; created: boolean; alreadyLive: boolean; error: string | null }> {
	let existingQ = supabase
		.from('contact_list_members')
		.select('id, deleted_at')
		.eq('list_id', opts.listId);
	if (opts.contact_id) {
		existingQ = existingQ.eq('contact_id', opts.contact_id);
	} else {
		existingQ = existingQ.eq('household_id', opts.household_id!);
	}
	const { data: existingRows, error: existErr } = await existingQ.limit(1);
	if (existErr) {
		return { memberId: '', created: false, alreadyLive: false, error: existErr.message };
	}

	const existing = (existingRows?.[0] ?? null) as {
		id: string;
		deleted_at: string | null;
	} | null;

	if (existing) {
		if (existing.deleted_at == null) {
			return {
				memberId: existing.id,
				created: false,
				alreadyLive: true,
				error: null
			};
		}
		const { error: reviveErr } = await supabase
			.from('contact_list_members')
			.update({ deleted_at: null } as never)
			.eq('id', existing.id);
		if (reviveErr) {
			return {
				memberId: '',
				created: false,
				alreadyLive: false,
				error: reviveErr.message
			};
		}
		return {
			memberId: existing.id,
			created: false,
			alreadyLive: false,
			error: null
		};
	}

	const { data: inserted, error: insErr } = await supabase
		.from('contact_list_members')
		.insert({
			list_id: opts.listId,
			contact_id: opts.contact_id,
			household_id: opts.household_id,
			created_by: userId
		} as never)
		.select('id')
		.single();

	if (insErr || !inserted) {
		return {
			memberId: '',
			created: false,
			alreadyLive: false,
			error: insErr?.message ?? 'Could not add member.'
		};
	}

	return {
		memberId: (inserted as { id: string }).id,
		created: true,
		alreadyLive: false,
		error: null
	};
}

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
	const result = await upsertListMember(supabase, userId, {
		listId,
		contact_id: cols.contact_id,
		household_id: cols.household_id
	});

	if (result.error) {
		console.error('[contacts] addContactListMember', result.error);
		return fail(500, {
			kind: 'addContactListMember' as const,
			listId,
			message: result.error
		});
	}
	if (result.alreadyLive) {
		return fail(400, {
			kind: 'addContactListMember' as const,
			listId,
			message: 'Already on this list.'
		});
	}

	return {
		kind: 'addContactListMember' as const,
		success: true as const,
		listId,
		memberId: result.memberId
	};
}

const BATCH_MEMBER_CAP = 200;

/** Mass-add households or contacts to a list (one kind per submit). */
export async function addContactListMembersBatchAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const listId = trimOrNull(fd.get('list_id'));
	if (!listId || !UUID_RE.test(listId)) {
		return fail(400, {
			kind: 'addContactListMembersBatch' as const,
			message: 'Invalid list.'
		});
	}

	const kindRaw = trimOrNull(fd.get('member_kind'));
	if (kindRaw !== 'contact' && kindRaw !== 'household') {
		return fail(400, {
			kind: 'addContactListMembersBatch' as const,
			listId,
			message: 'Choose contact or household members.'
		});
	}

	const field = kindRaw === 'household' ? 'household_id' : 'contact_id';
	const rawIds = fd.getAll(field).map((v) => String(v).trim()).filter(Boolean);
	const ids = [...new Set(rawIds)].filter((id) => UUID_RE.test(id));

	if (ids.length === 0) {
		return fail(400, {
			kind: 'addContactListMembersBatch' as const,
			listId,
			message: 'Select at least one member to add.'
		});
	}
	if (ids.length > BATCH_MEMBER_CAP) {
		return fail(400, {
			kind: 'addContactListMembersBatch' as const,
			listId,
			message: `Add at most ${BATCH_MEMBER_CAP} at a time.`
		});
	}

	let added = 0;
	let skipped = 0;
	for (const id of ids) {
		const result = await upsertListMember(supabase, userId, {
			listId,
			contact_id: kindRaw === 'contact' ? id : null,
			household_id: kindRaw === 'household' ? id : null
		});
		if (result.error) {
			console.error('[contacts] addContactListMembersBatch', result.error);
			return fail(500, {
				kind: 'addContactListMembersBatch' as const,
				listId,
				message: result.error
			});
		}
		if (result.alreadyLive) skipped += 1;
		else added += 1;
	}

	return {
		kind: 'addContactListMembersBatch' as const,
		success: true as const,
		listId,
		count: added,
		skipped
	};
}

/**
 * Sync list memberships for one contact or household to match desired list ids.
 * Adds/revives missing; soft-deletes extras (same XOR parent).
 */
export async function syncEntityListMemberships(
	supabase: SupabaseClient,
	userId: string,
	opts: {
		kind: 'contact' | 'household';
		entityId: string;
		desiredListIds: string[];
	}
): Promise<{ error: string | null }> {
	const desired = [
		...new Set(opts.desiredListIds.filter((id) => UUID_RE.test(id)))
	];

	let liveQ = supabase
		.from('contact_list_members')
		.select('id, list_id')
		.is('deleted_at', null);
	if (opts.kind === 'contact') {
		liveQ = liveQ.eq('contact_id', opts.entityId);
	} else {
		liveQ = liveQ.eq('household_id', opts.entityId);
	}

	const { data: liveRows, error: liveErr } = await liveQ;
	if (liveErr) {
		console.error('[contacts] syncEntityListMemberships load', liveErr);
		return { error: liveErr.message };
	}

	const live = (liveRows ?? []) as { id: string; list_id: string }[];
	const liveByList = new Map(live.map((r) => [r.list_id, r.id]));
	const desiredSet = new Set(desired);

	const now = new Date().toISOString();
	for (const row of live) {
		if (desiredSet.has(row.list_id)) continue;
		const { error: delErr } = await supabase
			.from('contact_list_members')
			.update({ deleted_at: now } as never)
			.eq('id', row.id)
			.is('deleted_at', null);
		if (delErr) {
			console.error('[contacts] syncEntityListMemberships remove', delErr);
			return { error: delErr.message };
		}
	}

	for (const listId of desired) {
		if (liveByList.has(listId)) continue;
		const result = await upsertListMember(supabase, userId, {
			listId,
			contact_id: opts.kind === 'contact' ? opts.entityId : null,
			household_id: opts.kind === 'household' ? opts.entityId : null
		});
		if (result.error) {
			console.error('[contacts] syncEntityListMemberships add', result.error);
			return { error: result.error };
		}
	}

	return { error: null };
}

function parseDesiredListIds(fd: FormData): string[] {
	return [
		...new Set(
			fd
				.getAll('member_list_id')
				.map((v) => String(v).trim())
				.filter((id) => UUID_RE.test(id))
		)
	];
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

export { parseDesiredListIds };

/** Skip this contact's current period (not a successful meet). */
export async function skipContactPeriodAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const contactId = trimOrNull(fd.get('contact_id'));
	if (!contactId || !UUID_RE.test(contactId)) {
		return fail(400, { kind: 'skipContactPeriod' as const, message: 'Invalid contact.' });
	}

	const householdIdRaw = trimOrNull(fd.get('household_id'));
	const householdId =
		householdIdRaw && UUID_RE.test(householdIdRaw) ? householdIdRaw : null;

	const { data: contact, error: loadErr } = await supabase
		.from('contacts')
		.select('id, frequency, status')
		.eq('id', contactId)
		.is('deleted_at', null)
		.maybeSingle();

	if (loadErr || !contact) {
		return fail(404, {
			kind: 'skipContactPeriod' as const,
			contactId,
			message: loadErr?.message ?? 'Contact not found.'
		});
	}

	const postedStatus = (contact as { status: string }).status;
	if (!isContactStatus(postedStatus) || postedStatus !== 'active') {
		return fail(400, {
			kind: 'skipContactPeriod' as const,
			contactId,
			message: 'Only active contacts can be skipped.'
		});
	}

	const today = ymdInChicago();
	const note = trimOrNull(fd.get('note'));

	let targets: { id: string; frequency: ContactFrequency }[] = [];
	if (householdId) {
		const { members, error: memErr } = await loadHouseholdFanoutMembers(supabase, householdId);
		if (memErr) {
			return fail(500, {
				kind: 'skipContactPeriod' as const,
				contactId,
				message: memErr
			});
		}
		const ids = new Set(
			dueFanoutContactIds({ contact_id: contactId, household_id: householdId }, members)
		);
		targets = members
			.filter((m) => ids.has(m.id) && isScheduledFrequency(m.frequency))
			.map((m) => ({ id: m.id, frequency: m.frequency }));
	} else {
		const freq = (contact as { frequency: string }).frequency;
		if (!isContactFrequency(freq) || !isScheduledFrequency(freq)) {
			return fail(400, {
				kind: 'skipContactPeriod' as const,
				contactId,
				message: 'Only quarterly, semester, or annual contacts can be skipped.'
			});
		}
		targets = [{ id: contactId, frequency: freq }];
	}

	if (targets.length === 0) {
		return fail(400, {
			kind: 'skipContactPeriod' as const,
			contactId,
			message: 'Only quarterly, semester, or annual contacts can be skipped.'
		});
	}

	for (const t of targets) {
		if (!isScheduledFrequency(t.frequency)) continue;
		const period = activePeriodForFrequency(t.frequency, today);
		const err = await upsertPeriodSkip(supabase, userId, {
			contactId: t.id,
			periodKey: period.key,
			skippedOn: today,
			note
		});
		if (err) {
			return fail(500, {
				kind: 'skipContactPeriod' as const,
				contactId,
				message: err
			});
		}
	}

	return { kind: 'skipContactPeriod' as const, success: true as const, contactId };
}

/** Clone an ad-hoc list (memberships) under a new name. */
export async function cloneContactListAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const sourceId = trimOrNull(fd.get('list_id'));
	if (!sourceId || !UUID_RE.test(sourceId)) {
		return fail(400, { kind: 'cloneContactList' as const, message: 'Invalid list.' });
	}
	const name = trimOrNull(fd.get('name'));
	if (!name) {
		return fail(400, { kind: 'cloneContactList' as const, message: 'New list name is required.' });
	}

	const { data: source, error: srcErr } = await supabase
		.from('contact_lists')
		.select('id, notes, kind')
		.eq('id', sourceId)
		.is('deleted_at', null)
		.maybeSingle();
	if (srcErr || !source) {
		return fail(404, {
			kind: 'cloneContactList' as const,
			message: srcErr?.message ?? 'List not found.'
		});
	}

	const { data: inserted, error: insErr } = await supabase
		.from('contact_lists')
		.insert({
			name,
			notes: trimOrNull(fd.get('notes')) ?? (source as { notes: string | null }).notes,
			kind: 'ad_hoc',
			created_by: userId
		} as never)
		.select('id')
		.single();
	if (insErr || !inserted) {
		return fail(500, {
			kind: 'cloneContactList' as const,
			message: insErr?.message ?? 'Could not clone list.'
		});
	}
	const newId = (inserted as { id: string }).id;

	const { data: members } = await supabase
		.from('contact_list_members')
		.select('contact_id, household_id')
		.eq('list_id', sourceId)
		.is('deleted_at', null);

	const rows = ((members ?? []) as { contact_id: string | null; household_id: string | null }[])
		.map((m) => ({
			list_id: newId,
			contact_id: m.contact_id,
			household_id: m.household_id,
			created_by: userId
		}))
		.filter((m) => m.contact_id || m.household_id);

	if (rows.length) {
		const { error: memErr } = await supabase.from('contact_list_members').insert(rows as never);
		if (memErr) {
			console.error('[contacts] cloneContactList members', memErr);
			return fail(500, {
				kind: 'cloneContactList' as const,
				message: memErr.message
			});
		}
	}

	return { kind: 'cloneContactList' as const, success: true as const, listId: newId };
}

export async function createHouseholdChildAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const householdId = trimOrNull(fd.get('household_id'));
	if (!householdId || !UUID_RE.test(householdId)) {
		return fail(400, { kind: 'createHouseholdChild' as const, message: 'Invalid household.' });
	}
	const first_name = trimOrNull(fd.get('first_name'));
	if (!first_name) {
		return fail(400, {
			kind: 'createHouseholdChild' as const,
			householdId,
			message: 'First name is required.'
		});
	}
	const birthday = trimOrNull(fd.get('birthday'));
	if (birthday && !DATE_RE.test(birthday)) {
		return fail(400, {
			kind: 'createHouseholdChild' as const,
			householdId,
			message: 'Invalid birthday.'
		});
	}

	const { data: inserted, error: insErr } = await supabase
		.from('household_children')
		.insert({
			household_id: householdId,
			first_name,
			last_name: trimOrNull(fd.get('last_name')),
			birthday,
			notes: trimOrNull(fd.get('notes')),
			created_by: userId
		} as never)
		.select('id')
		.single();

	if (insErr || !inserted) {
		return fail(500, {
			kind: 'createHouseholdChild' as const,
			householdId,
			message: insErr?.message ?? 'Could not add child.'
		});
	}

	return {
		kind: 'createHouseholdChild' as const,
		success: true as const,
		householdId,
		childId: (inserted as { id: string }).id
	};
}

export async function updateHouseholdChildAction(supabase: SupabaseClient, fd: FormData) {
	const childId = trimOrNull(fd.get('child_id'));
	if (!childId || !UUID_RE.test(childId)) {
		return fail(400, { kind: 'updateHouseholdChild' as const, message: 'Invalid child.' });
	}
	const first_name = trimOrNull(fd.get('first_name'));
	if (!first_name) {
		return fail(400, {
			kind: 'updateHouseholdChild' as const,
			childId,
			message: 'First name is required.'
		});
	}
	const birthday = trimOrNull(fd.get('birthday'));
	if (birthday && !DATE_RE.test(birthday)) {
		return fail(400, {
			kind: 'updateHouseholdChild' as const,
			childId,
			message: 'Invalid birthday.'
		});
	}

	const { error: updErr } = await supabase
		.from('household_children')
		.update({
			first_name,
			last_name: trimOrNull(fd.get('last_name')),
			birthday,
			notes: trimOrNull(fd.get('notes'))
		} as never)
		.eq('id', childId)
		.is('deleted_at', null);

	if (updErr) {
		return fail(500, {
			kind: 'updateHouseholdChild' as const,
			childId,
			message: updErr.message
		});
	}
	return { kind: 'updateHouseholdChild' as const, success: true as const, childId };
}

export async function softDeleteHouseholdChildAction(supabase: SupabaseClient, fd: FormData) {
	const childId = trimOrNull(fd.get('child_id'));
	if (!childId || !UUID_RE.test(childId)) {
		return fail(400, { kind: 'softDeleteHouseholdChild' as const, message: 'Invalid child.' });
	}
	const { error: delErr } = await supabase
		.from('household_children')
		.update({ deleted_at: new Date().toISOString() } as never)
		.eq('id', childId)
		.is('deleted_at', null);
	if (delErr) {
		return fail(500, {
			kind: 'softDeleteHouseholdChild' as const,
			childId,
			message: delErr.message
		});
	}
	return { kind: 'softDeleteHouseholdChild' as const, success: true as const, childId };
}
