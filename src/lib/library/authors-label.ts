import type { PersonRow } from '$lib/types/library';

type BookAuthorJunction = { person_id: string; sort_order: number; role: string };

/** Matches `personDisplayShort` in loaders.ts — keep in sync. */
function personLabelShort(p: PersonRow): string {
	const first = (p.first_name ?? '').trim();
	const middle = (p.middle_name ?? '').trim();
	const middleInitial = middle ? `${middle.charAt(0)}.` : '';
	const parts = [first, middleInitial, p.last_name].filter((s) => s.length > 0);
	return parts.join(' ');
}

/**
 * Short author line for list/review cards and pickers.
 * Editor-only books (no `author` role) show names with `(ed)` / `(eds)`.
 */
export function authorsLabelForBook(
	bookAuthors: BookAuthorJunction[],
	peopleMap: Map<string, PersonRow>
): string | null {
	const sorted = (bookAuthors ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
	const authorRows = sorted.filter((a) => a.role === 'author');
	const editorRows = sorted.filter((a) => a.role === 'editor');

	if (authorRows.length > 0) {
		const labels = authorRows
			.map((a) => {
				const p = peopleMap.get(a.person_id);
				return p ? personLabelShort(p) : null;
			})
			.filter((s): s is string => s != null);
		return labels.length > 0 ? labels.join(', ') : null;
	}

	if (editorRows.length > 0) {
		const labels = editorRows
			.map((a) => {
				const p = peopleMap.get(a.person_id);
				return p ? personLabelShort(p) : null;
			})
			.filter((s): s is string => s != null);
		if (labels.length === 0) return null;
		return `${labels.join(', ')}${editorRows.length === 1 ? ' (ed)' : ' (eds)'}`;
	}

	return null;
}
