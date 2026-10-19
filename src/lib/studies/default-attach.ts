import { citeableSetMembers, type ResolvedMember } from '$lib/studies/resource-sets';

export type DefaultAttachSource = {
	bookId: string | null;
	essayId: string | null;
};

/**
 * Auto-attach uses the resolved include list. Sticky excludes and reference-only
 * members (concordances) never become candidate rows.
 */
export function sourcesForDefaultAttach(included: ResolvedMember[]): DefaultAttachSource[] {
	const out: DefaultAttachSource[] = [];
	const seen = new Set<string>();
	for (const member of citeableSetMembers(included)) {
		const bookId = member.bookId;
		const essayId = member.essayId;
		if (essayId && bookId) continue;
		if (!essayId && !bookId) continue;
		const key = essayId ? `e:${essayId}` : `b:${bookId}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ bookId: essayId ? null : bookId, essayId });
	}
	return out;
}
