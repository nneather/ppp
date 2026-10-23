/**
 * Per-study set of systematic index hits marked in use on a sermon or paper.
 * Stored in localStorage so a refresh keeps them. Not a library source attach.
 */

import { parseDismissedRefIds } from '$lib/studies/systematics-dismiss';

export function systematicsUsingStorageKey(parentId: string): string {
	return `ppp.studies.systematicsUsing.${parentId}`;
}

export function loadUsingSystematicRefs(
	parentId: string,
	storage: Pick<Storage, 'getItem'> = localStorage
): Set<string> {
	return parseDismissedRefIds(storage.getItem(systematicsUsingStorageKey(parentId)));
}

export function saveUsingSystematicRefs(
	parentId: string,
	refIds: Iterable<string>,
	storage: Pick<Storage, 'setItem'> = localStorage
): void {
	storage.setItem(systematicsUsingStorageKey(parentId), JSON.stringify([...refIds]));
}
