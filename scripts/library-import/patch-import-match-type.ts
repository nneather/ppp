/**
 * Backfill `books.import_match_type` from `data/enriched_library.csv`.
 *
 * Strategy mirrors the importer's match shape (decision 007):
 *   1. ISBN exact (when CSV row has one)
 *   2. Normalized (title, first-author last_name)
 *
 * Decision 008 Surprise #9: B1/B2 trigger blocks `personal_notes` /
 * `rating` UPDATEs under the service-role connection. The patch payload only
 * touches `import_match_type` so the trigger is irrelevant — but documenting
 * the constraint here so the next patch script doesn't trip it.
 *
 * Run:
 *   npx tsx scripts/library-import/patch-import-match-type.ts            # dry-run (default)
 *   npx tsx scripts/library-import/patch-import-match-type.ts --apply   # writes
 *
 * Required env (loaded from .env / .env.local):
 *   PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const ENRICHED_CSV = resolve(HERE, 'data/enriched_library.csv');

dotenvConfig({ path: resolve(ROOT, '.env') });
dotenvConfig({ path: resolve(ROOT, '.env.local'), override: true });

const APPLY = process.argv.includes('--apply');

function requireEnv(name: string): string {
	const v = process.env[name];
	if (!v) {
		console.error(`Missing required env: ${name}`);
		process.exit(2);
	}
	return v;
}

const SUPABASE_URL = requireEnv('PUBLIC_SUPABASE_URL');
const SERVICE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
	auth: { persistSession: false, autoRefreshToken: false }
});

type MatchType = 'title+author' | 'title-only' | 'no-match';
type EnrichRow = {
	row: number;
	title: string;
	author: string;
	match_type: MatchType;
	isbn: string | null;
};

// ---------------------------------------------------------------------------
// CSV parser (minimal RFC-4180; mirrors buildImportRows.ts)
// ---------------------------------------------------------------------------

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
				} else inQuotes = false;
			} else cell += c;
		} else if (c === '"') inQuotes = true;
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
		for (let j = 0; j < header.length; j++) obj[header[j]] = r[j] ?? '';
		out.push(obj);
	}
	return out;
}

function readEnrichmentCsv(): EnrichRow[] {
	const txt = readFileSync(ENRICHED_CSV, 'utf8');
	const rows = parseCsv(txt);
	const out: EnrichRow[] = [];
	for (const r of rows) {
		const row = Number(r.row);
		if (!Number.isFinite(row)) continue;
		const mt = (r.match_type ?? '').trim();
		if (mt !== 'title+author' && mt !== 'title-only' && mt !== 'no-match') continue;
		out.push({
			row,
			title: r.title ?? '',
			author: r.author ?? '',
			match_type: mt,
			isbn: r.isbn?.trim() || null
		});
	}
	return out;
}

// ---------------------------------------------------------------------------
// Normalization (mirrors importLibrary.ts)
// ---------------------------------------------------------------------------

function normalizeKey(s: string | null | undefined): string {
	if (!s) return '';
	return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeTitleForMatch(title: string | null): string {
	if (!title) return '';
	return title
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/^(the|a|an)\s+/i, '')
		.replace(/\s*\([^)]*\)\s*/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * The CSV's `author` column is the raw spreadsheet value, almost always
 * "Last, First Middle" / "Last, First Middle and Last2, First2". For matching
 * we just want the first-author last_name — everything before the first comma
 * of the first " and "-split chunk.
 */
function firstAuthorLastNameFromCsvAuthor(raw: string): string {
	if (!raw) return '';
	const firstChunk = raw.split(/\s+(?:and|&)\s+/i)[0]?.trim() ?? '';
	const beforeComma = firstChunk.split(',')[0]?.trim() ?? '';
	return normalizeKey(beforeComma);
}

// ---------------------------------------------------------------------------
// Books load + index
// ---------------------------------------------------------------------------

type DbBook = {
	id: string;
	title: string | null;
	isbn: string | null;
	import_match_type: string | null;
};

type DbAuthor = { book_id: string; person_id: string; sort_order: number };

async function loadBooks(): Promise<DbBook[]> {
	const out: DbBook[] = [];
	let from = 0;
	const PAGE = 1000;
	while (true) {
		const { data, error } = await supabase
			.from('books')
			.select('id, title, isbn, import_match_type')
			.is('deleted_at', null)
			.range(from, from + PAGE - 1);
		if (error) throw error;
		const batch = (data ?? []) as DbBook[];
		out.push(...batch);
		if (batch.length < PAGE) break;
		from += PAGE;
	}
	return out;
}

async function loadFirstAuthorLastNames(bookIds: string[]): Promise<Map<string, string>> {
	if (bookIds.length === 0) return new Map();
	// 200 UUIDs in `id.in.(...)` keeps URL under PostgREST's 16KB header cap
	// (one UUID = 36 chars + comma; 500 → ~18KB → undici HEADERS_OVERFLOW).
	const PAGE = 200;
	const authorRows: DbAuthor[] = [];
	for (let i = 0; i < bookIds.length; i += PAGE) {
		const slice = bookIds.slice(i, i + PAGE);
		const { data, error } = await supabase
			.from('book_authors')
			.select('book_id, person_id, sort_order')
			.in('book_id', slice)
			.eq('role', 'author');
		if (error) throw error;
		for (const r of data ?? []) authorRows.push(r as DbAuthor);
	}
	const personIds = Array.from(new Set(authorRows.map((a) => a.person_id)));
	const PERSON_PAGE = 200;
	const personLastById = new Map<string, string>();
	for (let i = 0; i < personIds.length; i += PERSON_PAGE) {
		const slice = personIds.slice(i, i + PERSON_PAGE);
		const { data, error } = await supabase.from('people').select('id, last_name').in('id', slice);
		if (error) throw error;
		for (const p of data ?? []) {
			const row = p as { id: string; last_name: string };
			personLastById.set(row.id, row.last_name);
		}
	}
	const firstByBook = new Map<string, string>();
	const firstSortByBook = new Map<string, number>();
	for (const a of authorRows) {
		const cur = firstSortByBook.get(a.book_id);
		if (cur === undefined || a.sort_order < cur) {
			firstSortByBook.set(a.book_id, a.sort_order);
			firstByBook.set(a.book_id, personLastById.get(a.person_id) ?? '');
		}
	}
	return firstByBook;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	console.log(`Mode: ${APPLY ? 'APPLY' : 'dry-run'}`);
	console.log('Loading enrichment CSV…');
	const csv = readEnrichmentCsv();
	console.log(`  ${csv.length} CSV rows (title+author/title-only/no-match).`);

	console.log('Loading prod books…');
	const books = await loadBooks();
	console.log(`  ${books.length} live books.`);
	const firstAuthorByBook = await loadFirstAuthorLastNames(books.map((b) => b.id));

	const byIsbn = new Map<string, DbBook>();
	const byTitleAuthor = new Map<string, DbBook[]>();
	for (const b of books) {
		if (b.isbn) byIsbn.set(b.isbn, b);
		const key = `${normalizeTitleForMatch(b.title)}|${normalizeKey(firstAuthorByBook.get(b.id) ?? '')}`;
		if (!byTitleAuthor.has(key)) byTitleAuthor.set(key, []);
		byTitleAuthor.get(key)!.push(b);
	}

	const stats = {
		matched_isbn: 0,
		matched_title_author: 0,
		ambiguous: 0,
		no_db_match: 0,
		already_correct: 0,
		would_update: 0,
		updated: 0,
		failed: 0
	};
	const updates: { id: string; from: string | null; to: MatchType }[] = [];
	const skipped: { csvRow: number; reason: string; sample: string }[] = [];

	for (const c of csv) {
		let match: DbBook | null = null;
		if (c.isbn && byIsbn.has(c.isbn)) {
			match = byIsbn.get(c.isbn)!;
			stats.matched_isbn++;
		} else {
			const key = `${normalizeTitleForMatch(c.title)}|${firstAuthorLastNameFromCsvAuthor(c.author)}`;
			const candidates = byTitleAuthor.get(key) ?? [];
			if (candidates.length === 1) {
				match = candidates[0];
				stats.matched_title_author++;
			} else if (candidates.length > 1) {
				stats.ambiguous++;
				skipped.push({
					csvRow: c.row,
					reason: `ambiguous: ${candidates.length} books match "${key}"`,
					sample: `${c.title} — ${c.author}`
				});
				continue;
			} else {
				stats.no_db_match++;
				skipped.push({
					csvRow: c.row,
					reason: 'no DB match',
					sample: `${c.title} — ${c.author}`
				});
				continue;
			}
		}
		if (match.import_match_type === c.match_type) {
			stats.already_correct++;
			continue;
		}
		updates.push({ id: match.id, from: match.import_match_type, to: c.match_type });
		stats.would_update++;
	}

	console.log('\n--- Match summary ---');
	console.log(`  ISBN-matched         : ${stats.matched_isbn}`);
	console.log(`  title+author-matched : ${stats.matched_title_author}`);
	console.log(`  ambiguous            : ${stats.ambiguous}`);
	console.log(`  no DB match          : ${stats.no_db_match}`);
	console.log(`  already correct      : ${stats.already_correct}`);
	console.log(`  would update         : ${stats.would_update}`);

	if (skipped.length > 0) {
		console.log('\n--- Skipped (first 10) ---');
		for (const s of skipped.slice(0, 10)) {
			console.log(`  csv row ${s.csvRow}: ${s.reason} — ${s.sample}`);
		}
		if (skipped.length > 10) console.log(`  …and ${skipped.length - 10} more`);
	}

	if (!APPLY) {
		console.log('\nDry-run only — re-run with --apply to write.');
		return;
	}

	console.log('\nApplying updates…');
	for (const u of updates) {
		const { error } = await supabase
			.from('books')
			.update({ import_match_type: u.to } as never)
			.eq('id', u.id);
		if (error) {
			console.error(`  FAIL id=${u.id}: ${error.message}`);
			stats.failed++;
		} else {
			stats.updated++;
		}
	}
	console.log(`\nDone. updated=${stats.updated}  failed=${stats.failed}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
