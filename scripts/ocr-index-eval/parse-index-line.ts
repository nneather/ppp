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

export function parseIndexEntry(line: string, bibleBook: string): IndexGoldRow[] {
	const trimmed = line.trim();
	if (!trimmed || trimmed.startsWith('#')) return [];

	let ref: string;
	let locs: string;
	const em = trimmed.search(/[—–]/);
	if (em >= 0) {
		ref = trimmed.slice(0, em).trim();
		locs = trimmed.slice(em + 1).trim();
	} else {
		const split = trimmed.match(/^(.*?)-(\d+:.+)$/);
		if (!split?.[1] || !split[2]) throw new Error(`No locator separator: ${trimmed}`);
		ref = split[1].trim();
		locs = split[2].trim();
	}

	const refMatch = ref.match(/^(\d+)(?::(\d+)(?:\s*[,\-–]\s*(\d+))?)?$/);
	if (!refMatch?.[1]) throw new Error(`Bad reference: ${ref}`);
	const chapter = Number(refMatch[1]);
	const verseStart = refMatch[2] != null ? Number(refMatch[2]) : undefined;
	const verseEnd = refMatch[3] != null ? Number(refMatch[3]) : undefined;

	const normalized = locs.replace(/;/g, ',').replace(/(\d)\s+(\d+:)/g, '$1, $2');
	const tokens = normalized
		.split(',')
		.map((t) => t.trim())
		.filter((t) => t.length > 0);

	let volume: string | null = null;
	const rows: IndexGoldRow[] = [];
	for (const token of tokens) {
		const volPage = token.match(/^(\d+):(\d+)(?:\s*[-–]\s*(\d+))?$/);
		const pageOnly = token.match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
		let pageStart: string;
		let pageEnd: string | undefined;
		if (volPage?.[1] && volPage[2]) {
			volume = volPage[1];
			pageStart = volPage[2];
			pageEnd = volPage[3];
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
		if (pageEnd) row.page_end = pageEnd;
		rows.push(row);
	}
	if (rows.length === 0) throw new Error(`No pages: ${trimmed}`);
	return rows;
}
