/**
 * Pure helpers for Lists-tab mass-add candidate filtering.
 */

export type ListAddCandidateScope = 'not_on_list' | 'has_address' | 'all';

export type HouseholdListCandidate = {
	id: string;
	name: string;
	/** Already a live member of the selected list. */
	onList: boolean;
	/** C2: has ≥1 live active contact. */
	cardEligible: boolean;
	hasAddress: boolean;
};

export type ContactListCandidate = {
	id: string;
	display_name: string;
	onList: boolean;
};

export function householdHasMailingAddress(h: {
	address_line_1: string | null;
	address_line_2: string | null;
	city: string | null;
	state: string | null;
	postal_code: string | null;
	country: string | null;
}): boolean {
	return Boolean(
		h.address_line_1?.trim() ||
			h.address_line_2?.trim() ||
			h.city?.trim() ||
			h.state?.trim() ||
			h.postal_code?.trim() ||
			h.country?.trim()
	);
}

/**
 * Filter + sort household candidates for the Lists add checklist.
 * C2-ineligible households are always excluded (same as card roster).
 */
export function filterHouseholdListCandidates(
	candidates: readonly HouseholdListCandidate[],
	opts: { scope: ListAddCandidateScope; q?: string | null }
): HouseholdListCandidate[] {
	const q = opts.q?.trim().toLowerCase() || null;
	let rows = candidates.filter((c) => c.cardEligible);

	if (opts.scope === 'not_on_list') {
		rows = rows.filter((c) => !c.onList);
	} else if (opts.scope === 'has_address') {
		rows = rows.filter((c) => !c.onList && c.hasAddress);
	}
	// scope === 'all': keep on-list rows (UI shows them checked/disabled)

	if (q) {
		rows = rows.filter((c) => c.name.toLowerCase().includes(q));
	}

	return [...rows].sort(
		(a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
	);
}

export function filterContactListCandidates(
	candidates: readonly ContactListCandidate[],
	opts: { scope: 'not_on_list' | 'all'; q?: string | null }
): ContactListCandidate[] {
	const q = opts.q?.trim().toLowerCase() || null;
	let rows = [...candidates];

	if (opts.scope === 'not_on_list') {
		rows = rows.filter((c) => !c.onList);
	}

	if (q) {
		rows = rows.filter((c) => c.display_name.toLowerCase().includes(q));
	}

	return rows.sort(
		(a, b) =>
			a.display_name.localeCompare(b.display_name) || a.id.localeCompare(b.id)
	);
}
