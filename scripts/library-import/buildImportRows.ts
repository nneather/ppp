/**
 * buildImportRows — pure transformation pipeline.
 *
 * Inputs (paths via env or args):
 *   - data/Library_1.xlsx           → 1,330 raw spreadsheet rows
 *   - data/enriched_library.csv     → Open Library enrichments (isbn/year/...)
 *
 * Output:
 *   - data/rows.json                → array of fully-resolved import rows
 *   - data/rows.report.txt          → counts + outliers (no DB access)
 *
 * Operations (in order):
 *   1. Load source rows from xlsx Library sheet (skip Subject = blank for
 *      sheets-other-than-Library). Capture src_row for traceability.
 *   2. Index enrichment CSV by row.
 *   3. Apply DELETIONS (drop matching rows).
 *   4. For each remaining source row:
 *      a. Parse Author column into structured authors[] (multi-author splits
 *         use " and " / " & " separators).
 *      b. Apply GLOBAL_RULES (status case, edition extraction, deRoos note).
 *      c. Map Subject → genre.
 *      d. Map enrichment fields (isbn, publisher, year, page_count, subtitle).
 *         If match_type = title-only, flag needs_review = true with
 *         "OL match: title-only — verify edition" auto-line.
 *      e. Apply BROCKHAUS_RULES if Subject = BH.
 *      f. Apply matching PER_BOOK_OVERRIDES.
 *      g. Apply DEFERRED_SHELF_CHECK flags.
 *      h. computeMissingImportant → flip needs_review = true if any of
 *         [title, author, genre, year, publisher] missing.
 *      i. Map genre → primary_category_slug.
 *   5. Append ADDITIONS rows (BDAG).
 *   6. Detect collisions: each PER_BOOK_OVERRIDE matched ≥ 1 source row;
 *      report orphan overrides (failed matches) so the user sees them.
 *
 * Run:
 *   npx tsx scripts/library-import/buildImportRows.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
// xlsx ships dual CJS/ESM; under node ESM, only `read` and `utils` are
// exposed. Read the file ourselves and pass the buffer to XLSX.read().
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';
import { parseTypedName, type PersonInput } from '../../src/lib/library/server/people-actions.ts';
import {
	GLOBAL_RULES,
	SUBJECT_TO_GENRE,
	GENRE_TO_CATEGORY_SLUG,
	PER_BOOK_OVERRIDES,
	BROCKHAUS_RULES,
	DELETIONS,
	ADDITIONS,
	DEFERRED_SHELF_CHECK,
	type OverrideAuthor,
	type PerBookMatch,
	type SubjectCode
} from './migrationOverrides.ts';
import { IMPORTANT_FIELDS, type AuthorAssignmentInput } from '../../src/lib/library/server/book-actions.ts';
import type { Genre, Language, ReadingStatus } from '../../src/lib/types/library.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, 'data');
const XLSX_PATH = resolve(DATA_DIR, 'Library_1.xlsx');
const ENRICHED_CSV = resolve(DATA_DIR, 'enriched_library.csv');
const ROWS_JSON = resolve(DATA_DIR, 'rows.json');
const ROWS_REPORT = resolve(DATA_DIR, 'rows.report.txt');

// ---------------------------------------------------------------------------
// Types — the resolved shape that lands in rows.json + the importer
// ---------------------------------------------------------------------------

export type ImportAuthor = {
	last_name: string;
	first_name: string | null;
	middle_name: string | null;
	suffix: string | null;
	role: 'author' | 'editor' | 'translator';
	sort_order: number;
};

export type ImportRow = {
	src_row: number | null; // null for ADDITIONS
	source_subject: string | null;
	source_status: string | null;
	// Spreadsheet-owned fields (mapped to schema)
	title: string | null;
	subtitle: string | null;
	publisher: string | null;
	publisher_location: string | null;
	year: number | null;
	edition: string | null;
	total_volumes: number | null;
	original_year: number | null;
	reprint_publisher: string | null;
	reprint_location: string | null;
	reprint_year: number | null;
	series_abbrev: string | null;
	volume_number: string | null;
	genre: Genre | null;
	primary_category_slug: string | null;
	language: Language;
	isbn: string | null;
	barcode: string | null;
	page_count: number | null;
	// Mixed
	needs_review: boolean;
	needs_review_note: string | null;
	// User-owned (Pass 1 only — first INSERT only)
	reading_status: ReadingStatus;
	borrowed_to: string | null;
	personal_notes: string | null;
	shelving_location: string | null;
	// Junctions
	authors: ImportAuthor[];
	// Provenance / traceability
	provenance: {
		ol_match_type: 'title+author' | 'title-only' | 'no-match' | 'none';
		applied_overrides: string[];
		notes: string[];
	};
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readEnrichmentCsv(): Map<number, EnrichRow> {
	const txt = readFileSync(ENRICHED_CSV, 'utf8');
	const rows = parseCsv(txt);
	const map = new Map<number, EnrichRow>();
	for (const r of rows) {
		const row = Number(r.row);
		if (!Number.isFinite(row)) continue;
		map.set(row, {
			row,
			title: r.title ?? '',
			author: r.author ?? '',
			match_type: (r.match_type ?? 'no-match') as EnrichRow['match_type'],
			isbn: r.isbn || null,
			publisher: r.publisher || null,
			year: r.year ? Number(r.year) || null : null,
			pages: r.pages ? Number(r.pages) || null : null,
			subtitle: r.subtitle || null
		});
	}
	return map;
}

type EnrichRow = {
	row: number;
	title: string;
	author: string;
	match_type: 'title+author' | 'title-only' | 'no-match';
	isbn: string | null;
	publisher: string | null;
	year: number | null;
	pages: number | null;
	subtitle: string | null;
};

/**
 * Minimal RFC-4180 CSV parser. enrichment_progress writes proper-quoted CSV;
 * pulling in a 200kb dep for one parse is overkill.
 */
function parseCsv(txt: string): Record<string, string>[] {
	const lines: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let inQuotes = false;
	for (let i = 0; i < txt.length; i++) {
		const c = txt[i];
		if (inQuotes) {
			if (c === '"') {
				if (txt[i + 1] === '"') {
					cell += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else cell += c;
		} else {
			if (c === '"') inQuotes = true;
			else if (c === ',') {
				row.push(cell);
				cell = '';
			} else if (c === '\n') {
				row.push(cell);
				cell = '';
				lines.push(row);
				row = [];
			} else if (c === '\r') {
				/* skip */
			} else cell += c;
		}
	}
	if (cell || row.length > 0) {
		row.push(cell);
		lines.push(row);
	}
	const header = lines[0] ?? [];
	const out: Record<string, string>[] = [];
	for (let i = 1; i < lines.length; i++) {
		const r = lines[i];
		if (r.length === 1 && r[0] === '') continue;
		const obj: Record<string, string> = {};
		for (let j = 0; j < header.length; j++) {
			obj[header[j]] = r[j] ?? '';
		}
		out.push(obj);
	}
	return out;
}

function readSourceRows(): SourceRow[] {
	const buf = readFileSync(XLSX_PATH);
	const wb = xlsxRead(buf, { type: 'buffer' });
	const ws = wb.Sheets['Library'];
	if (!ws) throw new Error('Library sheet not found in xlsx');
	const aoa = xlsxUtils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: null });
	const out: SourceRow[] = [];
	for (let i = 1; i < aoa.length; i++) {
		const row = aoa[i] ?? [];
		const author = (row[0] as string | null)?.toString()?.trim() ?? null;
		const series = (row[1] as string | null)?.toString()?.trim() ?? null;
		const subject = (row[2] as string | null)?.toString()?.trim() ?? null;
		const title = (row[3] as string | null)?.toString()?.trim() ?? null;
		const status = (row[7] as string | null)?.toString()?.trim() ?? null;
		const borrowed = (row[8] as string | null)?.toString()?.trim() ?? null;
		const notes = (row[9] as string | null)?.toString()?.trim() ?? null;
		// Skip wholly-empty rows (xlsx sometimes carries trailing nulls)
		if (!title && !author) continue;
		out.push({
			src_row: i + 1, // xlsx row number (1-indexed; +1 because aoa[0] = header)
			author,
			series,
			subject,
			title,
			status,
			borrowed,
			notes
		});
	}
	return out;
}

type SourceRow = {
	src_row: number;
	author: string | null;
	series: string | null;
	subject: string | null;
	title: string | null;
	status: string | null;
	borrowed: string | null;
	notes: string | null;
};

function normalizeForMatch(s: string | null | undefined): string {
	if (!s) return '';
	return s
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.trim()
		.replace(/\s+/g, ' ');
}

function parseAuthorsField(raw: string | null): PersonInput[] {
	if (!raw) return [];
	// Multi-author splitters: " and ", " & ", "; "
	// But beware: "Last, First and Last2, First2" has commas inside. The reliable
	// split point is " and " / " & " between two pre-comma'd "Last, First[ Middle]"
	// chunks. For the import script we'll use the simple " and " / " & " split
	// and let parseTypedName handle the remainder.
	const split = raw.split(/\s+(?:and|&)\s+/i).map((s) => s.trim()).filter(Boolean);
	const out: PersonInput[] = [];
	for (const chunk of split) {
		const p = parseTypedName(chunk);
		if (p) out.push(p);
	}
	return out;
}

function applyEditionExtraction(title: string | null): { title: string | null; edition: string | null } {
	if (!title) return { title, edition: null };
	for (const rule of GLOBAL_RULES.editionSuffixes) {
		const m = title.match(rule.regex);
		if (m) {
			const stripped = title.replace(rule.regex, '').trim();
			let edition = rule.edition;
			if (edition === '__from_match') {
				edition = m[0]
					.replace(/^[,\s]+/, '')
					.replace(/^\s+|\s+$/g, '')
					.replace(/\.$/, '');
			}
			return { title: stripped, edition };
		}
	}
	return { title, edition: null };
}

function mergeReviewNote(existing: string | null, autoLines: string[]): string | null {
	const lines = autoLines.filter(Boolean);
	if (lines.length === 0) return existing;
	const auto = lines.join(' / ');
	const trimmed = existing?.trim() ?? '';
	if (!trimmed) return auto;
	// Replace any existing auto-line (Missing: …, OL match: …, Deferred shelf-check: …)
	if (/^(Missing:|OL match:|Deferred shelf-check:)/.test(trimmed)) return auto;
	return `${auto}\n\n${existing}`;
}

function matchOverride(
	row: ImportRow,
	m: PerBookMatch,
	src: { series?: string | null; author?: string | null }
): boolean {
	if (m.subject !== undefined && row.source_subject !== m.subject) return false;
	if (m.series !== undefined) {
		if ((src.series ?? row.series_abbrev ?? null) !== m.series) return false;
	}
	if (m.author_surname) {
		const wanted = normalizeForMatch(m.author_surname);
		const ok = row.authors.some((a) => normalizeForMatch(a.last_name).includes(wanted));
		if (!ok) return false;
	}
	if (m.author_raw_contains) {
		const wanted = normalizeForMatch(m.author_raw_contains);
		if (!normalizeForMatch(src.author ?? '').includes(wanted)) return false;
	}
	if (m.title_contains) {
		if (!normalizeForMatch(row.title).includes(normalizeForMatch(m.title_contains))) return false;
	}
	if (m.title_matches) {
		if (!m.title_matches.test(row.title ?? '')) return false;
	}
	if (m.title_excludes) {
		if (normalizeForMatch(row.title).includes(normalizeForMatch(m.title_excludes))) return false;
	}
	return true;
}

function applyEdit(row: ImportRow, edit: typeof PER_BOOK_OVERRIDES[number]['edit']): void {
	if (edit.title !== undefined) row.title = edit.title;
	if (edit.subtitle !== undefined) row.subtitle = edit.subtitle;
	if (edit.edition !== undefined) row.edition = edit.edition;
	if (edit.series_abbrev !== undefined) row.series_abbrev = edit.series_abbrev;
	if (edit.volume_number !== undefined) row.volume_number = edit.volume_number;
	if (edit.language !== undefined) row.language = edit.language;
	if (edit.reading_status !== undefined) row.reading_status = edit.reading_status;
	if (edit.genre !== undefined) row.genre = edit.genre ?? null;
	if (edit.year !== undefined) row.year = edit.year;
	if (edit.publisher !== undefined) row.publisher = edit.publisher;
	if (edit.publisher_location !== undefined) row.publisher_location = edit.publisher_location;
	if (edit.original_year !== undefined) row.original_year = edit.original_year;
	if (edit.reprint_publisher !== undefined) row.reprint_publisher = edit.reprint_publisher;
	if (edit.reprint_location !== undefined) row.reprint_location = edit.reprint_location;
	if (edit.reprint_year !== undefined) row.reprint_year = edit.reprint_year;
	if (edit.personal_notes !== undefined) row.personal_notes = edit.personal_notes;
	if (edit.personal_notes_append !== undefined) {
		row.personal_notes = row.personal_notes
			? `${row.personal_notes}\n\n${edit.personal_notes_append}`
			: edit.personal_notes_append;
	}
	if (edit.needs_review !== undefined) row.needs_review = edit.needs_review;
	if (edit.needs_review_note !== undefined) row.needs_review_note = edit.needs_review_note;
	if (edit.clear_borrowed_to) row.borrowed_to = null;
	if (edit.authors !== undefined) {
		row.authors = edit.authors.map((a: OverrideAuthor) => ({
			last_name: a.last_name,
			first_name: a.first_name ?? null,
			middle_name: a.middle_name ?? null,
			suffix: a.suffix ?? null,
			role: a.role,
			sort_order: a.sort_order
		}));
	}
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

function build(): {
	rows: ImportRow[];
	report: string;
	overrideHits: Map<string, number>;
} {
	const sources = readSourceRows();
	const enrich = readEnrichmentCsv();

	const rows: ImportRow[] = [];
	const overrideHits = new Map<string, number>();
	const droppedDeletions: { src_row: number; reason: string }[] = [];
	const titleOnlyFlagged: number[] = [];
	const noMatchFlagged: number[] = [];

	for (const src of sources) {
		// 1. Apply DELETIONS — must check BEFORE we build the row, but DELETIONS
		// match on subject+author+title, so we need a partial parse first.
		const tentativeAuthors = parseAuthorsField(src.author);
		let dropped = false;
		for (const del of DELETIONS) {
			if (del.match.subject !== undefined && src.subject !== del.match.subject) continue;
			if (del.match.series !== undefined && src.series !== del.match.series) continue;
			if (del.match.author_surname) {
				const wanted = normalizeForMatch(del.match.author_surname);
				const ok = tentativeAuthors.some((a) => normalizeForMatch(a.last_name).includes(wanted));
				if (!ok) continue;
			}
			if (del.match.author_raw_contains) {
				const wanted = normalizeForMatch(del.match.author_raw_contains);
				if (!normalizeForMatch(src.author ?? '').includes(wanted)) continue;
			}
			if (del.match.title_contains) {
				if (!normalizeForMatch(src.title).includes(normalizeForMatch(del.match.title_contains))) continue;
			}
			if (del.match.title_excludes) {
				if (normalizeForMatch(src.title).includes(normalizeForMatch(del.match.title_excludes))) continue;
			}
			droppedDeletions.push({ src_row: src.src_row, reason: del.reason });
			overrideHits.set(`DEL ${del.source_ref}`, (overrideHits.get(`DEL ${del.source_ref}`) ?? 0) + 1);
			dropped = true;
			break;
		}
		if (dropped) continue;

		// 2. Title + edition extraction
		const { title: titleStripped, edition: editionFromTitle } = applyEditionExtraction(src.title);

		// 3. Status normalization (notes' global rule)
		const statusKey = (src.status ?? '').toLowerCase().trim();
		const reading_status: ReadingStatus = (GLOBAL_RULES.statusMap[statusKey] ?? 'unread') as ReadingStatus;

		// 4. Notes column → personal_notes (deRoos rule)
		let personal_notes = src.notes;
		let borrowed_to = src.borrowed;
		if (src.notes && GLOBAL_RULES.deRoosNoteRegex.test(src.notes)) {
			personal_notes = GLOBAL_RULES.deRoosCanonicalNote;
			borrowed_to = null;
		}

		// 5. Subject → genre + primary_category_slug
		const subjectRaw = src.subject ?? '';
		const genre = SUBJECT_TO_GENRE[subjectRaw] ?? null;
		const primary_category_slug = genre ? GENRE_TO_CATEGORY_SLUG[genre] ?? null : null;

		// 6. Enrichment merge
		const e = enrich.get(src.src_row);
		const ol_match_type: ImportRow['provenance']['ol_match_type'] = e?.match_type ?? 'none';
		const isTitleOnly = ol_match_type === 'title-only';

		const row: ImportRow = {
			src_row: src.src_row,
			source_subject: src.subject,
			source_status: src.status,
			title: titleStripped,
			subtitle: e?.subtitle ?? null,
			publisher: e?.publisher ?? null,
			publisher_location: null,
			year: e?.year ?? null,
			edition: editionFromTitle,
			total_volumes: null,
			original_year: null,
			reprint_publisher: null,
			reprint_location: null,
			reprint_year: null,
			series_abbrev: src.series,
			volume_number: null,
			genre,
			primary_category_slug,
			language: 'english',
			isbn: e?.isbn ?? null,
			barcode: null,
			page_count: e?.pages ?? null,
			needs_review: false,
			needs_review_note: null,
			reading_status,
			borrowed_to,
			personal_notes,
			shelving_location: null,
			authors: tentativeAuthors.map((p, i) => ({
				last_name: p.last_name,
				first_name: p.first_name ?? null,
				middle_name: p.middle_name ?? null,
				suffix: p.suffix ?? null,
				role: 'author',
				sort_order: i + 1
			})),
			provenance: {
				ol_match_type,
				applied_overrides: [],
				notes: []
			}
		};

		// 7. Brockhaus group standardization — driven by SERIES = 'BH', not subject
		// (source has subject=REF for these rows). Title becomes letter range
		// (e.g. "A-APT") which the rule lifts into volume_number + sets the
		// canonical title.
		// Brockhaus rule keys off series='BH' EXCEPT when subject='BBL' — the
		// user occasionally puts publisher 'Brockhaus' as series on a Bible
		// row, but those are real Bibles, not reference vols. Skip Brockhaus
		// rule for subject=BBL; the regular BBL pipeline handles it.
		const srcSeries = src.series;
		let brockhausApplied = false;
		if (srcSeries === 'BH' && src.subject !== 'BBL') {
			brockhausApplied = applyBrockhaus(row, src);
		} else if (srcSeries === 'BH' && src.subject === 'BBL') {
			// Clear the BH series tag so the row doesn't get linked to the
			// Brockhaus reference series in the DB.
			row.series_abbrev = null;
			row.provenance.notes.push('BH series cleared on BBL row (Brockhaus is publisher, not reference series here)');
		}

		// 8. Apply per-book overrides. Track whether any override explicitly
		// set needs_review = false, so the missing-field auto-flag below honors
		// the override (curated scholarly-core rows shouldn't trip the queue
		// for missing year/publisher when we know the metadata is correct).
		const matchCtx = { series: srcSeries, author: src.author };
		let needsReviewExplicitlyClearedByOverride = brockhausApplied;
		for (const ov of PER_BOOK_OVERRIDES) {
			if (!matchOverride(row, ov.match, matchCtx)) continue;
			applyEdit(row, ov.edit);
			if (ov.edit.needs_review === false) needsReviewExplicitlyClearedByOverride = true;
			row.provenance.applied_overrides.push(ov.source_ref);
			overrideHits.set(ov.source_ref, (overrideHits.get(ov.source_ref) ?? 0) + 1);
		}

		// 8a. TWOT volume number — extract from source title ("Vol. I"/"Vol. II")
		// since the override sets the canonical title but loses the vol info.
		if (row.series_abbrev === 'TWOT') {
			const t = (src.title ?? '').toLowerCase();
			if (/vol\.?\s*i(\W|$)/i.test(t)) row.volume_number = '1';
			else if (/vol\.?\s*ii/i.test(t)) row.volume_number = '2';
		}

		// 9. Deferred shelf-check flags
		const autoLines: string[] = [];
		for (const dsc of DEFERRED_SHELF_CHECK) {
			if (matchOverride(row, dsc.match, matchCtx)) {
				autoLines.push(`Deferred shelf-check: ${dsc.note}`);
				row.needs_review = true;
				overrideHits.set(`DSC ${dsc.source_ref}`, (overrideHits.get(`DSC ${dsc.source_ref}`) ?? 0) + 1);
				break;
			}
		}

		// 11. title-only enrichment flag (per-plan resolution). Curated rows
		// that explicitly cleared needs_review have authoritative metadata
		// from the migration notes, so OL ambiguity doesn't matter.
		if (isTitleOnly) {
			autoLines.push('OL match: title-only — verify edition');
			if (!needsReviewExplicitlyClearedByOverride) row.needs_review = true;
			titleOnlyFlagged.push(src.src_row);
		}

		// 12. computeMissingImportant — but skip the "author" check for Brockhaus
		// (publisher-as-author by design) and skip "publisher" for German /
		// non-OL-matched rows where the data is genuinely unavailable.
		const missing: string[] = [];
		if (!row.title) missing.push('title');
		const isBrockhaus = srcSeries === 'BH';
		const requiresAuthor = !isBrockhaus;
		if (requiresAuthor && row.authors.filter((a) => a.role === 'author' || a.role === 'editor').length === 0) {
			missing.push('author');
		}
		if (!row.genre) missing.push('genre');
		if (row.year == null) missing.push('year');
		if (!row.publisher && !isBrockhaus) missing.push('publisher');
		if (missing.length > 0) {
			autoLines.push(`Missing: ${missing.join(', ')}`);
			if (!needsReviewExplicitlyClearedByOverride) row.needs_review = true;
		}
		if (ol_match_type === 'no-match') noMatchFlagged.push(src.src_row);

		row.needs_review_note = mergeReviewNote(row.needs_review_note, autoLines);

		// Re-resolve genre → category slug if override changed it
		if (row.genre) row.primary_category_slug = GENRE_TO_CATEGORY_SLUG[row.genre] ?? null;

		rows.push(row);
	}

	// 13. Append ADDITIONS
	for (const add of ADDITIONS) {
		const e = add.row;
		const genre = SUBJECT_TO_GENRE[add.subject] ?? null;
		rows.push({
			src_row: null,
			source_subject: add.subject,
			source_status: null,
			title: e.title,
			subtitle: e.subtitle ?? null,
			publisher: e.publisher ?? null,
			publisher_location: e.publisher_location ?? null,
			year: e.year ?? null,
			edition: e.edition ?? null,
			total_volumes: null,
			original_year: null,
			reprint_publisher: null,
			reprint_location: null,
			reprint_year: null,
			series_abbrev: null,
			volume_number: null,
			genre,
			primary_category_slug: genre ? GENRE_TO_CATEGORY_SLUG[genre] ?? null : null,
			language: e.language ?? 'english',
			isbn: e.isbn ?? null,
			barcode: null,
			page_count: e.page_count ?? null,
			needs_review: e.needs_review ?? false,
			needs_review_note: e.needs_review_note ?? null,
			reading_status: e.reading_status ?? 'unread',
			borrowed_to: null,
			personal_notes: e.personal_notes ?? null,
			shelving_location: null,
			authors: (e.authors ?? []).map((a: OverrideAuthor) => ({
				last_name: a.last_name,
				first_name: a.first_name ?? null,
				middle_name: a.middle_name ?? null,
				suffix: a.suffix ?? null,
				role: a.role,
				sort_order: a.sort_order
			})),
			provenance: {
				ol_match_type: 'none',
				applied_overrides: [`ADD ${add.source_ref}`],
				notes: [`Synthetic INSERT (not in source CSV)`]
			}
		});
		overrideHits.set(`ADD ${add.source_ref}`, 1);
	}

	// 14. Source-internal duplicate detection — flag pairs sharing
	// (normalized title, first-author last_name, volume_number) so the user
	// can soft-delete one via the UI later. Including volume_number means
	// ABD vol 1 and ABD vol 2 are NOT flagged (different volumes), but two
	// CMT Acts: Revised rows ARE flagged (same title, same author, no vol).
	const dupKeys = new Map<string, ImportRow[]>();
	for (const r of rows) {
		const titleKey = normalizeForMatch(r.title);
		const authorKey = normalizeForMatch(r.authors[0]?.last_name);
		const volKey = r.volume_number ?? '';
		if (!titleKey) continue;
		const k = `${titleKey}|${authorKey}|${volKey}`;
		if (!dupKeys.has(k)) dupKeys.set(k, []);
		dupKeys.get(k)!.push(r);
	}
	const internalDuplicates: { src_rows: number[]; title: string }[] = [];
	for (const [, group] of dupKeys) {
		if (group.length < 2) continue;
		internalDuplicates.push({
			src_rows: group.map((g) => g.src_row ?? -1),
			title: group[0].title ?? '(untitled)'
		});
		for (const r of group) {
			r.needs_review = true;
			const others = group.filter((g) => g !== r).map((g) => g.src_row).join(', ');
			r.needs_review_note = mergeReviewNote(r.needs_review_note, [
				`Source duplicate of src_row(s) ${others} — manual merge needed`
			]);
		}
	}

	// Build report
	const report = buildReport({
		rows,
		droppedDeletions,
		overrideHits,
		titleOnlyFlagged,
		noMatchFlagged,
		internalDuplicates
	});

	return { rows, report, overrideHits };
}

/**
 * Brockhaus group standardization. Source rows have:
 *   author = "Brockhaus", series = "BH", subject = "REF",
 *   title  = letter range only ("A-APT", "WÖRTERBUCH ENGLISH", "1996", etc.)
 * The rule sets canonical title + language=german + clears authors and lifts
 * the source title into volume_number / personal_notes.
 *
 * Detection by source title:
 *   - "1996" (Jahrbuch)
 *   - "WÖRTERBUCH ENGLISH" / "PERSONEN REGISTER" / "ERGÄNZUNGEN A-Z" (supplementary 25-27)
 *   - GLUC-/GLUB- letter range → Wörterbuch
 *   - any other plain letter range → Enzyklopädie
 */
function applyBrockhaus(row: ImportRow, src: SourceRow): boolean {
	const srcTitle = (src.title ?? '').trim();
	const t = srcTitle;

	// Jahrbuch (year as title)
	if (/^\d{4}$/.test(t)) {
		row.title = `Brockhaus Jahrbuch ${t}`;
		row.year = parseInt(t, 10);
		row.series_abbrev = null;
		row.language = 'german';
		row.needs_review = false;
		row.authors = [];
		row.genre = 'Biblical Reference';
		row.primary_category_slug = 'languages-reference';
		row.provenance.notes.push('Brockhaus Jahrbuch rule');
		return true;
	}

	// Supplementary vols 25-27 (named, not letter range)
	for (const sup of BROCKHAUS_RULES.supplementary.titlePatterns) {
		if (sup.regex.test(t)) {
			row.title = BROCKHAUS_RULES.supplementary.title;
			row.series_abbrev = 'BH';
			row.language = 'german';
			row.needs_review = false;
			row.volume_number = sup.vol;
			row.personal_notes = sup.note;
			row.authors = [];
			row.genre = 'Biblical Reference';
			row.primary_category_slug = 'languages-reference';
			row.provenance.notes.push(`Brockhaus supplementary vol ${sup.vol}`);
			return true;
		}
	}

	// Wörterbuch — title is "DEUTSCHES WÖRTERBUCH <letter range>" in source
	// (or just the letter range if the user re-edits). Match by endsWith, fall
	// back to exact letter-range match.
	const tUpper = t.toUpperCase();
	if (/^DEUTSCHES W[ÖO]RTERBUCH/i.test(t) || ['A-GLUB', 'GLUC-REG', 'REH-ZZ'].includes(tUpper)) {
		row.title = BROCKHAUS_RULES.woerterbuch.title;
		row.series_abbrev = 'BH';
		row.language = 'german';
		row.needs_review = false;
		const trailingRange = t.replace(/^DEUTSCHES W[ÖO]RTERBUCH\s+/i, '').toUpperCase();
		const idx = BROCKHAUS_RULES.woerterbuch.volumes.findIndex(
			(v) => v.toUpperCase() === trailingRange
		);
		row.volume_number = idx >= 0 ? String(idx + 1) : null;
		row.personal_notes = `Letter range: ${trailingRange || t}.`;
		row.authors = [];
		row.genre = 'Biblical Reference';
		row.primary_category_slug = 'languages-reference';
		row.provenance.notes.push(`Brockhaus Wörterbuch vol ${row.volume_number ?? '?'}`);
		return true;
	}

	// Enzyklopädie — 24-vol letter ranges
	const idx = BROCKHAUS_RULES.enzyklopaedie.volumes.findIndex(
		(v) => v.toUpperCase() === t.toUpperCase()
	);
	if (idx >= 0) {
		row.title = BROCKHAUS_RULES.enzyklopaedie.title;
		row.series_abbrev = 'BH';
		row.language = 'german';
		row.needs_review = false;
		row.volume_number = String(idx + 1);
		row.personal_notes = `Letter range: ${t}.`;
		row.authors = [];
		row.genre = 'Biblical Reference';
		row.primary_category_slug = 'languages-reference';
		row.provenance.notes.push(`Brockhaus Enzyklopädie vol ${idx + 1}`);
		return true;
	}

	// Fallback: unknown Brockhaus row — keep authors/title as-is, just flag
	row.provenance.notes.push(`Brockhaus row but unknown title pattern: "${t}"`);
	return false;
}

function buildReport(args: {
	rows: ImportRow[];
	droppedDeletions: { src_row: number; reason: string }[];
	overrideHits: Map<string, number>;
	titleOnlyFlagged: number[];
	noMatchFlagged: number[];
	internalDuplicates: { src_rows: number[]; title: string }[];
}): string {
	const { rows, droppedDeletions, overrideHits, titleOnlyFlagged, noMatchFlagged, internalDuplicates } = args;
	const out: string[] = [];
	out.push('=== buildImportRows report ===');
	out.push('');
	out.push(`Total resolved rows:        ${rows.length}`);
	out.push(`  Synthetic ADDITIONS:      ${rows.filter((r) => r.src_row === null).length}`);
	out.push(`  Dropped via DELETIONS:    ${droppedDeletions.length}`);
	out.push(`  needs_review = true:      ${rows.filter((r) => r.needs_review).length}`);
	out.push(`  needs_review = false:     ${rows.filter((r) => !r.needs_review).length}`);
	out.push(`  title-only flagged:       ${titleOnlyFlagged.length}`);
	out.push(`  no-match (no enrichment): ${noMatchFlagged.length}`);
	out.push(`  source-internal dups:     ${internalDuplicates.length} pairs/groups`);
	out.push('');

	if (internalDuplicates.length > 0) {
		out.push('Source-internal duplicate pairs (both kept; flagged for manual merge):');
		for (const d of internalDuplicates.slice(0, 30)) {
			out.push(`  src_rows=[${d.src_rows.join(', ')}] title="${d.title.slice(0, 60)}"`);
		}
		if (internalDuplicates.length > 30) out.push(`  ... +${internalDuplicates.length - 30} more`);
		out.push('');
	}

	out.push('Genre breakdown:');
	const byGenre = new Map<string, number>();
	for (const r of rows) {
		const k = r.genre ?? '(NULL)';
		byGenre.set(k, (byGenre.get(k) ?? 0) + 1);
	}
	for (const [k, v] of [...byGenre.entries()].sort((a, b) => b[1] - a[1])) {
		out.push(`  ${k.padEnd(28)} ${v}`);
	}
	out.push('');

	out.push('Subject breakdown (source):');
	const bySubject = new Map<string, number>();
	for (const r of rows) {
		const k = r.source_subject ?? '(blank)';
		bySubject.set(k, (bySubject.get(k) ?? 0) + 1);
	}
	for (const [k, v] of [...bySubject.entries()].sort((a, b) => b[1] - a[1])) {
		out.push(`  ${k.padEnd(10)} ${v}`);
	}
	out.push('');

	out.push('Language breakdown:');
	const byLang = new Map<string, number>();
	for (const r of rows) {
		byLang.set(r.language, (byLang.get(r.language) ?? 0) + 1);
	}
	for (const [k, v] of [...byLang.entries()].sort((a, b) => b[1] - a[1])) {
		out.push(`  ${k.padEnd(10)} ${v}`);
	}
	out.push('');

	out.push('Series counts (top 30):');
	const bySeries = new Map<string, number>();
	for (const r of rows) {
		if (!r.series_abbrev) continue;
		bySeries.set(r.series_abbrev, (bySeries.get(r.series_abbrev) ?? 0) + 1);
	}
	const seriesSorted = [...bySeries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
	for (const [k, v] of seriesSorted) {
		out.push(`  ${k.padEnd(20)} ${v}`);
	}
	out.push(`  (${bySeries.size} distinct series)`);
	out.push('');

	out.push('Override application audit:');
	out.push('');
	out.push('  -- Hit overrides --');
	const sortedHits = [...overrideHits.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	for (const [k, v] of sortedHits) {
		out.push(`  [${v}x] ${k}`);
	}
	out.push('');
	out.push('  -- ORPHAN overrides (no matching source row) --');
	const allOverrideRefs = [
		...PER_BOOK_OVERRIDES.map((o) => o.source_ref),
		...DELETIONS.map((d) => `DEL ${d.source_ref}`),
		...DEFERRED_SHELF_CHECK.map((d) => `DSC ${d.source_ref}`),
		...ADDITIONS.map((a) => `ADD ${a.source_ref}`)
	];
	const orphans = allOverrideRefs.filter((r) => !overrideHits.has(r));
	if (orphans.length === 0) {
		out.push('  (none — all overrides matched at least one row)');
	} else {
		for (const o of orphans) out.push(`  ${o}`);
	}
	out.push('');

	out.push('Provenance — multi-override rows (debug):');
	const multi = rows.filter((r) => r.provenance.applied_overrides.length > 1).slice(0, 10);
	for (const r of multi) {
		out.push(
			`  src_row=${r.src_row} title="${(r.title ?? '').slice(0, 50)}" overrides=${r.provenance.applied_overrides.join('; ')}`
		);
	}
	out.push('');
	out.push('=== end report ===');
	return out.join('\n');
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

function main(): void {
	mkdirSync(DATA_DIR, { recursive: true });
	const { rows, report } = build();
	writeFileSync(ROWS_JSON, JSON.stringify(rows, null, 2));
	writeFileSync(ROWS_REPORT, report);
	console.log(report);
	console.log(`\nWrote ${rows.length} rows → ${ROWS_JSON}`);
	console.log(`Wrote report → ${ROWS_REPORT}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

export { build };
