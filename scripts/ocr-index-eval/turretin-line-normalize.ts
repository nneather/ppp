/**
 * FineReader text-layer fixes before parseIndexEntry (Turretin PDF only).
 */
import { BIBLE_BOOK_NAMES } from '../../src/lib/library/bible-book-names.ts';
import { BIBLE_CHAPTER_COUNTS } from '../../src/lib/library/scripture-index-validate.ts';

const SINGLE_CHAPTER_BOOKS = new Set(
	BIBLE_BOOK_NAMES.filter((b) => (BIBLE_CHAPTER_COUNTS[b] ?? 99) === 1)
);

/** Apostrophe glued verse ranges (18:24'32 → 18:24–32). */
function fixApostropheVerseRanges(ref: string): string {
	return ref.replace(/(\d):(\d+)'(\d+)/g, '$1:$2–$3');
}

/** ff. / f. after verse (16:5ff. → 16:5). */
function stripFfSuffix(ref: string): string {
	return ref
		.replace(/(\d)f{1,2}\./gi, '$1')
		.replace(/(\d)f{1,2}$/i, '$1')
		.replace(/f{1,2}\./gi, '')
		.replace(/f{1,2}$/i, '');
}

/** OCR l/I for 1 in leading chapter (l:8 → 1:8). */
function fixLeadingOne(ref: string): string {
	return ref.replace(/^([lI]):/i, '1:');
}

/**
 * Chapter-only ref for single-chapter epistles (2 John `7-2:315` → `1:7—2:315`).
 */
function fixSingleChapterBookRef(ref: string, book: string): string {
	if (!SINGLE_CHAPTER_BOOKS.has(book)) return ref;
	const m = ref.match(/^(\d{1,3})(?:\s*[-–,]\s*(\d{1,3}))?$/);
	if (!m?.[1]) return ref;
	const v1 = Number(m[1]);
	const v2 = m[2] != null ? Number(m[2]) : undefined;
	if (v1 < 1 || v1 > 176) return ref;
	if (v2 != null && (v2 < 1 || v2 > 176)) return ref;
	if (v2 != null) return `1:${v1}–${v2}`;
	return `1:${v1}`;
}

/** Split ref / locators on em dash, normalizing hyphen chapter ranges before vol:page. */
function splitRefAndLocs(line: string): { ref: string; locs: string } | null {
	const em = line.match(/^(.*)[—–]((?:(?:\d+)|(?:[lL])):.+)$/i);
	if (em?.[1] && em[2]) {
		return { ref: em[1].trim(), locs: em[2].trim() };
	}
	const m = line.match(/^(.+?)-(\d+:.+)$/);
	if (!m?.[1] || !m[2]) return null;
	return { ref: m[1].trim(), locs: m[2].trim() };
}

function normalizeRefPart(ref: string, book: string): string {
	let r = ref.trim();
	r = fixLeadingOne(r);
	r = fixApostropheVerseRanges(r);
	r = stripFfSuffix(r);
	r = fixFineReaderGluedVerse(r);
	r = fixSingleChapterBookRef(r, book);
	// Chapter range without colon (3-5, 37-39, 7-10) before locators.
	const chRange = r.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})$/);
	if (chRange) {
		return `${chRange[1]}–${chRange[2]}`;
	}
	// Verse list 14,15 or 14, 15
	const commaVerses = r.match(/^(\d+):(\d+)\s*,\s*(\d+)$/);
	if (commaVerses) {
		return `${commaVerses[1]}:${commaVerses[2]}, ${commaVerses[3]}`;
	}
	const commaOnly = r.match(/^(\d+)\s*,\s*(\d+)$/);
	if (commaOnly) {
		if (SINGLE_CHAPTER_BOOKS.has(book)) {
			return `1:${commaOnly[1]}–${commaOnly[2]}`;
		}
		const a = Number(commaOnly[1]);
		const b = Number(commaOnly[2]);
		if (b > a && a < 200 && b < 200) return `${a}–${b}`;
	}
	// Glued chapter:verse without colon (8114,15 → 81:14,15)
	const gluedPs = r.match(/^(\d{2,3})(\d{2}),\s*(\d+)$/);
	if (gluedPs && book === 'Psalms') {
		const ch = Number(gluedPs[1]);
		if (ch >= 1 && ch <= 150) return `${gluedPs[1]}:${gluedPs[2]}, ${gluedPs[3]}`;
	}
	const gluedPs2 = r.match(/^(\d{3,4})(,\s*\d+)?$/);
	if (gluedPs2 && book === 'Psalms') {
		const digits = gluedPs2[1]!;
		if (digits.length === 4) {
			const ch = Number(digits.slice(0, 2));
			const vs = Number(digits.slice(2));
			if (ch >= 1 && ch <= 150 && vs >= 1) return `${ch}:${vs}${gluedPs2[2] ?? ''}`;
		}
	}
	// 53:1017. → 53:10–17 (four-digit verse blob only)
	const gluedVe = r.match(/^(\d+):(\d{4,})\.?$/);
	if (gluedVe) {
		const ch = Number(gluedVe[1]);
		const digits = gluedVe[2]!;
		if (ch >= 1 && ch <= 150 && digits.length === 4) {
			return `${ch}:${digits.slice(0, 2)}–${digits.slice(2)}`;
		}
	}
	// 2616-21 → 26:16–21 (2 Chronicles style)
	const gluedCh = r.match(/^(\d{2})(\d{2})-(\d{1,2})$/);
	if (gluedCh) {
		return `${gluedCh[1]}:${gluedCh[2]}–${gluedCh[3]}`;
	}
	return r;
}

function normalizeLocators(locs: string): string {
	let s = locs.trim();
	// Space before hyphen vol locator (40:20- 2:54)
	s = s.replace(/\s+-\s+(?=\d+:)/g, '—');
	s = s.replace(/(\d)\s+-\s+(\d+:)/g, '$1, $2');
	// OCR page l: → 1:
	s = s.replace(/\bl:/gi, '1:');
	s = s.replace(/;(\d)/g, ', $1');
	return s;
}

/** Verse digit blob → range when middle `4` stood in for an en-dash (FineReader). */
const GLUED_VERSE_BY_DIGITS: Record<string, string> = {
	'141': '1–11',
	'1749': '17–19',
	'1345': '13–15',
	'1648': '16–48',
	'1042': '10–12',
	'644': '6–44',
	'941': '9–11',
	'740': '7–10',
	'140': '1–40'
};

/**
 * FineReader often encodes a missing en-dash as 4 (8:1–11 → 8:141, 7:17–19 → 7:1749).
 */
function fixFineReaderGluedVerse(ref: string): string {
	const m = ref.match(/^(\d+):(\d+)$/);
	if (!m?.[1] || !m[2]) return ref;
	const ch = m[1];
	const digits = m[2];
	const known = GLUED_VERSE_BY_DIGITS[digits];
	if (known) return `${ch}:${known}`;
	if (digits.length === 3 && digits[1] === '4') {
		const v1 = Number(digits[0]);
		const tail = digits.slice(2);
		const v2 = tail.length === 1 ? Number(tail + tail) : Number(tail);
		if (v2 > v1 && v2 <= 176) return `${ch}:${v1}–${v2}`;
	}
	if (digits.length === 4 && digits[2] === '4') {
		const v1 = Number(digits.slice(0, 2));
		const v2 = digits.slice(2) === '49' ? 19 : Number(digits.slice(3));
		if (v2 > v1 && v2 <= 176) return `${ch}:${v1}–${v2}`;
	}
	return ref;
}

function fixGluedVerseRange(ref: string): string {
	const fixed = fixFineReaderGluedVerse(ref);
	if (fixed !== ref) return fixed;
	const m = ref.match(/^(\d+):(\d{3,})$/);
	if (!m?.[1] || !m[2]) return ref;
	const ch = Number(m[1]);
	const digits = m[2];
	if (digits.length === 4) {
		return `${ch}:${digits.slice(0, 2)}–${digits.slice(2)}`;
	}
	return ref;
}

export function normalizeTurretinIndexLine(line: string, book: string): string {
	let trimmed = line.trim();
	if (!trimmed || trimmed.startsWith('#')) return trimmed;
	trimmed = trimmed.replace(/-\s+(?=\d+:)/g, '—');
	trimmed = trimmed.replace(/\s+[-—–]\s+(?=\d+:)/g, '—');
	trimmed = trimmed.replace(/-([lL]:)/g, '—$1');

	const parts = splitRefAndLocs(trimmed);
	if (!parts) {
		// "25:8 - 2:264" style
		const spaced = trimmed.replace(/\s+-\s+(?=\d+:)/, '—');
		const retry = splitRefAndLocs(spaced);
		if (!retry) return trimmed;
		const ref = normalizeRefPart(retry.ref, book);
		const locs = normalizeLocators(retry.locs);
		return `${fixGluedVerseRange(ref)}—${locs}`;
	}

	let ref = normalizeRefPart(parts.ref, book);
	ref = fixGluedVerseRange(ref);
	const locs = normalizeLocators(parts.locs);
	const sep = trimmed.includes('—') ? '—' : trimmed.includes('–') ? '–' : '—';
	return `${ref}${sep}${locs}`;
}
