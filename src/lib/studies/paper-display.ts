/**
 * List and detail lead: the passage when one is set, otherwise the title.
 * The other string stays as the secondary line ([243] Q10).
 */
export function paperDisplayLead(input: {
	title: string;
	passage_display: string | null;
}): { lead: string; detail: string | null } {
	const title = input.title.trim() || 'Untitled';
	const passage = input.passage_display?.trim() ?? '';
	if (!passage) return { lead: title, detail: null };
	if (passage.toLowerCase() === title.toLowerCase()) return { lead: passage, detail: null };
	return { lead: passage, detail: title };
}
