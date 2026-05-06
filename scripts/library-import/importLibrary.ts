/**
 * Pass 1 / Pass 2 importer — reads `data/rows.json` and reconciles against
 * the prod `books` table. Decision-007 reconcilable model.
 *
 * Run:
 *   npx tsx scripts/library-import/importLibrary.ts            # dry-run (default)
 *   npx tsx scripts/library-import/importLibrary.ts --apply    # writes
 *   npx tsx scripts/library-import/importLibrary.ts --apply --limit 1   # one-row smoke
 *
 * Required env (loaded from .env / .env.local):
 *   PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (NEW — add to .env.local; never commit)
 *   POS_OWNER_ID               (NEW — UUID of the owner profile, used for
 *                                created_by stamping + audit attribution)
 *
 * Produces:
 *   data/library_import_diff.txt    — per-row INSERT / UPDATE / NO-OP / ORPHAN
 *   data/library_import_orphans.csv — books in DB but not in rows.json
 *
 * Match strategy (locked, decision 007):
 *   1. books.isbn = csv.isbn
 *   2. books.barcode = csv.barcode
 *   3. normalized (title, first-author last_name)
 *   4. no match → INSERT
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { findOrCreatePerson } from '../../src/lib/library/server/people-actions.ts';
import { stripArticlesForImporterMatchKey } from '../../src/lib/library/title-sort.ts';
import { SPREADSHEET_OWNED_FIELDS, pickSpreadsheetOwned } from './SPREADSHEET_OWNED_FIELDS.ts';
import type { ImportRow, ImportAuthor } from './buildImportRows.ts';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, 'data');
const ROOT = resolve(HERE, '../..');
const ROWS_JSON = resolve(DATA_DIR, 'rows.json');
const DIFF_TXT = resolve(DATA_DIR, 'library_import_diff.txt');
const ORPHANS_CSV = resolve(DATA_DIR, 'library_import_orphans.csv');

dotenvConfig({ path: resolve(ROOT, '.env') });
dotenvConfig({ path: resolve(ROOT, '.env.local'), override: true });

const APPLY = process.argv.includes('--apply');
const LIMIT_ARG = process.argv.indexOf('--limit');
const LIMIT = LIMIT_ARG > 0 ? parseInt(process.argv[LIMIT_ARG + 1], 10) : null;

function requireEnv(name: string): string {
	const v = process.env[name];
	if (!v) {
		console.error(`\nMissing required env: ${name}`);
		console.error(`Add to .env.local. SUPABASE_SERVICE_ROLE_KEY is at:`);
		console.error(`  https://supabase.com/dashboard/project/${process.env.SUPABASE_REF}/settings/api-keys`);
		console.error(`POS_OWNER_ID is the auth.users.id of your owner profile (SELECT id FROM auth.users WHERE email = '<your email>').`);
		process.exit(2);
	}
	return v;
}

const SUPABASE_URL = requireEnv('PUBLIC_SUPABASE_URL');
const SERVICE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const OWNER_ID = requireEnv('POS_OWNER_ID');

// Service role client. RLS bypass; auth.uid() returns NULL by default
// (which means audit_log.changed_by = NULL — we patch this post-apply per
// decision-007 fallback). The trigger reads auth.uid() at INSERT time;
// there's no reliable way to set it from a service-role client without
// using the supabase-js auth.setAuth() (which requires a user JWT).
const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
	auth: { persistSession: false, autoRefreshToken: false }
});

// ---------------------------------------------------------------------------
// Types — matches what the existing books table accepts
// ---------------------------------------------------------------------------

type DbBook = {
	id: string;
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
	primary_category_id: string | null;
	series_id: string | null;
	volume_number: string | null;
	genre: string | null;
	language: string;
	isbn: string | null;
	barcode: string | null;
	page_count: number | null;
	needs_review: boolean;
	needs_review_note: string | null;
	personal_notes: string | null;
	reading_status: string;
	borrowed_to: string | null;
	deleted_at: string | null;
	created_by: string | null;
};

type DbAuthor = { person_id: string; role: string; sort_order: number };

type Decision =
	| { kind: 'INSERT'; row: ImportRow; reason: string }
	| {
			kind: 'UPDATE';
			row: ImportRow;
			existing: DbBook;
			fieldDiffs: { field: string; from: unknown; to: unknown }[];
	  }
	| { kind: 'NO-OP'; row: ImportRow; existing: DbBook }
	| { kind: 'AMBIGUOUS'; row: ImportRow; candidates: DbBook[]; reason: string };

// ---------------------------------------------------------------------------
// Lookups + caches
// ---------------------------------------------------------------------------

const categorySlugToId = new Map<string, string>();
const seriesByKey = new Map<string, string>(); // normalized name OR abbreviation → series.id
const personCache = new Map<string, string>(); // last+first+middle key → person_id

function normalizeKey(s: string | null | undefined): string {
	if (!s) return '';
	return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

async function loadCategorySlugs(): Promise<void> {
	const { data, error } = await supabase.from('categories').select('id, slug');
	if (error) throw error;
	for (const c of data ?? []) categorySlugToId.set((c as { slug: string }).slug, (c as { id: string }).id);
}

async function loadSeries(): Promise<void> {
	const { data, error } = await supabase
		.from('series')
		.select('id, name, abbreviation')
		.is('deleted_at', null);
	if (error) throw error;
	for (const s of data ?? []) {
		const r = s as { id: string; name: string | null; abbreviation: string | null };
		if (r.name) seriesByKey.set(normalizeKey(r.name), r.id);
		if (r.abbreviation) seriesByKey.set(normalizeKey(r.abbreviation), r.id);
	}
}

async function findOrCreateSeries(abbrev: string): Promise<string> {
	const key = normalizeKey(abbrev);
	if (seriesByKey.has(key)) return seriesByKey.get(key)!;
	if (!APPLY) {
		// Dry-run: synthesize a placeholder id so the diff still shows
		// "would create series X". Real id comes at apply time.
		return `__DRY_NEW_SERIES__${abbrev}`;
	}
	const { data, error } = await supabase
		.from('series')
		.insert({ name: abbrev, abbreviation: abbrev, created_by: OWNER_ID } as never)
		.select('id')
		.single();
	if (error || !data) throw error ?? new Error('series insert returned no row');
	const id = (data as { id: string }).id;
	seriesByKey.set(key, id);
	return id;
}

async function findOrCreatePersonCached(a: ImportAuthor): Promise<string> {
	const key = `${normalizeKey(a.last_name)}|${normalizeKey(a.first_name)}|${normalizeKey(a.middle_name)}`;
	if (personCache.has(key)) return personCache.get(key)!;
	if (!APPLY) {
		// Dry-run: don't touch DB.
		const placeholder = `__DRY_PERSON__${key}`;
		personCache.set(key, placeholder);
		return placeholder;
	}
	const result = await findOrCreatePerson(
		supabase,
		{
			last_name: a.last_name,
			first_name: a.first_name ?? undefined,
			middle_name: a.middle_name ?? undefined,
			suffix: a.suffix ?? undefined
		},
		OWNER_ID
	);
	personCache.set(key, result.personId);
	return result.personId;
}

// ---------------------------------------------------------------------------
// Match strategy
// ---------------------------------------------------------------------------

async function loadAllBooks(): Promise<DbBook[]> {
	const all: DbBook[] = [];
	let from = 0;
	const PAGE = 1000;
	while (true) {
		const { data, error } = await supabase
			.from('books')
			.select(
				'id, title, subtitle, publisher, publisher_location, year, edition, total_volumes, original_year, reprint_publisher, reprint_location, reprint_year, primary_category_id, series_id, volume_number, genre, language, isbn, barcode, page_count, needs_review, needs_review_note, personal_notes, reading_status, borrowed_to, deleted_at, created_by'
			)
			.range(from, from + PAGE - 1);
		if (error) throw error;
		const batch = (data ?? []) as DbBook[];
		all.push(...batch);
		if (batch.length < PAGE) break;
		from += PAGE;
	}
	return all;
}

async function loadAuthorsForBooks(bookIds: string[]): Promise<Map<string, DbAuthor[]>> {
	const map = new Map<string, DbAuthor[]>();
	if (bookIds.length === 0) return map;
	const PAGE = 500;
	for (let i = 0; i < bookIds.length; i += PAGE) {
		const slice = bookIds.slice(i, i + PAGE);
		const { data, error } = await supabase
			.from('book_authors')
			.select('book_id, person_id, role, sort_order')
			.in('book_id', slice);
		if (error) throw error;
		for (const r of data ?? []) {
			const row = r as { book_id: string; person_id: string; role: string; sort_order: number };
			if (!map.has(row.book_id)) map.set(row.book_id, []);
			map.get(row.book_id)!.push({ person_id: row.person_id, role: row.role, sort_order: row.sort_order });
		}
	}
	return map;
}

function normalizeTitleForMatch(title: string | null): string {
	if (!title) return '';
	const lowered = title
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();
	return stripArticlesForImporterMatchKey(lowered)
		.replace(/\s*\([^)]*\)\s*/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

type MatchIndex = {
	byIsbn: Map<string, DbBook>;
	byBarcode: Map<string, DbBook>;
	byTitleAuthor: Map<string, DbBook[]>; // can have collisions
};

async function buildMatchIndex(allBooks: DbBook[]): Promise<MatchIndex> {
	const byIsbn = new Map<string, DbBook>();
	const byBarcode = new Map<string, DbBook>();
	const byTitleAuthor = new Map<string, DbBook[]>();

	const live = allBooks.filter((b) => b.deleted_at === null);
	const authorsMap = await loadAuthorsForBooks(live.map((b) => b.id));
	const personIds = new Set<string>();
	for (const arr of authorsMap.values()) for (const a of arr) personIds.add(a.person_id);

	const personById = new Map<string, { last_name: string }>();
	if (personIds.size > 0) {
		const ids = Array.from(personIds);
		const PAGE = 500;
		for (let i = 0; i < ids.length; i += PAGE) {
			const slice = ids.slice(i, i + PAGE);
			const { data, error } = await supabase.from('people').select('id, last_name').in('id', slice);
			if (error) throw error;
			for (const p of data ?? []) {
				const row = p as { id: string; last_name: string };
				personById.set(row.id, { last_name: row.last_name });
			}
		}
	}

	for (const b of live) {
		if (b.isbn) byIsbn.set(b.isbn, b);
		if (b.barcode) byBarcode.set(b.barcode, b);
		const titleKey = normalizeTitleForMatch(b.title);
		const authors = (authorsMap.get(b.id) ?? []).slice().sort((x, y) => x.sort_order - y.sort_order);
		const firstAuthor = authors[0];
		const firstAuthorLast = firstAuthor ? personById.get(firstAuthor.person_id)?.last_name ?? '' : '';
		const k = `${titleKey}|${normalizeKey(firstAuthorLast)}`;
		if (!byTitleAuthor.has(k)) byTitleAuthor.set(k, []);
		byTitleAuthor.get(k)!.push(b);
	}
	return { byIsbn, byBarcode, byTitleAuthor };
}

function matchRow(row: ImportRow, idx: MatchIndex): { match: DbBook | null; ambiguous?: DbBook[]; reason: string } {
	if (row.isbn && idx.byIsbn.has(row.isbn)) {
		return { match: idx.byIsbn.get(row.isbn)!, reason: `ISBN ${row.isbn}` };
	}
	if (row.barcode && idx.byBarcode.has(row.barcode)) {
		return { match: idx.byBarcode.get(row.barcode)!, reason: `barcode ${row.barcode}` };
	}
	const titleKey = normalizeTitleForMatch(row.title);
	const firstAuthor = row.authors[0];
	const k = `${titleKey}|${normalizeKey(firstAuthor?.last_name ?? '')}`;
	const candidates = idx.byTitleAuthor.get(k) ?? [];
	if (candidates.length === 1) return { match: candidates[0], reason: `title+author "${titleKey}"` };
	if (candidates.length > 1) {
		return { match: null, ambiguous: candidates, reason: `title+author "${titleKey}" matched ${candidates.length} books` };
	}
	return { match: null, reason: 'no match → INSERT' };
}

// ---------------------------------------------------------------------------
// Build the row-payload for INSERT / UPDATE
// ---------------------------------------------------------------------------

async function rowToBookPayload(row: ImportRow): Promise<Record<string, unknown>> {
	let series_id: string | null = null;
	if (row.series_abbrev) series_id = await findOrCreateSeries(row.series_abbrev);

	const primary_category_id = row.primary_category_slug
		? categorySlugToId.get(row.primary_category_slug) ?? null
		: null;

	return {
		title: row.title,
		subtitle: row.subtitle,
		publisher: row.publisher,
		publisher_location: row.publisher_location,
		year: row.year,
		edition: row.edition,
		total_volumes: row.total_volumes,
		original_year: row.original_year,
		reprint_publisher: row.reprint_publisher,
		reprint_location: row.reprint_location,
		reprint_year: row.reprint_year,
		series_id,
		volume_number: row.volume_number,
		genre: row.genre,
		language: row.language,
		isbn: row.isbn,
		barcode: row.barcode,
		page_count: row.page_count,
		primary_category_id,
		needs_review: row.needs_review,
		needs_review_note: row.needs_review_note,
		// Pass 1-only on INSERT (handled below)
		reading_status: row.reading_status,
		borrowed_to: row.borrowed_to,
		personal_notes: row.personal_notes,
		shelving_location: row.shelving_location,
		// System
		created_by: OWNER_ID
	};
}

function diffSpreadsheetFields(existing: DbBook, payload: Record<string, unknown>): { field: string; from: unknown; to: unknown }[] {
	const diffs: { field: string; from: unknown; to: unknown }[] = [];
	for (const f of SPREADSHEET_OWNED_FIELDS) {
		const a = (existing as unknown as Record<string, unknown>)[f] ?? null;
		const b = payload[f] ?? null;
		if (a === b) continue;
		// ISBN/barcode: never NULL out an existing value (decision 007 guard)
		if ((f === 'isbn' || f === 'barcode') && a !== null && b === null) continue;
		diffs.push({ field: f, from: a, to: b });
	}
	return diffs;
}

// ---------------------------------------------------------------------------
// Junction sync (mirrors syncAuthors / syncCategories from book-actions.ts)
// ---------------------------------------------------------------------------

async function syncAuthors(bookId: string, desired: ImportAuthor[]): Promise<void> {
	if (!APPLY) return;
	// Resolve person_ids first
	const desiredResolved: { person_id: string; role: string; sort_order: number }[] = [];
	for (const a of desired) {
		const person_id = await findOrCreatePersonCached(a);
		desiredResolved.push({ person_id, role: a.role, sort_order: a.sort_order });
	}
	const { data: existing, error: fetchErr } = await supabase
		.from('book_authors')
		.select('person_id, role, sort_order')
		.eq('book_id', bookId);
	if (fetchErr) throw fetchErr;
	const currentMap = new Map<string, { sort_order: number }>();
	for (const r of existing ?? []) {
		const row = r as { person_id: string; role: string; sort_order: number };
		currentMap.set(`${row.person_id}|${row.role}`, { sort_order: row.sort_order });
	}
	const desiredMap = new Map<string, (typeof desiredResolved)[number]>();
	for (const a of desiredResolved) desiredMap.set(`${a.person_id}|${a.role}`, a);

	const toInsert: typeof desiredResolved = [];
	const toUpdate: typeof desiredResolved = [];
	for (const [k, a] of desiredMap) {
		const c = currentMap.get(k);
		if (!c) toInsert.push(a);
		else if (c.sort_order !== a.sort_order) toUpdate.push(a);
	}
	const toDelete: { person_id: string; role: string }[] = [];
	for (const [k] of currentMap) {
		if (!desiredMap.has(k)) {
			const [person_id, role] = k.split('|');
			toDelete.push({ person_id, role });
		}
	}
	for (const d of toDelete) {
		const { error } = await supabase
			.from('book_authors')
			.delete()
			.eq('book_id', bookId)
			.eq('person_id', d.person_id)
			.eq('role', d.role);
		if (error) throw error;
	}
	for (const u of toUpdate) {
		const { error } = await supabase
			.from('book_authors')
			.update({ sort_order: u.sort_order })
			.eq('book_id', bookId)
			.eq('person_id', u.person_id)
			.eq('role', u.role);
		if (error) throw error;
	}
	if (toInsert.length > 0) {
		const rows = toInsert.map((a) => ({
			book_id: bookId,
			person_id: a.person_id,
			role: a.role,
			sort_order: a.sort_order
		}));
		const { error } = await supabase.from('book_authors').insert(rows as never);
		if (error) throw error;
	}
}

async function syncCategoriesJunction(bookId: string, desiredCategoryIds: string[]): Promise<void> {
	if (!APPLY) return;
	const { data: existing, error: fetchErr } = await supabase
		.from('book_categories')
		.select('category_id')
		.eq('book_id', bookId);
	if (fetchErr) throw fetchErr;
	const currentIds = new Set((existing ?? []).map((r) => (r as { category_id: string }).category_id));
	const desiredSet = new Set(desiredCategoryIds);
	const toInsert = desiredCategoryIds.filter((id) => !currentIds.has(id));
	const toDelete = [...currentIds].filter((id) => !desiredSet.has(id));
	if (toDelete.length > 0) {
		const { error } = await supabase
			.from('book_categories')
			.delete()
			.eq('book_id', bookId)
			.in('category_id', toDelete);
		if (error) throw error;
	}
	if (toInsert.length > 0) {
		const rows = toInsert.map((category_id) => ({ book_id: bookId, category_id }));
		const { error } = await supabase.from('book_categories').insert(rows as never);
		if (error) throw error;
	}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	console.log(`Mode: ${APPLY ? 'APPLY (writes)' : 'DRY-RUN (no writes)'}`);
	if (LIMIT) console.log(`Limit: ${LIMIT} rows (smoke mode)`);
	console.log('');

	const rows: ImportRow[] = JSON.parse(readFileSync(ROWS_JSON, 'utf8'));
	const limited = LIMIT ? rows.slice(0, LIMIT) : rows;
	console.log(`Loaded ${limited.length} rows from rows.json`);

	console.log('Loading lookups…');
	await loadCategorySlugs();
	await loadSeries();
	console.log(`  ${categorySlugToId.size} categories, ${seriesByKey.size} series keys`);

	console.log('Loading existing books for match index…');
	const allBooks = await loadAllBooks();
	const idx = await buildMatchIndex(allBooks);
	console.log(
		`  ${allBooks.length} total books (${allBooks.filter((b) => b.deleted_at === null).length} live)`
	);
	console.log(`  ${idx.byIsbn.size} ISBNs, ${idx.byBarcode.size} barcodes, ${idx.byTitleAuthor.size} title+author keys`);

	// Decide
	const decisions: Decision[] = [];
	for (const row of limited) {
		const m = matchRow(row, idx);
		if (m.ambiguous) {
			decisions.push({
				kind: 'AMBIGUOUS',
				row,
				candidates: m.ambiguous,
				reason: m.reason
			});
			continue;
		}
		if (!m.match) {
			decisions.push({ kind: 'INSERT', row, reason: m.reason });
			continue;
		}
		const payload = await rowToBookPayload(row);
		const diffs = diffSpreadsheetFields(m.match, payload);
		if (diffs.length === 0) {
			decisions.push({ kind: 'NO-OP', row, existing: m.match });
		} else {
			decisions.push({ kind: 'UPDATE', row, existing: m.match, fieldDiffs: diffs });
		}
	}

	const inserts = decisions.filter((d) => d.kind === 'INSERT');
	const updates = decisions.filter((d) => d.kind === 'UPDATE');
	const noops = decisions.filter((d) => d.kind === 'NO-OP');
	const ambig = decisions.filter((d) => d.kind === 'AMBIGUOUS');

	// Orphans = live DB books not matched by any rows.json row
	const matchedDbIds = new Set<string>();
	for (const d of decisions) {
		if (d.kind === 'UPDATE' || d.kind === 'NO-OP') matchedDbIds.add(d.existing.id);
	}
	const orphans = allBooks.filter((b) => b.deleted_at === null && !matchedDbIds.has(b.id));

	// Write reports
	writeDiffReport(decisions, orphans);
	writeOrphansCsv(orphans, allBooks);
	console.log('');
	console.log(`Decisions:`);
	console.log(`  INSERT:    ${inserts.length}`);
	console.log(`  UPDATE:    ${updates.length}`);
	console.log(`  NO-OP:     ${noops.length}`);
	console.log(`  AMBIGUOUS: ${ambig.length}`);
	console.log(`  ORPHAN:    ${orphans.length}`);
	console.log('');
	console.log(`Diff report: ${DIFF_TXT}`);
	console.log(`Orphans CSV: ${ORPHANS_CSV}`);

	if (!APPLY) {
		console.log('\nDry-run complete. Re-run with --apply to write to prod.');
		return;
	}

	// APPLY phase
	console.log('\nAPPLY phase starting…');
	let inserted = 0;
	let updated = 0;
	for (let i = 0; i < decisions.length; i++) {
		const d = decisions[i];
		if (d.kind === 'INSERT') {
			const payload = await rowToBookPayload(d.row);
			const { data, error } = await supabase
				.from('books')
				.insert(payload as never)
				.select('id')
				.single();
			if (error || !data) {
				console.error(`INSERT failed for src_row=${d.row.src_row} title="${d.row.title}":`, error);
				throw error;
			}
			const bookId = (data as { id: string }).id;
			await syncAuthors(bookId, d.row.authors);
			const catIds: string[] = [];
			if (d.row.primary_category_slug) {
				const cid = categorySlugToId.get(d.row.primary_category_slug);
				if (cid) catIds.push(cid);
			}
			await syncCategoriesJunction(bookId, catIds);
			inserted++;
		} else if (d.kind === 'UPDATE') {
			const payload = await rowToBookPayload(d.row);
			const owned = pickSpreadsheetOwned(payload as never);
			const { error } = await supabase.from('books').update(owned as never).eq('id', d.existing.id);
			if (error) {
				console.error(`UPDATE failed for book ${d.existing.id}:`, error);
				throw error;
			}
			await syncAuthors(d.existing.id, d.row.authors);
			const catIds: string[] = [];
			if (d.row.primary_category_slug) {
				const cid = categorySlugToId.get(d.row.primary_category_slug);
				if (cid) catIds.push(cid);
			}
			await syncCategoriesJunction(d.existing.id, catIds);
			updated++;
		}
		if ((i + 1) % 50 === 0) {
			console.log(`  ${i + 1}/${decisions.length} (${inserted} inserted, ${updated} updated)`);
		}
	}
	console.log(`\nDone. ${inserted} INSERT, ${updated} UPDATE.`);
	console.log(`\nNext: in Studio, run UPDATE audit_log SET changed_by = '${OWNER_ID}' WHERE changed_by IS NULL AND changed_at >= '<this-session-start>'.`);
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

function writeDiffReport(decisions: Decision[], orphans: DbBook[]): void {
	const out: string[] = [];
	out.push('=== Library Pass 1/2 import diff ===');
	out.push(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
	out.push('');

	const byKind = (k: Decision['kind']) => decisions.filter((d) => d.kind === k);
	out.push(`INSERT: ${byKind('INSERT').length}`);
	out.push(`UPDATE: ${byKind('UPDATE').length}`);
	out.push(`NO-OP:  ${byKind('NO-OP').length}`);
	out.push(`AMBIGUOUS: ${byKind('AMBIGUOUS').length}`);
	out.push(`ORPHAN: ${orphans.length}`);
	out.push('');

	out.push('--- INSERT ---');
	for (const d of byKind('INSERT').slice(0, 200) as { kind: 'INSERT'; row: ImportRow; reason: string }[]) {
		out.push(`  src_row=${d.row.src_row} "${d.row.title ?? '(untitled)'}" — ${d.reason}`);
	}
	if (byKind('INSERT').length > 200) out.push(`  ... +${byKind('INSERT').length - 200} more`);
	out.push('');

	out.push('--- UPDATE ---');
	for (const d of byKind('UPDATE') as Extract<Decision, { kind: 'UPDATE' }>[]) {
		out.push(`  book ${d.existing.id} "${d.existing.title}" — ${d.fieldDiffs.length} fields`);
		for (const diff of d.fieldDiffs) {
			out.push(`    ${diff.field}: ${JSON.stringify(diff.from)} → ${JSON.stringify(diff.to)}`);
		}
	}
	out.push('');

	out.push('--- AMBIGUOUS (manual review) ---');
	for (const d of byKind('AMBIGUOUS') as Extract<Decision, { kind: 'AMBIGUOUS' }>[]) {
		out.push(`  src_row=${d.row.src_row} "${d.row.title}" — ${d.reason}`);
		for (const c of d.candidates) {
			out.push(`    candidate: book_id=${c.id} title="${c.title}"`);
		}
	}
	out.push('');

	out.push('--- ORPHAN (in DB, not in this CSV) ---');
	for (const o of orphans.slice(0, 200)) {
		out.push(`  book_id=${o.id} "${o.title}"`);
	}
	if (orphans.length > 200) out.push(`  ... +${orphans.length - 200} more`);

	writeFileSync(DIFF_TXT, out.join('\n'));
}

function writeOrphansCsv(orphans: DbBook[], _allBooks: DbBook[]): void {
	const lines: string[] = ['id,title,isbn,created_at_pass'];
	for (const o of orphans) {
		const t = (o.title ?? '').replace(/"/g, '""');
		lines.push(`${o.id},"${t}",${o.isbn ?? ''},pass1`);
	}
	writeFileSync(ORPHANS_CSV, lines.join('\n'));
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
