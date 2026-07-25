/**
 * Contact XOR household validator for `contact_list_members`.
 * Mirrors the schema CHECK + library `validateXor` pattern.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ListMemberParent =
	| { kind: 'contact'; contact_id: string }
	| { kind: 'household'; household_id: string };

export type ListMemberParentInput =
	| { kind: 'contact'; contact_id?: string | null }
	| { kind: 'household'; household_id?: string | null };

export function validateListMemberXor(input: ListMemberParentInput): ListMemberParent {
	if (input.kind === 'contact') {
		const id = (input.contact_id ?? '').trim();
		if (!UUID_RE.test(id)) {
			throw new Error('List member: contact_id is required and must be a UUID.');
		}
		return { kind: 'contact', contact_id: id };
	}
	if (input.kind === 'household') {
		const id = (input.household_id ?? '').trim();
		if (!UUID_RE.test(id)) {
			throw new Error('List member: household_id is required and must be a UUID.');
		}
		return { kind: 'household', household_id: id };
	}
	throw new Error('List member: kind must be "contact" or "household".');
}

export function listMemberToColumns(parent: ListMemberParent): {
	contact_id: string | null;
	household_id: string | null;
} {
	if (parent.kind === 'contact') return { contact_id: parent.contact_id, household_id: null };
	return { contact_id: null, household_id: parent.household_id };
}
