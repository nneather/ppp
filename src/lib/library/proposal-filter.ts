import { normalizePublisherLocationTurabian } from '$lib/library/publisher-location';
import type { ProposalField, ReviewProposal } from '$lib/types/library';

export type ProposalBookSnapshot = {
	genre: string | null;
	year: number | null;
	publisher: string | null;
	publisher_id: string | null;
	publisher_location: string | null;
	publisher_effective_location: string | null;
};

function fieldFilledOnBook(field: ProposalField, book: ProposalBookSnapshot): boolean {
	switch (field) {
		case 'genre':
			return book.genre != null;
		case 'year':
			return book.year != null;
		case 'publisher':
			return book.publisher != null || book.publisher_id != null;
		case 'publisher_location':
			return (
				(book.publisher_location?.trim() ?? '') !== '' ||
				(book.publisher_effective_location?.trim() ?? '') !== ''
			);
		default:
			return false;
	}
}

/**
 * Drop proposal diffs for fields already satisfied on the book; normalize
 * surviving location values to Turabian style. Returns empty `fields` when
 * every diff is redundant (panel should hide; Confirm auto-rejects).
 */
export function filterProposalForBook(
	proposal: ReviewProposal,
	book: ProposalBookSnapshot
): ReviewProposal {
	const fields: ReviewProposal['fields'] = {};
	for (const [key, diff] of Object.entries(proposal.fields) as [
		ProposalField,
		NonNullable<ReviewProposal['fields'][ProposalField]>
	][]) {
		if (!diff || fieldFilledOnBook(key, book)) continue;
		if (key === 'publisher_location' && typeof diff.proposed === 'string') {
			const normalized = normalizePublisherLocationTurabian(diff.proposed);
			if (!normalized) continue;
			fields.publisher_location = { ...diff, proposed: normalized };
		} else {
			fields[key] = diff;
		}
	}
	return { ...proposal, fields };
}

/** True when at least one field diff remains after filtering against the book. */
export function hasVisibleProposalFields(proposal: ReviewProposal | null): boolean {
	if (!proposal) return false;
	return Object.keys(proposal.fields).length > 0;
}
