/**
 * One-line reading-note capture.
 * `Towner 215 — …` names a source and a page. `@2:12` anchors the study's
 * primary Bible book. A sticky "reading now" source is applied by the caller
 * when the line does not name one.
 */
import { BIBLE_BOOK_NAMES } from '$lib/library/bible-book-names';
import { authorsByRole, parseAuthorAssignment } from '$lib/library/turabian/names';
import type { BookAuthorAssignment } from '$lib/types/library';
import type { PaperSourceView } from './paper-sources';

export type CaptureSource = {
	sourceId: string;
	/** Short-form last name, display case (`Towner`, `de Vos`). */
	lastName: string;
};

export type NoteAnchor = {
	passageDisplay: string;
	bibleBook: string;
	chapter: number | null;
	verseStart: number | null;
	verseEnd: number | null;
};

export type SourceResolution =
	| { kind: 'matched'; sourceId: string }
	| { kind: 'ambiguous'; sourceIds: string[] }
	| { kind: 'none' };

export type InterpretedNote = {
	body: string;
	page: string | null;
	/** The line named a source, matched or not. */
	namedSource: boolean;
	source: SourceResolution;
	anchor: NoteAnchor | null;
};

const SEPARATOR = /\s+(?:—|–|--|-)\s*/;
const PAGE_RE = /^(?:\d{1,4}(?:\s*[–-]\s*\d{1,4})?|[ivxlcdm]{1,8}|[A-Za-z]{1,8}(?:\.\d+){1,3})$/;
const BARE_ANCHOR = /^(\d+):(\d+)(?:\s*[–-]\s*(\d+))?/;
const FULL_ANCHOR =
	/^((?:\d\s+)?[A-Za-z][A-Za-z.']*(?:\s+[A-Za-z][A-Za-z.']*){0,3}?)\s+(\d+):(\d+)(?:\s*[–-]\s*(\d+))?/;

/** First author (or editor) last name, keeping the stored case. */
export function sourceLastName(authors: BookAuthorAssignment[]): string {
	const authorRows = authorsByRole(authors, 'author');
	const editorRows = authorsByRole(authors, 'editor');
	const primary = authorRows.length > 0 ? authorRows : editorRows;
	const first = primary[0];
	if (!first) return '';
	return parseAuthorAssignment(first).last.trim();
}

function sourceAuthors(source: PaperSourceView): BookAuthorAssignment[] {
	if (source.kind === 'book') return source.citation.authors;
	if (source.kind === 'essay') return source.essay.authors ?? [];
	return source.article.authors;
}

/** First author, for the “Reading …” chip. */
export function captureSourceFromView(source: PaperSourceView): CaptureSource | null {
	const lastName = sourceLastName(sourceAuthors(source));
	if (!lastName) return null;
	return { sourceId: source.sourceId, lastName };
}

/** Every author and editor last name, so “Towner” matches Marshall and Towner. */
export function captureSourcesFromView(source: PaperSourceView): CaptureSource[] {
	const authors = sourceAuthors(source);
	const rows = [...authorsByRole(authors, 'author'), ...authorsByRole(authors, 'editor')];
	const names = [
		...new Set(rows.map((row) => parseAuthorAssignment(row).last.trim()).filter((name) => name.length > 0))
	];
	return names.map((lastName) => ({ sourceId: source.sourceId, lastName }));
}

export function interpretNoteCapture(
	line: string,
	opts: {
		sources: CaptureSource[];
		stickySourceId?: string | null;
		prefilledPage?: string | null;
		primaryBibleBook?: string | null;
	}
): InterpretedNote | null {
	const raw = line.trim();
	if (!raw) return null;

	const { text, anchor } = extractAnchor(raw, opts.primaryBibleBook ?? null);
	const split = splitLocator(text);
	const located = split.locator == null ? null : parseLocator(split.locator, opts.sources);

	let body = split.body;
	let page: string | null = null;
	let namedSource = false;
	let named: SourceResolution = { kind: 'none' };

	if (located && (located.named || located.page)) {
		namedSource = located.named;
		named = located.source;
		page = located.page;
		if (located.rest) body = `${located.rest} ${body}`.trim();
	} else {
		body = text.trim();
	}

	body = body.trim();
	if (!body) return null;

	const sticky =
		opts.stickySourceId && opts.sources.some((s) => s.sourceId === opts.stickySourceId)
			? opts.stickySourceId
			: null;

	let source: SourceResolution = named;
	if (!namedSource && sticky) source = { kind: 'matched', sourceId: sticky };

	if (!page && source.kind === 'matched') {
		const prefilled = opts.prefilledPage?.trim() || null;
		page = prefilled;
	}

	return { body, page, namedSource, source, anchor };
}

function splitLocator(text: string): { locator: string | null; body: string } {
	const match = SEPARATOR.exec(text);
	if (!match || match.index === undefined) return { locator: null, body: text.trim() };
	const locator = text.slice(0, match.index).trim();
	const body = text.slice(match.index + match[0].length).trim();
	if (!locator) return { locator: null, body: text.trim() };
	return { locator, body };
}

function parseLocator(
	locator: string,
	sources: CaptureSource[]
): { named: boolean; source: SourceResolution; page: string | null; rest: string } | null {
	const name = matchLeadingName(locator, sources);
	const afterName = name.kind === 'none' ? locator : name.rest;
	const page = pageToken(afterName);
	const named = name.kind !== 'none';
	if (!named && !page) return null;
	const rest = page ? '' : afterName.trim();
	const source: SourceResolution =
		name.kind === 'matched'
			? { kind: 'matched', sourceId: name.sourceId }
			: name.kind === 'ambiguous'
				? { kind: 'ambiguous', sourceIds: name.sourceIds }
				: { kind: 'none' };
	return { named, source, page, rest };
}

function pageToken(value: string): string | null {
	const t = value.trim();
	if (!t || !PAGE_RE.test(t)) return null;
	return t.replace(/\s+/g, '');
}

function matchLeadingName(
	locator: string,
	sources: CaptureSource[]
):
	| { kind: 'none' }
	| { kind: 'matched'; sourceId: string; rest: string }
	| { kind: 'ambiguous'; sourceIds: string[]; rest: string } {
	const words = locator.split(/\s+/).filter(Boolean);
	for (let n = Math.min(3, words.length); n >= 1; n--) {
		const typed = words.slice(0, n).join(' ');
		if (typed.length < 2) continue;
		const typedLower = typed.toLowerCase();
		const hits = sources.filter((s) => s.lastName.toLowerCase().startsWith(typedLower));
		if (hits.length === 0) continue;
		const sourceIds = [...new Set(hits.map((h) => h.sourceId))];
		const rest = words.slice(n).join(' ');
		if (sourceIds.length === 1) return { kind: 'matched', sourceId: sourceIds[0]!, rest };
		return { kind: 'ambiguous', sourceIds, rest };
	}
	return { kind: 'none' };
}

function extractAnchor(
	line: string,
	primaryBibleBook: string | null
): { text: string; anchor: NoteAnchor | null } {
	const at = line.indexOf('@');
	if (at < 0) return { text: line, anchor: null };
	const after = line.slice(at + 1);

	const bare = BARE_ANCHOR.exec(after);
	if (bare && bare.index === 0) {
		if (!primaryBibleBook) return { text: line, anchor: null };
		const anchor = makeAnchor(
			primaryBibleBook,
			Number(bare[1]),
			Number(bare[2]),
			bare[3] ? Number(bare[3]) : null
		);
		return { text: joinAround(line, at, at + 1 + bare[0].length), anchor };
	}

	const full = FULL_ANCHOR.exec(after);
	if (full && full.index === 0) {
		const book = matchBookName(full[1] ?? '');
		if (!book) return { text: line, anchor: null };
		const anchor = makeAnchor(
			book,
			Number(full[2]),
			Number(full[3]),
			full[4] ? Number(full[4]) : null
		);
		return { text: joinAround(line, at, at + 1 + full[0].length), anchor };
	}

	return { text: line, anchor: null };
}

function joinAround(line: string, start: number, end: number): string {
	return `${line.slice(0, start)} ${line.slice(end)}`.replace(/\s+/g, ' ').trim();
}

function makeAnchor(
	bibleBook: string,
	chapter: number,
	verseStart: number,
	verseEnd: number | null
): NoteAnchor {
	let passageDisplay = `${bibleBook} ${chapter}:${verseStart}`;
	if (verseEnd != null && verseEnd !== verseStart) passageDisplay += `–${verseEnd}`;
	return {
		passageDisplay,
		bibleBook,
		chapter,
		verseStart,
		verseEnd: verseEnd != null && verseEnd !== verseStart ? verseEnd : null
	};
}

/** Unique Bible-book name, or a unique prefix (`1 Tim` → `1 Timothy`). */
export function matchBookName(raw: string): string | null {
	const t = raw.trim().toLowerCase().replace(/\s+/g, ' ');
	if (!t) return null;
	const exact = BIBLE_BOOK_NAMES.find((name) => name.toLowerCase() === t);
	if (exact) return exact;
	const hits = BIBLE_BOOK_NAMES.filter((name) => name.toLowerCase().startsWith(t));
	return hits.length === 1 ? hits[0]! : null;
}
