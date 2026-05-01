/**
 * Pass 1 validation queries — equivalent to step 9 in scripts/library-import/README.md.
 * Runs them via supabase-js so we don't have to round-trip through Studio.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
config({ path: resolve(ROOT, '.env') });
config({ path: resolve(ROOT, '.env.local'), override: true });
const sb = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function exact(table: string, filter?: (q: ReturnType<typeof sb.from>) => unknown) {
	let q = sb.from(table).select('*', { count: 'exact', head: true });
	if (filter) filter(q);
	const { count, error } = await q;
	if (error) throw new Error(`${table}: ${error.message}`);
	return count ?? 0;
}

async function main() {
	const liveBooks = await exact('books', (q) => q.is('deleted_at', null));
	console.log(`live books:                     ${liveBooks}`);

	// Per-genre breakdown of needs_review = false
	const { data: genreData, error: gErr } = await sb
		.from('books')
		.select('genre')
		.eq('needs_review', false)
		.is('deleted_at', null);
	if (gErr) throw gErr;
	const byGenre = new Map<string, number>();
	for (const r of genreData ?? []) {
		const k = (r as { genre: string | null }).genre ?? '(NULL)';
		byGenre.set(k, (byGenre.get(k) ?? 0) + 1);
	}
	console.log('\nneeds_review=false by genre:');
	for (const [k, v] of [...byGenre.entries()].sort((a, b) => b[1] - a[1])) {
		console.log(`  ${k.padEnd(28)} ${v}`);
	}
	const scholarlyClean = (genreData ?? []).filter((r) => {
		const g = (r as { genre: string | null }).genre;
		return (
			g === 'Commentary' ||
			g === 'Bibles' ||
			g === 'Biblical Reference' ||
			g === 'Greek Language Tools' ||
			g === 'Hebrew Language Tools' ||
			g === 'Latin Language Tools' ||
			g === 'German Language Tools' ||
			g === 'Chinese Language Tools'
		);
	}).length;
	console.log(`Scholarly-core clean:           ${scholarlyClean} (target ≥ 159)`);

	const baBackmap = await exact('book_authors');
	console.log(`\nbook_authors rows:              ${baBackmap}`);
	const bcBackmap = await exact('book_categories');
	console.log(`book_categories rows:           ${bcBackmap}`);
	const peopleCount = await exact('people', (q) => q.is('deleted_at', null));
	console.log(`live people:                    ${peopleCount}`);
	const seriesCount = await exact('series', (q) => q.is('deleted_at', null));
	console.log(`live series:                    ${seriesCount}`);
	const germanCount = await exact('books', (q) => q.eq('language', 'german').is('deleted_at', null));
	console.log(`german books:                   ${germanCount}`);

	// FK-orphan checks: any book_authors / book_categories pointing at deleted books?
	const { data: orphanBA, error: oba } = await sb.rpc('show_limit'); // dummy to ensure rpc plumbing works
	void orphanBA; void oba;

	// Manual orphan check — JOIN-style via two queries
	const { data: ba, error: baErr } = await sb.from('book_authors').select('book_id');
	if (baErr) throw baErr;
	const baBookIds = new Set((ba ?? []).map((r) => (r as { book_id: string }).book_id));
	const { data: liveBookRows, error: lErr } = await sb.from('books').select('id').is('deleted_at', null);
	if (lErr) throw lErr;
	const liveIds = new Set((liveBookRows ?? []).map((r) => (r as { id: string }).id));
	let baOrphans = 0;
	for (const id of baBookIds) if (!liveIds.has(id)) baOrphans++;
	console.log(`book_authors with no live book: ${baOrphans}`);

	const { data: bc } = await sb.from('book_categories').select('book_id');
	const bcBookIds = new Set((bc ?? []).map((r) => (r as { book_id: string }).book_id));
	let bcOrphans = 0;
	for (const id of bcBookIds) if (!liveIds.has(id)) bcOrphans++;
	console.log(`book_categories with no live book: ${bcOrphans}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
