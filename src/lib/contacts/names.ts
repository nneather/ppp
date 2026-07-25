import {
	DEFAULT_CONTACT_CADENCE_DAYS,
	type ContactStatus
} from '$lib/types/contacts';

/** Display name: first + optional last. */
export function contactDisplayName(c: {
	first_name: string;
	last_name: string | null;
}): string {
	const last = c.last_name?.trim();
	if (last) return `${c.first_name.trim()} ${last}`;
	return c.first_name.trim();
}

/** Household-of-one default name from a contact. */
export function householdNameFromContact(c: {
	first_name: string;
	last_name: string | null;
}): string {
	return contactDisplayName(c);
}

/** Effective cadence: contact override → profile default → app constant (90). */
export function effectiveCadenceDays(
	contactCadence: number | null | undefined,
	profileDefault: number | null | undefined
): number {
	if (contactCadence != null && Number.isFinite(contactCadence) && contactCadence > 0) {
		return Math.floor(contactCadence);
	}
	if (profileDefault != null && Number.isFinite(profileDefault) && profileDefault > 0) {
		return Math.floor(profileDefault);
	}
	return DEFAULT_CONTACT_CADENCE_DAYS;
}

/** One-line address summary for list/cards. */
export function formatHouseholdAddress(h: {
	address_line_1: string | null;
	address_line_2: string | null;
	city: string | null;
	state: string | null;
	postal_code: string | null;
	country: string | null;
}): string | null {
	const line1 = h.address_line_1?.trim() || null;
	const cityState = [h.city?.trim(), h.state?.trim()].filter(Boolean).join(', ');
	const postal = h.postal_code?.trim() || null;
	const cityLine = [cityState, postal].filter(Boolean).join(' ');
	const parts = [line1, cityLine || null].filter(Boolean);
	if (parts.length === 0) return null;
	const country = h.country?.trim();
	if (country && country.toUpperCase() !== 'US' && country.toUpperCase() !== 'USA') {
		parts.push(country);
	}
	return parts.join(' · ');
}

export function isContactStatus(v: string): v is ContactStatus {
	return v === 'active' || v === 'retired';
}
