/**
 * Parse one printed Turretin-style index line into gold rows.
 * "6:4, 5—2:189, 692, 3:349" → verse range 6:4–5, three page pointers.
 */

export type IndexGoldRow = {
	bible_book: string;
	chapter_start: number;
	verse_start?: number;
	chapter_end?: number;
	verse_end?: number;
	page_start: string;
	page_end?: string;
	volume: string;
};

/** FineReader glued two index entries on one line: `22:18—1:76, 22:21—1:631`. */
const GLUED_NEXT_REF =
	/,\s*(?=(?:\d{2,}:\d+(?:,\s*\d+)*|\d+:\d+(?:,\s*\d+)+)[—–-])/;

export function splitGluedIndexLine(line: string): string[] {
	const trimmed = line.trim();
	if (!trimmed) return [];
	const parts: string[] = [];
	let rest = trimmed;
	for (;;) {
		const m = rest.match(GLUED_NEXT_REF);
		if (!m || m.index == null) {
			parts.push(rest);
			break;
		}
		parts.push(rest.slice(0, m.index).trim());
		rest = rest.slice(m.index + 1).trim();
	}
	return parts.filter((p) => p.length > 0);
}

export function parseIndexEntry(line: string, bibleBook: string): IndexGoldRow[] {
	const trimmed = line.trim();
	if (!trimmed || trimmed.startsWith('#')) return [];

	const segments = splitGluedIndexLine(trimmed);
	if (segments.length > 1) {
		const rows: IndexGoldRow[] = [];
		for (const seg of segments) rows.push(...parseOneIndexEntry(seg, bibleBook));
		return rows;
	}
	return parseOneIndexEntry(trimmed, bibleBook);
}

function parseOneIndexEntry(line: string, bibleBook: string): IndexGoldRow[] {
	const trimmed = line.trim();
	if (!trimmed) return [];

	let ref: string;
	let locs: string;
	const emSplit = trimmed.match(/^(.*)[—–]((?:(?:\d+)|(?:[lL])):.+)$/i);
	if (emSplit?.[1] && emSplit[2]) {
		ref = emSplit[1].trim();
		locs = emSplit[2].trim();
	} else {
		const split = trimmed.match(/^(.*?)-(\d+:.+)$/);
		if (!split?.[1] || !split[2]) throw new Error(`No locator separator: ${trimmed}`);
		ref = split[1].trim();
		locs = split[2].trim();
	}

	let chapter: number;
	let verseStart: number | undefined;
	let verseEnd: number | undefined;
	let chapterEnd: number | undefined;

	const verseRange = ref.match(/^(\d+):(\d+)\s*[–—-]\s*(\d+)$/);
	if (verseRange?.[1] && verseRange[2] && verseRange[3]) {
		chapter = Number(verseRange[1]);
		verseStart = Number(verseRange[2]);
		verseEnd = Number(verseRange[3]);
		chapterEnd = chapter;
	} else {
	const chRangeOnly = ref.match(/^(\d+)\s*[–—-]\s*(\d+)$/);
	if (chRangeOnly?.[1] && chRangeOnly[2]) {
		chapter = Number(chRangeOnly[1]);
		chapterEnd = Number(chRangeOnly[2]);
	} else {
		const refMatch = ref.match(/^(\d+)(?::(\d+)(?:\s*[,\-–]\s*(\d+))?)?$/);
		if (!refMatch?.[1]) throw new Error(`Bad reference: ${ref}`);
		chapter = Number(refMatch[1]);
		verseStart = refMatch[2] != null ? Number(refMatch[2]) : undefined;
		verseEnd = refMatch[3] != null ? Number(refMatch[3]) : undefined;
	}
	}

	const normalized = locs.replace(/;/g, ',').replace(/(\d)\s+(\d+:)/g, '$1, $2');
	const tokens = normalized
		.split(',')
		.map((t) => t.trim())
		.filter((t) => t.length > 0);

	let volume: string | null = null;
	const rows: IndexGoldRow[] = [];
	for (const token of tokens) {
		const volPage = token.match(/^(\d+):(\d+)(?:\s*[-–]\s*(\d+))?$/i);
		const volRomanPage = token.match(/^(\d+):([xivl]+)$/i);
		const romanVol = token.match(/^([lL]):([xvi]+)(?:\s*[-–]\s*(\d+))?$/i);
		const pageOnly = token.match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
		let pageStart: string;
		let pageEnd: string | undefined;
		if (volPage?.[1] && volPage[2]) {
			volume = volPage[1];
			pageStart = volPage[2];
			pageEnd = volPage[3];
		} else if (romanVol?.[1] && romanVol[2]) {
			volume = '1';
			pageStart = romanVol[2].toLowerCase();
			pageEnd = romanVol[3];
		} else if (volRomanPage?.[1] && volRomanPage[2]) {
			volume = volRomanPage[1];
			pageStart = volRomanPage[2].toLowerCase();
		} else if (pageOnly?.[1] && volume) {
			pageStart = pageOnly[1];
			pageEnd = pageOnly[2];
		} else {
			throw new Error(`Bad page token "${token}" in ${trimmed}`);
		}
		const row: IndexGoldRow = {
			bible_book: bibleBook,
			chapter_start: chapter,
			page_start: pageStart,
			volume
		};
		if (verseStart != null) row.verse_start = verseStart;
		if (verseEnd != null) {
			row.verse_end = verseEnd;
			row.chapter_end = chapter;
		}
		if (chapterEnd != null) {
			row.chapter_end = chapterEnd;
		}
		if (pageEnd) row.page_end = pageEnd;
		rows.push(row);
	}
	if (rows.length === 0) throw new Error(`No pages: ${line}`);
	return rows;
}
