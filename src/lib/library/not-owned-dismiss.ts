/**
 * Client-side dismiss set for `/settings/library/not-owned` queue keys ([103] polish).
 * Same localStorage pattern as people-merge dismiss.
 */

export const NOT_OWNED_DISMISS_LS_KEY = 'ppp.library.notOwnedDismissed';

/** Parse stored JSON into a Set of queue keys. Invalid / empty → empty set. */
export function parseDismissedKeysJson(raw: string | null | undefined): Set<string> {
	if (raw == null || raw.trim().length === 0) return new Set();
	try {
		const arr = JSON.parse(raw) as unknown;
		if (!Array.isArray(arr)) return new Set();
		return new Set(arr.filter((x): x is string => typeof x === 'string' && x.length > 0));
	} catch {
		return new Set();
	}
}

export function serializeDismissedKeys(keys: Iterable<string>): string {
	return JSON.stringify([...keys]);
}

export function loadDismissedKeys(storage: Pick<Storage, 'getItem'> = localStorage): Set<string> {
	return parseDismissedKeysJson(storage.getItem(NOT_OWNED_DISMISS_LS_KEY));
}

export function saveDismissedKeys(
	keys: Iterable<string>,
	storage: Pick<Storage, 'setItem'> = localStorage
): void {
	storage.setItem(NOT_OWNED_DISMISS_LS_KEY, serializeDismissedKeys(keys));
}

export function dismissKey(keys: Set<string>, key: string): Set<string> {
	return new Set([...keys, key]);
}

export function restoreKey(keys: Set<string>, key: string): Set<string> {
	const next = new Set(keys);
	next.delete(key);
	return next;
}
