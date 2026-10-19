/**
 * Battles scripture-index tags that are not part of the section locator.
 * Version tags (`cf Vg`, `LXX`, …) come off the locator and stay on the note.
 * `PA` / `VG` / `VL` point at another edition and must not join this outline.
 */

export type IndexEditionMarker = 'PA' | 'VG' | 'VL';

const EDITION_RE = /(?:^|[\s,;])(PA|VG|VL)(?=$|[\s,;:.])/;
const VERSION_TAG_RE =
	/(?:^|[\s,;]+)((?:cf\s+)?(?:Vg\.?|LXX|EV|Gr\.?|Comm\.?|p\.))(?=$|[\s,;])/gi;
const VERSION_TOKEN_RE = /^(?:cf\s+)?(?:Vg\.?|LXX|EV|Gr\.?|Comm\.?|p\.)$/i;

export function editionMarkerIn(raw: string | null | undefined): IndexEditionMarker | null {
	if (raw == null) return null;
	const m = EDITION_RE.exec(String(raw).trim());
	if (!m) return null;
	const token = m[1]!.toUpperCase();
	if (token === 'PA' || token === 'VG' || token === 'VL') return token;
	return null;
}

export function separateIndexQualifier(raw: string | null | undefined): {
	pageStart: string | null;
	reviewNote: string | null;
	edition: IndexEditionMarker | null;
} {
	if (raw == null) return { pageStart: null, reviewNote: null, edition: null };
	const original = String(raw).trim();
	if (!original) return { pageStart: null, reviewNote: null, edition: null };

	const edition = editionMarkerIn(original);
	if (edition) {
		return { pageStart: original, reviewNote: edition, edition };
	}

	const notes: string[] = [];
	const stripped = original.replace(VERSION_TAG_RE, (_match, tag: string) => {
		notes.push(tag.trim());
		return ' ';
	});
	if (notes.length === 0) {
		return { pageStart: original, reviewNote: null, edition: null };
	}
	const core = stripped
		.replace(/[\s,;]+/g, ' ')
		.trim()
		.replace(/^[\s,;]+|[\s,;]+$/g, '');
	return {
		pageStart: core || null,
		reviewNote: notes.join(', '),
		edition: null
	};
}

function joinNotes(...parts: (string | null | undefined)[]): string {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const part of parts) {
		const t = part?.trim();
		if (!t || seen.has(t)) continue;
		seen.add(t);
		out.push(t);
	}
	return out.join('; ');
}

/** Clean a locator and keep version / edition tags on the review note. */
export function applyIndexQualifierFields(
	pageStart: string | null | undefined,
	reviewNote: string | null | undefined
): { pageStart: string; reviewNote: string; edition: IndexEditionMarker | null } {
	const split = separateIndexQualifier(pageStart);
	const page = (split.edition ? pageStart : split.pageStart) ?? '';
	return {
		pageStart: page.trim(),
		reviewNote: joinNotes(reviewNote, split.reviewNote),
		edition: split.edition
	};
}

/**
 * A version tag alone (`cf Vg`) is a note, not a review failure.
 * Edition markers and validator reasons still need a person.
 */
export function indexNoteNeedsReview(note: string | null | undefined): boolean {
	const t = note?.trim() ?? '';
	if (!t) return false;
	const parts = t
		.split(/\s*;\s*/)
		.flatMap((s) => s.split(/\s*,\s*/))
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
	return parts.some((p) => !VERSION_TOKEN_RE.test(p));
}
