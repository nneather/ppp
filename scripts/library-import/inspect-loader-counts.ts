/**
 * Smoke test for the post-pagination loaders. Confirms loadPeople,
 * loadPersonBookCounts, and loadBookListFiltered each return the full row
 * set (not just the PostgREST-default first 1,000).
 *
 * One-off; safe to leave in place for future regression spot-checks.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
	loadPeople,
	loadPersonBookCounts,
	loadBookListFiltered
} from '../../src/lib/library/server/loaders.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
config({ path: resolve(ROOT, '.env') });
config({ path: resolve(ROOT, '.env.local'), override: true });

const sb = createClient(
	process.env.PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
	const t0 = Date.now();
	const people = await loadPeople(sb);
	const t1 = Date.now();
	const counts = await loadPersonBookCounts(sb);
	const t2 = Date.now();
	const books = await loadBookListFiltered(sb, people, {});
	const t3 = Date.now();

	console.log(`loadPeople:           ${people.length} rows  (${t1 - t0}ms)`);
	console.log(`loadPersonBookCounts: ${counts.size} unique people  (${t2 - t1}ms)`);
	const totalAuthorRows = [...counts.values()].reduce((a, b) => a + b, 0);
	console.log(`  total author rows:  ${totalAuthorRows}`);
	console.log(`loadBookListFiltered: ${books.length} rows  (${t3 - t2}ms)`);

	// Sanity: how many books have authors_label populated?
	const withAuthors = books.filter((b) => b.authors_label != null).length;
	console.log(`  books with author label: ${withAuthors} / ${books.length}`);

	// Sanity: ensure rows past index 1000 have data
	if (books.length > 1000) {
		const sample = books[1200];
		console.log(`  row 1200 sample: ${sample.title} — ${sample.authors_label ?? '(no authors)'}`);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
