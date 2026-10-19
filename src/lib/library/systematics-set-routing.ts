/**
 * Route scripture-index OCR rows to the correct volume book in a set ([252]).
 * Explicit volume token wins; else page falls inside outline bounds; else default.
 */

import { locatorCoversSectionPointer, pageNumberFromText } from '$lib/library/outline';
import { parseSectionPointer } from '$lib/library/section-pointer';
import { editionMarkerIn } from '$lib/library/scripture-index-qualifiers';

export type SetVolumeBook = {
	bookId: string;
	volumeNumber: string | null;
	pageMin: number | null;
	pageMax: number | null;
	/** Chapter locators printed on this volume (`I.13`, `III.20`). */
	locators?: string[];
};

export type RoutedIndexRow = {
	bookId: string;
	volume: string | null;
	reason: 'explicit_volume' | 'outline_page' | 'section_locator' | 'edition_pointer' | 'default';
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
	input: { volume?: string | null; pageStart?: string | null; reviewNote?: string | null },
	defaultBookId: string
): RoutedIndexRow {
	// PA / VG / VL cite another edition. The leftover digits are not a Battles page.
	if (editionMarkerIn(input.pageStart) || editionMarkerIn(input.reviewNote)) {
		return { bookId: defaultBookId, volume: null, reason: 'edition_pointer' };
	}

	// 1.13.7 and III.2.12 are Institutes sections. The leading number is the
	// book of the Institutes. Place the row on the volume whose outline
	// contains that chapter; otherwise keep the book being indexed.
	if (parseSectionPointer(input.pageStart, null)) {
		let best: { book: SetVolumeBook; spec: number; locatorLength: number } | null = null;
		for (const volume of volumes) {
			for (const locator of volume.locators ?? []) {
				if (!locatorCoversSectionPointer(locator, input.pageStart, null)) continue;
				const spec = locator.includes('.') && locator.split('.').length > 2 ? 2 : 1;
				const locatorLength = locator.length;
				if (
					!best ||
					spec > best.spec ||
					(spec === best.spec && locatorLength > best.locatorLength)
				) {
					best = { book: volume, spec, locatorLength };
				}
			}
		}
		if (best) {
			return { bookId: best.book.bookId, volume: null, reason: 'section_locator' };
		}
		return { bookId: defaultBookId, volume: null, reason: 'section_locator' };
	}

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
