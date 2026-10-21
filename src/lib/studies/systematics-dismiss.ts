/**
 * Per-study dismiss set for systematic index hits on a sermon or paper.
 * Stored in localStorage so a refresh keeps them hidden. Not a library delete.
 */

export function systematicsDismissStorageKey(parentId: string): string {
	return `ppp.studies.systematicsDismissed.${parentId}`;
}

export function parseDismissedRefIds(raw: string | null | undefined): Set<string> {
	if (raw == null || raw.trim().length === 0) return new Set();
	try {
		const arr = JSON.parse(raw) as unknown;
		if (!Array.isArray(arr)) return new Set();
		return new Set(arr.filter((id): id is string => typeof id === 'string' && id.length > 0));
	} catch {
		return new Set();
	}
}

export function loadDismissedSystematicRefs(
	parentId: string,
	storage: Pick<Storage, 'getItem'> = localStorage
): Set<string> {
	return parseDismissedRefIds(storage.getItem(systematicsDismissStorageKey(parentId)));
}

export function saveDismissedSystematicRefs(
	parentId: string,
	refIds: Iterable<string>,
	storage: Pick<Storage, 'setItem'> = localStorage
): void {
	storage.setItem(systematicsDismissStorageKey(parentId), JSON.stringify([...refIds]));
}

/** Hits still on screen. `showDismissed` puts the hidden ones back. */
export function visibleSystematicRefs<T extends { refId: string }>(
	items: T[],
	dismissed: ReadonlySet<string>,
	showDismissed: boolean
): T[] {
	if (showDismissed) return items;
	return items.filter((item) => !dismissed.has(item.refId));
}
