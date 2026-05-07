import type { SupabaseClient } from '@supabase/supabase-js';
import type { Language } from '$lib/types/library';
import { titleSortKey } from '$lib/library/title-sort';
import {
	applyBookPayload,
	ensureNoIsbnCollision,
	parseBookForm,
	type BookFormPayload
} from '$lib/library/server/book-actions';
import {
	loadCategories,
	loadPeople,
	loadSeries,
	personDisplayShort
} from '$lib/library/server/loaders';
import type { CategoryRow, SeriesRow } from '$lib/types/library';

/** Max data rows per preview/apply (excluding header). */
export const LIBRARY_CSV_MAX_ROWS = 1000;

/**
 * CSV rows whose `needs_review_note` starts with one of these prefixes are
 * soft-deleted on apply (by `id`). No genre/series validation for those rows.
 * Supports em dash (—) or ASCII hyphen (-) after "IMPORT".
 */
export const LIBRARY_CSV_DELETE_ON_IMPORT_PREFIXES = [
	'\u26A0 DELETE ON IMPORT — collapse with sibling row.',
	'\u26A0 DELETE ON IMPORT - collapse with sibling row.'
] as const;

export function isDeleteOnImportNote(note: string): boolean {
	const t = note.trimStart();
	return LIBRARY_CSV_DELETE_ON_IMPORT_PREFIXES.some((p) => t.startsWith(p));
}

/** Stable export column order (lowercase header names). */
export const LIBRARY_CSV_HEADER_ROW = [
	'id',
	'title',
	'subtitle',
	'authors',
	'authors_json',
	'genre',
	'primary_category',
	'series',
	'volume_number',
	'publisher',
	'year',
	'edition',
	'reading_status',
	'needs_review',
	'needs_review_note',
	'personal_notes',
	'isbn',
	'language'
] as const;

export type LibraryCsvPreviewError = { line: number; message: string };

export type PreparedCsvOperation =
	| { kind: 'insert'; line: number; payload: BookFormPayload }
	| {
			kind: 'update';
			line: number;
			bookId: string;
			payload: BookFormPayload;
			skipAuthorSync: boolean;
	  }
	| { kind: 'softDelete'; line: number; bookId: string };

function stripBom(text: string): string {
	return text.replace(/^\uFEFF/, '');
}

/** RFC 4180: quoted fields may contain commas and newlines. */
export function parseCsvRows(text: string): string[][] {
	const t = stripBom(text);
	if (t.length === 0) return [];
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;
	for (let i = 0; i < t.length; i++) {
		const c = t[i] ?? '';
		if (inQuotes) {
			if (c === '"') {
				const next = t[i + 1];
				if (next === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += c;
			}
		} else if (c === '"') {
			inQuotes = true;
		} else if (c === ',') {
			row.push(field);
			field = '';
		} else if (c === '\r') {
			const next = t[i + 1];
			if (next === '\n') {
				row.push(field);
				field = '';
				rows.push(row);
				row = [];
				i++;
			} else {
				field += c;
			}
		} else if (c === '\n') {
			row.push(field);
			field = '';
			rows.push(row);
			row = [];
		} else {
			field += c;
		}
	}
	row.push(field);
	rows.push(row);
	while (rows.length > 0 && rows[rows.length - 1].every((cell) => cell.trim() === '')) {
		rows.pop();
	}
	return rows;
}

function escapeCsvCell(value: string): string {
	if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
	return value;
}

export function buildCsvFromRows(
	headers: readonly string[],
	data: Record<string, string>[]
): string {
	const lines: string[] = [];
	lines.push(headers.map(escapeCsvCell).join(','));
	for (const row of data) {
		lines.push(headers.map((h) => escapeCsvCell(row[h] ?? '')).join(','));
	}
	return `${lines.join('\n')}\n`;
}

function csvRowsToObjects(rows: string[][]): {
	headers: string[];
	dataRows: Record<string, string>[];
} {
	if (rows.length === 0) return { headers: [], dataRows: [] };
	const headers = rows[0].map((h) => h.trim().toLowerCase());
	const dataRows: Record<string, string>[] = [];
	for (let r = 1; r < rows.length; r++) {
		const cells = rows[r];
		if (cells.every((c) => c.trim() === '')) continue;
		const obj: Record<string, string> = {};
		for (let c = 0; c < headers.length; c++) {
			obj[headers[c]] = cells[c] ?? '';
		}
		dataRows.push(obj);
	}
	return { headers, dataRows };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cell(row: Record<string, string>, key: string): string {
	return row[key] ?? '';
}

function parseBoolCsv(raw: string): boolean {
	const t = raw.trim().toLowerCase();
	return t === 'true' || t === '1' || t === 'yes' || t === 'y' || t === 'on';
}

function buildCategoryNameResolver(categories: CategoryRow[]): {
	resolve(trimmedName: string): { ok: true; id: string | null } | { ok: false; message: string };
} {
	const byLower = new Map<string, string[]>();
	for (const c of categories) {
		const k = c.name.trim().toLowerCase();
		const arr = byLower.get(k) ?? [];
		arr.push(c.id);
		byLower.set(k, arr);
	}
	return {
		resolve(trimmedName: string) {
			const t = trimmedName.trim();
			if (t.length === 0) return { ok: true, id: null };
			const k = t.toLowerCase();
			const ids = byLower.get(k);
			if (!ids || ids.length === 0) {
				return { ok: false, message: `Unknown category name "${t}"` };
			}
			if (ids.length > 1) {
				return {
					ok: false,
					message: `Ambiguous category name "${t}" (${ids.length} matches)`
				};
			}
			return { ok: true, id: ids[0] };
		}
	};
}

function buildSeriesLabelResolver(series: SeriesRow[]): {
	resolve(label: string): { ok: true; id: string | null } | { ok: false; message: string };
} {
	const byAbbrevLower = new Map<string, SeriesRow[]>();
	const byNameLower = new Map<string, SeriesRow[]>();
	for (const s of series) {
		const ab = (s.abbreviation ?? '').trim();
		if (ab.length > 0) {
			const k = ab.toLowerCase();
			const arr = byAbbrevLower.get(k) ?? [];
			arr.push(s);
			byAbbrevLower.set(k, arr);
		}
		const nk = s.name.trim().toLowerCase();
		const na = byNameLower.get(nk) ?? [];
		na.push(s);
		byNameLower.set(nk, na);
	}
	return {
		resolve(label: string) {
			const t = label.trim();
			if (t.length === 0) return { ok: true, id: null };
			const tl = t.toLowerCase();
			const abHits = byAbbrevLower.get(tl);
			if (abHits && abHits.length === 1) return { ok: true, id: abHits[0].id };
			if (abHits && abHits.length > 1) {
				return { ok: false, message: `Ambiguous series abbreviation "${t}"` };
			}
			const nameHits = byNameLower.get(tl);
			if (nameHits && nameHits.length === 1) return { ok: true, id: nameHits[0].id };
			if (nameHits && nameHits.length > 1) {
				return { ok: false, message: `Ambiguous series name "${t}"` };
			}
			return { ok: false, message: `Unknown series "${t}"` };
		}
	};
}

type RawExportBook = {
	id: string;
	title: string | null;
	subtitle: string | null;
	genre: string | null;
	language: string;
	reading_status: string;
	needs_review: boolean;
	needs_review_note: string | null;
	personal_notes: string | null;
	isbn: string | null;
	publisher: string | null;
	year: number | null;
	edition: string | null;
	volume_number: string | null;
	primary_category: { id: string; name: string } | { id: string; name: string }[] | null;
	series:
		| { id: string; name: string; abbreviation: string | null }
		| { id: string; name: string; abbreviation: string | null }[]
		| null;
	book_authors: { person_id: string; role: string; sort_order: number }[] | null;
};

function asArrayOrSingle<T>(v: T | T[] | null | undefined): T[] {
	if (v == null) return [];
	return Array.isArray(v) ? v : [v];
}

async function paginateAllExportBooks(supabase: SupabaseClient): Promise<RawExportBook[]> {
	const out: RawExportBook[] = [];
	const PAGE = 1000;
	let from = 0;
	while (true) {
		const { data, error } = await supabase
			.from('books')
			.select(
				`
				id,
				title,
				subtitle,
				genre,
				language,
				reading_status,
				needs_review,
				needs_review_note,
				personal_notes,
				isbn,
				publisher,
				year,
				edition,
				volume_number,
				primary_category:categories!books_primary_category_id_fkey ( id, name ),
				series ( id, name, abbreviation ),
				book_authors ( person_id, role, sort_order )
			`
			)
			.is('deleted_at', null)
			.range(from, from + PAGE - 1);
		if (error) {
			console.error('[paginateAllExportBooks]', error);
			break;
		}
		const batch = (data ?? []) as RawExportBook[];
		out.push(...batch);
		if (batch.length < PAGE) break;
		from += PAGE;
	}
	return out;
}

/** UTF-8 CSV of all live books (owner export). */
export async function buildLibraryBooksCsv(supabase: SupabaseClient): Promise<string> {
	const people = await loadPeople(supabase);
	const peopleMap = new Map(people.map((p) => [p.id, p]));
	const raw = await paginateAllExportBooks(supabase);
	raw.sort((a, b) => {
		const la = titleSortKey(a.title, (a.language as Language) ?? 'english');
		const lb = titleSortKey(b.title, (b.language as Language) ?? 'english');
		const c = la.localeCompare(lb);
		if (c !== 0) return c;
		return a.id.localeCompare(b.id);
	});

	const rows: Record<string, string>[] = [];
	for (const r of raw) {
		const authorRows = (r.book_authors ?? []).slice().sort((x, y) => x.sort_order - y.sort_order);
		const authorOnly = authorRows.filter((a) => a.role === 'author');
		const authorLabels = authorOnly
			.map((a) => {
				const p = peopleMap.get(a.person_id);
				return p ? personDisplayShort(p) : null;
			})
			.filter((s): s is string => s != null);
		const authorsDisplay = authorLabels.join(', ');
		const authorsJson = JSON.stringify(
			authorRows.map((a) => ({
				person_id: a.person_id,
				role: a.role,
				sort_order: a.sort_order
			}))
		);
		const cat = asArrayOrSingle(r.primary_category)[0];
		const ser = asArrayOrSingle(r.series)[0];
		const seriesCell =
			ser?.abbreviation != null && String(ser.abbreviation).trim().length > 0
				? String(ser.abbreviation).trim()
				: (ser?.name ?? '');
		rows.push({
			id: r.id,
			title: r.title ?? '',
			subtitle: r.subtitle ?? '',
			authors: authorsDisplay,
			authors_json: authorsJson,
			genre: r.genre ?? '',
			primary_category: cat?.name ?? '',
			series: seriesCell,
			volume_number: r.volume_number ?? '',
			publisher: r.publisher ?? '',
			year: r.year != null ? String(r.year) : '',
			edition: r.edition ?? '',
			reading_status: r.reading_status ?? '',
			needs_review: r.needs_review ? 'true' : 'false',
			needs_review_note: r.needs_review_note ?? '',
			personal_notes: r.personal_notes ?? '',
			isbn: r.isbn ?? '',
			language: r.language ?? ''
		});
	}
	return buildCsvFromRows(LIBRARY_CSV_HEADER_ROW, rows);
}

async function loadCategoryIdsByBookId(
	supabase: SupabaseClient,
	bookIds: string[]
): Promise<Map<string, string[]>> {
	const map = new Map<string, string[]>();
	const CHUNK = 200;
	for (let i = 0; i < bookIds.length; i += CHUNK) {
		const slice = bookIds.slice(i, i + CHUNK);
		const { data, error } = await supabase
			.from('book_categories')
			.select('book_id, category_id')
			.in('book_id', slice);
		if (error) {
			console.error('[loadCategoryIdsByBookId]', error);
			continue;
		}
		for (const row of data ?? []) {
			const bid = row.book_id as string;
			const cid = row.category_id as string;
			const arr = map.get(bid) ?? [];
			arr.push(cid);
			map.set(bid, arr);
		}
	}
	return map;
}

async function loadAuthorsJsonByBookId(
	supabase: SupabaseClient,
	bookIds: string[]
): Promise<Map<string, string>> {
	const map = new Map<string, { person_id: string; role: string; sort_order: number }[]>();
	const CHUNK = 200;
	for (let i = 0; i < bookIds.length; i += CHUNK) {
		const slice = bookIds.slice(i, i + CHUNK);
		const { data, error } = await supabase
			.from('book_authors')
			.select('book_id, person_id, role, sort_order')
			.in('book_id', slice);
		if (error) {
			console.error('[loadAuthorsJsonByBookId]', error);
			continue;
		}
		for (const row of data ?? []) {
			const bid = row.book_id as string;
			const arr = map.get(bid) ?? [];
			arr.push({
				person_id: row.person_id as string,
				role: row.role as string,
				sort_order: Number(row.sort_order)
			});
			map.set(bid, arr);
		}
	}
	const jsonMap = new Map<string, string>();
	for (const [bid, arr] of map) {
		arr.sort((a, b) => a.sort_order - b.sort_order);
		jsonMap.set(bid, JSON.stringify(arr));
	}
	return jsonMap;
}

function mergeCategoryIdsForUpdate(
	existingJunctionIds: string[],
	newPrimaryId: string | null
): string[] {
	if (newPrimaryId != null) {
		const rest = existingJunctionIds.filter((id) => id !== newPrimaryId);
		return [newPrimaryId, ...rest];
	}
	return [...existingJunctionIds];
}

function csvRowToFormData(args: {
	row: Record<string, string>;
	mode: 'insert' | 'update';
	bookId?: string;
	primaryCategoryId: string | null;
	categoryIds: string[];
	seriesId: string | null;
	authorsJson: string;
}): FormData {
	const fd = new FormData();
	if (args.mode === 'update' && args.bookId) fd.set('id', args.bookId);
	fd.set('title', cell(args.row, 'title'));
	fd.set('subtitle', cell(args.row, 'subtitle'));
	fd.set('genre', cell(args.row, 'genre'));
	const lang = cell(args.row, 'language').trim();
	fd.set('language', lang.length > 0 ? lang : 'english');
	const rs = cell(args.row, 'reading_status').trim();
	fd.set('reading_status', rs.length > 0 ? rs : 'unread');
	fd.set('needs_review', parseBoolCsv(cell(args.row, 'needs_review')) ? 'true' : 'false');
	fd.set('needs_review_note', cell(args.row, 'needs_review_note'));
	fd.set('personal_notes', cell(args.row, 'personal_notes'));
	fd.set('isbn', cell(args.row, 'isbn'));
	fd.set('publisher', cell(args.row, 'publisher'));
	fd.set('year', cell(args.row, 'year'));
	fd.set('edition', cell(args.row, 'edition'));
	fd.set('volume_number', cell(args.row, 'volume_number'));
	fd.set('primary_category_id', args.primaryCategoryId ?? '');
	for (const cid of args.categoryIds) {
		fd.append('category_ids', cid);
	}
	fd.set('series_id', args.seriesId ?? '');
	fd.set('authors_json', args.authorsJson);
	fd.set('publisher_location', '');
	fd.set('total_volumes', '');
	fd.set('original_year', '');
	fd.set('reprint_publisher', '');
	fd.set('reprint_location', '');
	fd.set('reprint_year', '');
	fd.set('barcode', '');
	fd.set('shelving_location', '');
	fd.set('borrowed_to', '');
	fd.set('page_count', '');
	fd.set('rating', '');
	return fd;
}

export type PrepareLibraryCsvResult =
	| { ok: true; prepared: PreparedCsvOperation[] }
	| { ok: false; errors: LibraryCsvPreviewError[] };

/**
 * Parse + validate every data row. Returns structured ops for preview counts
 * and apply (re-parse on apply is mandatory — do not trust client payloads).
 */
export async function prepareLibraryCsvImport(
	supabase: SupabaseClient,
	csvText: string
): Promise<PrepareLibraryCsvResult> {
	const errors: LibraryCsvPreviewError[] = [];
	const matrix = parseCsvRows(csvText);
	const { headers, dataRows } = csvRowsToObjects(matrix);

	if (!headers.includes('id')) {
		return {
			ok: false,
			errors: [
				{
					line: 1,
					message: 'CSV header row must include an "id" column (may be blank for new books).'
				}
			]
		};
	}

	if (dataRows.length > LIBRARY_CSV_MAX_ROWS) {
		return {
			ok: false,
			errors: [
				{
					line: 0,
					message: `Too many rows (${dataRows.length}). Maximum is ${LIBRARY_CSV_MAX_ROWS}.`
				}
			]
		};
	}

	const [categories, seriesList] = await Promise.all([
		loadCategories(supabase),
		loadSeries(supabase)
	]);
	const catResolve = buildCategoryNameResolver(categories);
	const serResolve = buildSeriesLabelResolver(seriesList);

	const updateIds: string[] = [];
	for (let i = 0; i < dataRows.length; i++) {
		const idRaw = cell(dataRows[i], 'id').trim();
		if (idRaw.length > 0 && UUID_RE.test(idRaw)) updateIds.push(idRaw);
	}

	const uniqueUpdateIds = [...new Set(updateIds)];
	const existingIds = new Set<string>();
	if (uniqueUpdateIds.length > 0) {
		const CHUNK = 200;
		for (let i = 0; i < uniqueUpdateIds.length; i += CHUNK) {
			const slice = uniqueUpdateIds.slice(i, i + CHUNK);
			const { data: existingRows, error: exErr } = await supabase
				.from('books')
				.select('id')
				.in('id', slice)
				.is('deleted_at', null);
			if (exErr) {
				console.error(exErr);
				return {
					ok: false,
					errors: [{ line: 0, message: exErr.message ?? 'Could not validate book ids.' }]
				};
			}
			for (const row of existingRows ?? []) {
				existingIds.add(row.id as string);
			}
		}
	}

	const categoryByBook = await loadCategoryIdsByBookId(supabase, uniqueUpdateIds);
	const authorsJsonByBook = await loadAuthorsJsonByBookId(supabase, uniqueUpdateIds);

	const prepared: PreparedCsvOperation[] = [];

	for (let i = 0; i < dataRows.length; i++) {
		const line = i + 2;
		const row = dataRows[i];
		const idRaw = cell(row, 'id').trim();
		const isInsert = idRaw.length === 0;

		if (!isInsert && !UUID_RE.test(idRaw)) {
			errors.push({ line, message: `Invalid book id "${idRaw}"` });
			continue;
		}

		if (!isInsert && !existingIds.has(idRaw)) {
			errors.push({ line, message: `Book not found for id ${idRaw}` });
			continue;
		}

		if (isDeleteOnImportNote(cell(row, 'needs_review_note'))) {
			if (isInsert) {
				errors.push({
					line,
					message: 'DELETE ON IMPORT note requires an existing book id (non-blank id column).'
				});
				continue;
			}
			prepared.push({ kind: 'softDelete', line, bookId: idRaw });
			continue;
		}

		const primaryName = cell(row, 'primary_category');
		const pr = catResolve.resolve(primaryName);
		if (!pr.ok) {
			errors.push({ line, message: pr.message });
			continue;
		}

		const seriesLabel = cell(row, 'series');
		const sr = serResolve.resolve(seriesLabel);
		if (!sr.ok) {
			errors.push({ line, message: sr.message });
			continue;
		}

		let categoryIds: string[];
		if (isInsert) {
			categoryIds = pr.id != null ? [pr.id] : [];
		} else {
			const existing = categoryByBook.get(idRaw) ?? [];
			categoryIds = mergeCategoryIdsForUpdate(existing, pr.id);
		}

		const authorsJsonCell = cell(row, 'authors_json').trim();
		const skipAuthorSync = !isInsert && authorsJsonCell.length === 0;
		const authorsJson = skipAuthorSync ? (authorsJsonByBook.get(idRaw) ?? '[]') : authorsJsonCell;

		const fd = csvRowToFormData({
			row,
			mode: isInsert ? 'insert' : 'update',
			bookId: isInsert ? undefined : idRaw,
			primaryCategoryId: pr.id,
			categoryIds,
			seriesId: sr.id,
			authorsJson
		});

		const parsed = parseBookForm(fd);
		if (!parsed.ok) {
			errors.push({ line, message: parsed.message });
			continue;
		}

		const isbnCheck = await ensureNoIsbnCollision(
			supabase,
			parsed.payload.isbn,
			isInsert ? null : idRaw
		);
		if (!isbnCheck.ok) {
			errors.push({ line, message: isbnCheck.message });
			continue;
		}

		if (isInsert) {
			prepared.push({ kind: 'insert', line, payload: parsed.payload });
		} else {
			prepared.push({
				kind: 'update',
				line,
				bookId: idRaw,
				payload: parsed.payload,
				skipAuthorSync
			});
		}
	}

	if (errors.length > 0) return { ok: false, errors };
	return { ok: true, prepared };
}

export type LibraryCsvApplySummary = {
	inserted: number;
	updated: number;
	deleted: number;
	errors: LibraryCsvPreviewError[];
};

/** Apply prepared ops sequentially (chunk-friendly for timeouts). */
export async function applyPreparedLibraryCsv(
	supabase: SupabaseClient,
	_userId: string,
	prepared: PreparedCsvOperation[]
): Promise<LibraryCsvApplySummary> {
	const errors: LibraryCsvPreviewError[] = [];
	let inserted = 0;
	let updated = 0;
	let deleted = 0;

	for (const op of prepared) {
		if (op.kind === 'insert') {
			const r = await applyBookPayload(supabase, _userId, { mode: 'create', payload: op.payload });
			if (!r.ok) {
				errors.push({ line: op.line, message: r.message });
				break;
			}
			inserted++;
		} else if (op.kind === 'update') {
			const r = await applyBookPayload(supabase, _userId, {
				mode: 'update',
				bookId: op.bookId,
				payload: op.payload,
				options: { skipAuthorSync: op.skipAuthorSync }
			});
			if (!r.ok) {
				errors.push({ line: op.line, message: r.message });
				break;
			}
			updated++;
		} else {
			const { error } = await supabase
				.from('books')
				.update({ deleted_at: new Date().toISOString() })
				.eq('id', op.bookId)
				.is('deleted_at', null);
			if (error) {
				errors.push({ line: op.line, message: error.message ?? 'Soft-delete failed.' });
				break;
			}
			deleted++;
		}
	}

	return { inserted, updated, deleted, errors };
}
