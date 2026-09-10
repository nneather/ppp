/**
 * Client-side roster search for `/contacts` (Contacts + Households).
 * Roster is ~200 rows — filter in memory so typing is instant ([223]).
 */

export type ContactQueryFields = {
	display_name: string;
	first_name: string;
	last_name: string | null;
	household_name: string | null;
	email: string | null;
	phone: string | null;
};

export type HouseholdQueryFields = {
	name: string;
	address_line_1: string | null;
	address_line_2: string | null;
	city: string | null;
	state: string | null;
	postal_code: string | null;
	notes: string | null;
};

export function tokenizeContactQuery(q: string): string[] {
	return q.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function digitsOnly(s: string): string {
	return s.replace(/\D/g, '');
}

export function haystackFromParts(parts: readonly (string | null | undefined)[]): string {
	const texts: string[] = [];
	const digitChunks: string[] = [];
	for (const p of parts) {
		if (!p) continue;
		const t = p.trim();
		if (!t) continue;
		texts.push(t.toLowerCase());
		const d = digitsOnly(t);
		if (d.length >= 3) digitChunks.push(d);
	}
	return `${texts.join(' ')} ${digitChunks.join(' ')}`.trim();
}

export function queryMatchesHaystack(q: string, haystack: string): boolean {
	const tokens = tokenizeContactQuery(q);
	if (tokens.length === 0) return true;
	return tokens.every((t) => {
		if (haystack.includes(t)) return true;
		const d = digitsOnly(t);
		return d.length >= 3 && haystack.includes(d);
	});
}

export function contactMatchesQuery(
	row: ContactQueryFields,
	q: string,
	listNames: readonly string[] = []
): boolean {
	return queryMatchesHaystack(
		q,
		haystackFromParts([
			row.display_name,
			row.first_name,
			row.last_name,
			row.household_name,
			row.email,
			row.phone,
			...listNames
		])
	);
}

export function householdMatchesQuery(
	row: HouseholdQueryFields,
	q: string,
	opts?: { listNames?: readonly string[]; memberNames?: readonly string[] }
): boolean {
	return queryMatchesHaystack(
		q,
		haystackFromParts([
			row.name,
			row.address_line_1,
			row.address_line_2,
			row.city,
			row.state,
			row.postal_code,
			row.notes,
			...(opts?.listNames ?? []),
			...(opts?.memberNames ?? [])
		])
	);
}

/** Last-name (contact) or household-name letter for A–Z group headers. */
export function nameLetterHeader(lastOrName: string | null, firstName = ''): string {
	const raw = (lastOrName?.trim() || firstName.trim() || '').normalize('NFC');
	const ch = [...raw][0];
	if (!ch) return '#';
	const upper = ch.toLocaleUpperCase('en-US');
	return /\p{L}/u.test(upper) ? upper : '#';
}
