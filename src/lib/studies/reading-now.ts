/**
 * Per-study "reading now" source and the last page typed for each source.
 * localStorage, same idea as systematics-using: a refresh keeps the place.
 */

export type ReadingNowState = {
	sourceId: string | null;
	pages: Record<string, string>;
};

export function readingNowStorageKey(parentId: string): string {
	return `ppp.studies.readingNow.${parentId}`;
}

export function emptyReadingNow(): ReadingNowState {
	return { sourceId: null, pages: {} };
}

export function loadReadingNow(
	parentId: string,
	storage: Pick<Storage, 'getItem'> = localStorage
): ReadingNowState {
	const raw = storage.getItem(readingNowStorageKey(parentId));
	if (!raw) return emptyReadingNow();
	try {
		const parsed = JSON.parse(raw) as { sourceId?: unknown; pages?: unknown };
		const sourceId = typeof parsed.sourceId === 'string' && parsed.sourceId ? parsed.sourceId : null;
		const pages: Record<string, string> = {};
		if (parsed.pages && typeof parsed.pages === 'object') {
			for (const [key, value] of Object.entries(parsed.pages)) {
				if (typeof value === 'string' && value.trim()) pages[key] = value.trim();
			}
		}
		return { sourceId, pages };
	} catch {
		return emptyReadingNow();
	}
}

export function saveReadingNow(
	parentId: string,
	state: ReadingNowState,
	storage: Pick<Storage, 'setItem'> = localStorage
): void {
	storage.setItem(readingNowStorageKey(parentId), JSON.stringify(state));
}

export function readingNowPage(state: ReadingNowState, sourceId: string | null): string | null {
	if (!sourceId) return null;
	return state.pages[sourceId] ?? null;
}
