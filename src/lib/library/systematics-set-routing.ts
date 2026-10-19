/**
 * Route scripture-index OCR rows to the correct volume book in a set ([252]).
 * Explicit volume token wins; else page falls inside outline bounds; else default.
 */

import { pageNumberFromText } from '$lib/library/outline';

export type SetVolumeBook = {
	bookId: string;
	volumeNumber: string | null;
	pageMin: number | null;
	pageMax: number | null;
};

export type RoutedIndexRow = {
	bookId: string;
	volume: string | null;
	reason: 'explicit_volume' | 'outline_page' | 'default';
};

function normalizeVolumeToken(raw: string | null | undefined): string | null {
	if (raw == null) return null;
	const t = String(raw).trim();
	if (!t) return null;
	// Accept "2", "II", "vol. 2", "2:620" → volume part
	const volPage = t.match(/^([IVXivx0-9]+)\s*:\s*\d/);
	if (volPage) return volPage[1]!.toUpperCase();
	const bare = t.match(/^(?:vol\.?\s*)?([IVXivx0-9]+)$/i);
	if (bare) return bare[1]!.toUpperCase();
	return t.toUpperCase();
}

function volumesMatch(a: string | null, b: string | null): boolean {
	if (a == null || b == null) return false;
	const na = normalizeVolumeToken(a);
	const nb = normalizeVolumeToken(b);
	if (na == null || nb == null) return false;
	if (na === nb) return true;
	const roman: Record<string, string> = {
		I: '1',
		II: '2',
		III: '3',
		IV: '4',
		V: '5',
		VI: '6',
		VII: '7',
		VIII: '8',
		IX: '9',
		X: '10'
	};
	const aa = roman[na] ?? na;
	const bb = roman[nb] ?? nb;
	return aa === bb;
}

/**
 * Resolve which volume book should own an index row.
 * `volume` may be a bare volume token or embedded in page_start (`2:620`).
 */
export function routeIndexRowToVolume(
	volumes: SetVolumeBook[],
	input: { volume?: string | null; pageStart?: string | null },
	defaultBookId: string
): RoutedIndexRow {
	const fromField = normalizeVolumeToken(input.volume);
	const fromPage = (() => {
		const ps = (input.pageStart ?? '').trim();
		const m = ps.match(/^([IVXivx0-9]+)\s*:\s*(\d+)/);
		return m ? m[1]!.toUpperCase() : null;
	})();
	const explicit = fromField ?? fromPage;
	if (explicit) {
		const hit = volumes.find((v) => volumesMatch(v.volumeNumber, explicit));
		if (hit) {
			return { bookId: hit.bookId, volume: explicit, reason: 'explicit_volume' };
		}
	}

	const page = pageNumberFromText(
		(input.pageStart ?? '').includes(':')
			? (input.pageStart ?? '').replace(/^[^:]+:/, '')
			: input.pageStart
	);
	if (page != null) {
		const byPage = volumes.find(
			(v) =>
				v.pageMin != null &&
				v.pageMax != null &&
				page >= v.pageMin &&
				page <= v.pageMax
		);
		if (byPage) {
			return {
				bookId: byPage.bookId,
				volume: byPage.volumeNumber,
				reason: 'outline_page'
			};
		}
	}

	return { bookId: defaultBookId, volume: explicit, reason: 'default' };
}

/** Strip `vol:page` → page-only for storage on the resolved volume book. */
export function stripVolumeFromPageToken(pageStart: string | null | undefined): string | null {
	if (pageStart == null) return null;
	const t = pageStart.trim();
	const m = t.match(/^[IVXivx0-9]+\s*:\s*(.+)$/);
	return m ? m[1]!.trim() : t;
}
