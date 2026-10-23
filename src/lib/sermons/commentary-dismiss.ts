/**
 * Per-sermon hide for commentary shelf rows. localStorage, same idea as
 * systematic-theology dismiss. Does not change the Postgres parked flag.
 */

import { parseDismissedRefIds } from '$lib/studies/systematics-dismiss';
import type { ByBookShelfHit } from '$lib/types/sermons';

export function commentaryDismissStorageKey(parentId: string): string {
	return `ppp.studies.commentaryDismissed.${parentId}`;
}

/** Stable across collapse: sorted member ids, not whichever volume sorted first. */
export function commentaryDismissKey(
	hit: Pick<ByBookShelfHit, 'kind' | 'bookId' | 'essayId' | 'memberBookIds' | 'memberEssayIds'>
): string {
	if (hit.kind === 'essay') {
		const ids = (
			hit.memberEssayIds.length > 0 ? hit.memberEssayIds : hit.essayId ? [hit.essayId] : []
		)
			.slice()
			.sort();
		return `essay:${ids.join(',')}`;
	}
	const ids = (hit.memberBookIds.length > 0 ? hit.memberBookIds : [hit.bookId]).slice().sort();
	return `book:${ids.join(',')}`;
}

export function loadDismissedCommentaries(
	parentId: string,
	storage: Pick<Storage, 'getItem'> = localStorage
): Set<string> {
	return parseDismissedRefIds(storage.getItem(commentaryDismissStorageKey(parentId)));
}

export function saveDismissedCommentaries(
	parentId: string,
	keys: Iterable<string>,
	storage: Pick<Storage, 'setItem'> = localStorage
): void {
	storage.setItem(commentaryDismissStorageKey(parentId), JSON.stringify([...keys]));
}
