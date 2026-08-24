/**
 * Apply matched vCard fields onto contacts (birthday + empty email/phone only).
 */

import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { matchVCardsToContacts, parseVCardFile } from '$lib/contacts/vcard';
import { contactDisplayName } from '$lib/contacts/names';

export async function applyVCardImportAction(
	supabase: SupabaseClient,
	_userId: string,
	fd: FormData
) {
	const file = fd.get('vcard');
	if (!(file instanceof File) || file.size === 0) {
		return fail(400, {
			kind: 'applyVCardImport' as const,
			message: 'Upload a .vcf export from Mac Contacts.'
		});
	}
	const text = await file.text();
	const vcards = parseVCardFile(text);
	if (vcards.length === 0) {
		return fail(400, {
			kind: 'applyVCardImport' as const,
			message: 'No contacts found in vCard file.'
		});
	}

	const { data: contacts, error } = await supabase
		.from('contacts')
		.select('id, first_name, last_name, email, phone, birthday')
		.is('deleted_at', null);
	if (error) {
		return fail(500, { kind: 'applyVCardImport' as const, message: error.message });
	}

	const rows = (contacts ?? []) as {
		id: string;
		first_name: string;
		last_name: string | null;
		email: string | null;
		phone: string | null;
		birthday: string | null;
	}[];

	const matches = matchVCardsToContacts(
		vcards,
		rows.map((r) => ({
			id: r.id,
			first_name: r.first_name,
			last_name: r.last_name,
			display_name: contactDisplayName(r)
		}))
	);

	let updated = 0;
	const unmatched: string[] = [];
	for (const m of matches) {
		if (!m.contactId) {
			unmatched.push(m.vcard.fullName);
			continue;
		}
		const existing = rows.find((r) => r.id === m.contactId);
		if (!existing) continue;
		const patch: Record<string, string> = {};
		if (m.vcard.birthday && !existing.birthday) patch.birthday = m.vcard.birthday;
		if (m.vcard.email && !existing.email) patch.email = m.vcard.email;
		if (m.vcard.phone && !existing.phone) patch.phone = m.vcard.phone;
		if (Object.keys(patch).length === 0) continue;
		const { error: updErr } = await supabase
			.from('contacts')
			.update(patch as never)
			.eq('id', m.contactId)
			.is('deleted_at', null);
		if (!updErr) updated += 1;
	}

	return {
		kind: 'applyVCardImport' as const,
		success: true as const,
		updated,
		matched: matches.filter((m) => m.contactId).length,
		unmatchedCount: unmatched.length,
		unmatched: unmatched.slice(0, 40)
	};
}
