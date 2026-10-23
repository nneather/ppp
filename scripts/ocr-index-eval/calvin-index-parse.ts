/**
 * Battles / McNeill "Index I, Biblical References" → scripture rows.
 * One printed line is book + English citation + Arabic locator (`1.13.7`).
 * Verse lists (`5:1, 4`) become one row per verse so passage search hits each.
 * A contiguous chapter list stays one row.
 */
import {
	ALL_BIBLE_BOOK_NAMES,
	APOCRYPHA_BOOK_NAMES
} from '../../src/lib/library/bible-book-names.ts';
import {
	expandPrintedSectionRange,
	parseSectionLocator
} from '../../src/lib/library/section-pointer.ts';

export const CALVIN_BOOK_ALIASES: Record<string, string> = {
	Canticles: 'Song of Songs',
	Ecclesiasticus: 'Sirach'
};

const KNOWN_BOOKS = new Set<string>([...ALL_BIBLE_BOOK_NAMES, ...APOCRYPHA_BOOK_NAMES]);

/** One chapter in the English Bible. A bare verse number is chapter 1. */
const SINGLE_CHAPTER_BOOKS = new Set(['Obadiah', 'Philemon', 'Jude', '2 John', '3 John']);

const GLOSSARY_VERSES = new Set(['p.', 'EV', 'Vg.', 'Vg', 'LXX', 'Gr.', 'Comm.', 'PA', 'VG', 'VL']);

const DASH = '[-\u2013\u2014]';
const TAG = String.raw`(?:cf\.?\s+)?(?:Vg\.?(?:\s*\(p\))?|LXX|EV|Gr\.?|Comm\.?|KJV|p\.?)`;
const TRAILING_TAG = new RegExp(String.raw`\s+((?:${TAG})(?:\s*&\s*(?:${TAG}))*)$`, 'i');
const EXTRA_VERSE = /^(\d{1,3})([ab])?(ff|p|f)?$/i;

export type CalvinCitation = {
	bible_book: string;
	chapter_start: number;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
	page_start: string;
	page_end: string | null;
	review_note: string | null;
	needs_review: boolean;
	/** Prefatory Address (or another edition). Not a Battles section. */
	edition: boolean;
};

export type CalvinParseFailure = { line: string; reason: string };

export type CalvinParseResult = {
	rows: CalvinCitation[];
	failures: CalvinParseFailure[];
	glossary: number;
};

type Passage = {
	chapter_start: number;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
};

export function paragraphsFromDocumentXml(xml: string): string[] {
	const paras: string[] = [];
	for (const part of xml.split(/<w:p\b/).slice(1)) {
		const end = part.indexOf('</w:p>');
		const body = end >= 0 ? part.slice(0, end) : part;
		let text = '';
		for (const token of body.matchAll(/<w:tab\b[^>]*\/>|<w:t\b[^>]*>([^<]*)<\/w:t>/g)) {
			text += token[0].startsWith('<w:tab') ? '\t' : decodeXml(token[1] ?? '');
		}
		const trimmed = text.trim();
		if (trimmed) paras.push(trimmed);
	}
	return paras;
}

export function parseCalvinParagraphs(paras: readonly string[]): CalvinParseResult {
	let book: string | null = null;
	const rows: CalvinCitation[] = [];
	const failures: CalvinParseFailure[] = [];
	let glossary = 0;

	for (const para of paras) {
		if (!para.includes('\t')) {
			const next = bookHeading(para);
			if (next) book = next;
			continue;
		}
		const cols = para
			.split('\t')
			.map((c) => c.trim())
			.filter((c) => c.length > 0);
		if (cols.length !== 2) {
			failures.push({ line: para.slice(0, 160), reason: 'expected verse and locator columns' });
			continue;
		}
		const [verse, locator] = cols as [string, string];
		if (isGlossaryLine(verse, locator)) {
			glossary += 1;
			continue;
		}
		if (!book) {
			failures.push({
				line: `${verse} => ${locator}`,
				reason: 'citation before a Bible book heading'
			});
			continue;
		}
		const parsed = parseCalvinCitation(book, verse, locator);
		if (!parsed.ok) {
			failures.push({ line: `${book} ${verse} => ${locator}`, reason: parsed.reason });
			continue;
		}
		rows.push(...parsed.rows);
	}
	return { rows, failures, glossary };
}

export function parseCalvinCitation(
	bibleBook: string,
	verseRaw: string,
	locatorRaw: string
): { ok: true; rows: CalvinCitation[] } | { ok: false; reason: string } {
	const locator = parseLocator(locatorRaw);
	if (!locator.ok) return locator;

	const split = splitVerse(verseRaw);
	if (!split.ok) return split;

	const passages = applyExtraVerses(bibleBook, split.passage, split.extraVerses);
	if (!passages.ok) return passages;

	// Edition marker is the only note that needs a person. Printed tags (Vg, ff, par, a/b) stay notes.
	const needsReview = locator.edition || split.ambiguous;

	return {
		ok: true,
		rows: passages.rows.map((passage, i) => {
			const { extraNotes, ...fields } = passage;
			return {
				bible_book: bibleBook,
				...fields,
				page_start: locator.pageStart,
				page_end: locator.pageEnd,
				review_note: joinNotes([
					...split.citationNotes,
					...(i === 0 ? split.tailNotes : []),
					...extraNotes,
					...split.sharedNotes,
					...locator.notes,
					locator.edition ? locator.pageStart : null
				]),
				needs_review: needsReview,
				edition: locator.edition
			};
		})
	};
}

function bookHeading(para: string): string | null {
	const alias = CALVIN_BOOK_ALIASES[para];
	if (alias) return alias;
	if (KNOWN_BOOKS.has(para)) return para;
	return null;
}

function isGlossaryLine(verse: string, locator: string): boolean {
	if (!GLOSSARY_VERSES.has(verse)) return false;
	return !parseLocator(locator).ok;
}

function parseLocator(raw: string):
	| {
			ok: true;
			pageStart: string;
			pageEnd: string | null;
			notes: string[];
			edition: boolean;
	  }
	| { ok: false; reason: string } {
	let s = raw.trim().replace(/^[lL]\./, '1.');
	const notes: string[] = [];
	const par = s.match(/^(.*?),\s*par\s+(\d+)$/i);
	if (par) {
		s = par[1]!.trim();
		notes.push(`par ${par[2]}`);
	}
	const edition = s.match(/^(PA|VG|VL)\s*(\d+)$/i);
	if (edition) {
		return {
			ok: true,
			pageStart: `${edition[1]!.toUpperCase()} ${edition[2]}`,
			pageEnd: null,
			notes,
			edition: true
		};
	}
	if (parseSectionLocator(s)) {
		return { ok: true, pageStart: s, pageEnd: null, notes, edition: false };
	}
	const range = expandPrintedSectionRange(s);
	if (range) {
		return {
			ok: true,
			pageStart: range.pageStart,
			pageEnd: range.pageEnd,
			notes,
			edition: false
		};
	}
	return { ok: false, reason: `unparsed locator ${raw.trim()}` };
}

type ExtraVerse = { verse: number; notes: string[] };

function splitVerse(raw: string):
	| {
			ok: true;
			passage: string;
			extraVerses: ExtraVerse[];
			citationNotes: string[];
			tailNotes: string[];
			sharedNotes: string[];
			ambiguous: boolean;
	  }
	| { ok: false; reason: string } {
	const pieces = raw.split(',').map((p) => p.trim());
	const head = pieces[0] ?? '';
	const extraVerses: ExtraVerse[] = [];
	const sharedNotes: string[] = [];
	for (const piece of pieces.slice(1)) {
		const extra = piece.match(EXTRA_VERSE);
		if (extra) {
			const notes: string[] = [];
			if (extra[2]) notes.push(extra[2].toLowerCase());
			if (extra[3]) notes.push(extra[3].toLowerCase() === 'p' ? 'p' : extra[3].toLowerCase());
			extraVerses.push({ verse: Number(extra[1]), notes });
		} else if (piece) {
			sharedNotes.push(piece);
		}
	}

	const spaced = peelSpacedTags(head);
	let ambiguous = false;
	let core = spaced.core;
	const citationNotes = [...spaced.notes];
	if (core.includes('/')) {
		const parts = core
			.split('/')
			.map((p) => p.trim())
			.filter((p) => p.length > 0);
		core = parts[0] ?? '';
		const rest = parts.slice(1);
		if (rest.length > 1) ambiguous = true;
		for (const part of rest) {
			if (/^p\.?$/i.test(part)) {
				citationNotes.push('p');
				continue;
			}
			const spacedPart = peelSpacedTags(part);
			const peeled = peelTail(spacedPart.core);
			citationNotes.push(...spacedPart.notes, ...peeled.notes);
			if (peeled.core) citationNotes.push(vgNote(peeled.core));
		}
	}
	const english = peelSpacedTags(core);
	citationNotes.push(...english.notes);
	const tail = peelTail(english.core);
	if (!tail.core) return { ok: false, reason: `empty verse ${raw}` };
	return {
		ok: true,
		passage: tail.core,
		extraVerses,
		citationNotes,
		tailNotes: tail.notes,
		sharedNotes,
		ambiguous
	};
}

function applyExtraVerses(
	book: string,
	passageRaw: string,
	extras: ExtraVerse[]
): { ok: true; rows: (Passage & { extraNotes: string[] })[] } | { ok: false; reason: string } {
	const passage = parsePassage(book, passageRaw);
	if (!passage.ok) return passage;
	if (extras.length === 0) return { ok: true, rows: [{ ...passage.passage, extraNotes: [] }] };
	if (passage.passage.verse_start == null || passage.passage.verse_end != null) {
		return { ok: false, reason: `verse list on ${passageRaw}` };
	}
	const chapter = passage.passage.chapter_start;
	const rows = [{ ...passage.passage, extraNotes: [] as string[] }];
	for (const extra of extras) {
		if (!validVerse(extra.verse)) return { ok: false, reason: `bad listed verse ${extra.verse}` };
		rows.push({
			chapter_start: chapter,
			verse_start: extra.verse,
			chapter_end: null,
			verse_end: null,
			extraNotes: extra.notes
		});
	}
	return { ok: true, rows };
}

function parsePassage(
	book: string,
	core: string
): { ok: true; passage: Passage } | { ok: false; reason: string } {
	let m = core.match(/^ch\.\s*(\d+)$/i) ?? core.match(/^chs\.\s*(\d+)$/i);
	if (m) return chapterOnly(m[1]!);

	m = core.match(/^chs\.\s*(\d+)\s+to\s+(\d+)$/i);
	if (m) return chapterSpan(m[1]!, m[2]!);

	m = core.match(new RegExp(`^chs\\.\\s*(\\d+):(\\d+)\\s+to\\s+(\\d+):(\\d+)$`, 'i'));
	if (m) {
		const start = versePoint(m[1]!, m[2]!);
		const end = versePoint(m[3]!, m[4]!);
		if (!start || !end) return { ok: false, reason: `bad chapter span ${core}` };
		if (end.chapter < start.chapter || (end.chapter === start.chapter && end.verse < start.verse)) {
			return { ok: false, reason: `chapter span backwards ${core}` };
		}
		return {
			ok: true,
			passage: {
				chapter_start: start.chapter,
				verse_start: start.verse,
				chapter_end: end.chapter,
				verse_end: end.verse
			}
		};
	}

	m = core.match(/^chs\.\s*(\d+(?:\s*;\s*\d+)+)$/i);
	if (m) {
		const nums = m[1]!.split(/\s*;\s*/).map(Number);
		const sorted = [...nums].sort((a, b) => a - b);
		const contiguous = sorted.every((n, i) => i === 0 || n === sorted[0]! + i);
		if (!contiguous || sorted.some((n) => !validChapter(n))) {
			return { ok: false, reason: `chapter list ${core}` };
		}
		return chapterSpan(String(sorted[0]), String(sorted[sorted.length - 1]));
	}

	m = core.match(/^v\.\s*(\d+)$/i);
	if (m) {
		if (!SINGLE_CHAPTER_BOOKS.has(book)) return { ok: false, reason: `bare verse on ${book}` };
		return verseOnly(1, m[1]!);
	}

	if (/^\d+$/.test(core)) {
		if (book === 'Psalms') return chapterOnly(core);
		if (SINGLE_CHAPTER_BOOKS.has(book)) return verseOnly(1, core);
		return { ok: false, reason: `bare number on ${book}` };
	}

	m = core.match(new RegExp(`^(\\d+):(\\d+)${DASH}(\\d+):(\\d+)$`));
	if (m) {
		const start = versePoint(m[1]!, m[2]!);
		const end = versePoint(m[3]!, m[4]!);
		if (!start || !end) return { ok: false, reason: `bad range ${core}` };
		return {
			ok: true,
			passage: {
				chapter_start: start.chapter,
				verse_start: start.verse,
				chapter_end: end.chapter,
				verse_end: end.verse
			}
		};
	}

	m = core.match(new RegExp(`^(\\d+):(\\d+)${DASH}(\\d+)$`));
	if (m) {
		const ch = Number(m[1]);
		const a = Number(m[2]);
		const b = Number(m[3]);
		if (!validChapter(ch) || !validVerse(a) || !validVerse(b) || b < a) {
			return { ok: false, reason: `bad verse range ${core}` };
		}
		// verse_end is ignored unless chapter_end is set (compute_verse_abs).
		return {
			ok: true,
			passage: { chapter_start: ch, verse_start: a, chapter_end: ch, verse_end: b }
		};
	}

	m = core.match(/^(\d+):(\d+)$/);
	if (m) return verseOnly(Number(m[1]), m[2]!);

	return { ok: false, reason: `unparsed verse ${core}` };
}

function chapterOnly(raw: string): { ok: true; passage: Passage } | { ok: false; reason: string } {
	const n = Number(raw);
	if (!validChapter(n)) return { ok: false, reason: `bad chapter ${raw}` };
	return {
		ok: true,
		passage: { chapter_start: n, verse_start: null, chapter_end: null, verse_end: null }
	};
}

function chapterSpan(
	startRaw: string,
	endRaw: string
): { ok: true; passage: Passage } | { ok: false; reason: string } {
	const start = Number(startRaw);
	const end = Number(endRaw);
	if (!validChapter(start) || !validChapter(end) || end < start) {
		return { ok: false, reason: `bad chapter span ${startRaw}–${endRaw}` };
	}
	if (start === end) {
		return {
			ok: true,
			passage: { chapter_start: start, verse_start: null, chapter_end: null, verse_end: null }
		};
	}
	return {
		ok: true,
		passage: { chapter_start: start, verse_start: null, chapter_end: end, verse_end: null }
	};
}

function verseOnly(
	chapter: number,
	verseRaw: string
): { ok: true; passage: Passage } | { ok: false; reason: string } {
	const verse = Number(verseRaw);
	if (!validChapter(chapter) || !validVerse(verse)) {
		return { ok: false, reason: `bad verse ${chapter}:${verseRaw}` };
	}
	return {
		ok: true,
		passage: { chapter_start: chapter, verse_start: verse, chapter_end: null, verse_end: null }
	};
}

function versePoint(
	chapterRaw: string,
	verseRaw: string
): { chapter: number; verse: number } | null {
	const chapter = Number(chapterRaw);
	const verse = Number(verseRaw);
	if (!validChapter(chapter) || !validVerse(verse)) return null;
	return { chapter, verse };
}

function validChapter(n: number): boolean {
	return Number.isInteger(n) && n >= 1 && n <= 200;
}

function validVerse(n: number): boolean {
	return Number.isInteger(n) && n >= 1 && n <= 200;
}

function peelSpacedTags(raw: string): { core: string; notes: string[] } {
	const notes: string[] = [];
	let cur = raw.trim();
	while (true) {
		const m = cur.match(TRAILING_TAG);
		if (!m || m.index == null) break;
		notes.unshift(m[1]!.trim());
		cur = cur.slice(0, m.index).trim();
	}
	return { core: cur, notes };
}

function peelTail(raw: string): { core: string; notes: string[] } {
	const notes: string[] = [];
	let cur = raw.trim();
	while (cur.length > 0) {
		if (/ff$/i.test(cur) && /\d/.test(cur.slice(0, -2))) {
			notes.unshift('ff');
			cur = cur.slice(0, -2);
			continue;
		}
		if (/p$/i.test(cur) && /\d[ab]?$/i.test(cur.slice(0, -1))) {
			notes.unshift('p');
			cur = cur.slice(0, -1);
			continue;
		}
		if (/[ab]$/i.test(cur) && /\d$/.test(cur.slice(0, -1))) {
			notes.unshift(cur.slice(-1).toLowerCase());
			cur = cur.slice(0, -1);
			continue;
		}
		if (/f$/i.test(cur) && /\d$/.test(cur.slice(0, -1))) {
			notes.unshift('f');
			cur = cur.slice(0, -1);
			continue;
		}
		break;
	}
	return { core: cur, notes };
}

function vgNote(raw: string): string {
	if (/^(Vg|Comm|LXX|EV|Gr|KJV)\b/i.test(raw)) return raw;
	return `Vg ${raw}`;
}

function joinNotes(parts: (string | null | undefined)[]): string | null {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const part of parts) {
		const t = part?.trim();
		if (!t || seen.has(t)) continue;
		seen.add(t);
		out.push(t);
	}
	return out.length > 0 ? out.join('; ') : null;
}

function decodeXml(raw: string): string {
	return raw
		.replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
}
