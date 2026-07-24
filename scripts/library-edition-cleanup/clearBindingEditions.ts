/**
 * List (and optionally clear) live `books.edition` values that look like the old
 * Open Library prefill bug: binding + revision joined as "Paperback — 9", or
 * binding-only strings.
 *
 * Dry-run by default. Apply only with explicit confirm:
 *   LIBRARY_EDITION_CLEANUP_CONFIRM=yes npx tsx scripts/library-edition-cleanup/clearBindingEditions.ts --apply
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';
import postgres from 'postgres';
import { isLikelyOlBindingEditionJunk } from '../../src/lib/library/open-library-prefill.ts';
import { resolveLibraryResearchDatabaseUrl } from '../library-review-research/resolve-database-url.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

dotenvConfig({ path: resolve(ROOT, '.env') });
dotenvConfig({ path: resolve(ROOT, '.env.local'), override: true });

const APPLY = process.argv.includes('--apply');
const CONFIRM = process.env.LIBRARY_EDITION_CLEANUP_CONFIRM?.trim() === 'yes';

if (APPLY && !CONFIRM) {
	console.error(
		'Refusing --apply without LIBRARY_EDITION_CLEANUP_CONFIRM=yes (owner confirm gate).'
	);
	process.exit(2);
}

type Row = { id: string; title: string; edition: string; isbn: string | null };

let DATABASE_URL: string;
try {
	DATABASE_URL = await resolveLibraryResearchDatabaseUrl();
} catch (e) {
	console.error(e instanceof Error ? e.message : e);
	process.exit(2);
}

const sql = postgres(DATABASE_URL, { max: 1, prepare: false, ssl: 'require' });

try {
	const rows = await sql<Row[]>`
		select id, title, edition, isbn
		from books
		where deleted_at is null
		  and edition is not null
		  and trim(edition) <> ''
		order by title
	`;

	const junk = rows.filter((r) => isLikelyOlBindingEditionJunk(r.edition));

	console.log(`Scanned ${rows.length} live books with non-empty edition.`);
	console.log(`Likely OL binding/revision junk: ${junk.length}`);
	for (const r of junk) {
		const isbn = r.isbn ? ` isbn=${r.isbn}` : '';
		console.log(`  ${r.id}  ${JSON.stringify(r.edition)}  — ${r.title}${isbn}`);
	}

	if (!APPLY) {
		console.log('\nDry-run only. To clear edition on these rows:');
		console.log(
			'  LIBRARY_EDITION_CLEANUP_CONFIRM=yes npx tsx scripts/library-edition-cleanup/clearBindingEditions.ts --apply'
		);
		process.exit(0);
	}

	if (junk.length === 0) {
		console.log('Nothing to clear.');
		process.exit(0);
	}

	const ids = junk.map((r) => r.id);
	const updated = await sql`
		update books
		set edition = null
		where id = any(${ids}::uuid[])
		  and deleted_at is null
		returning id
	`;
	console.log(`Cleared edition on ${updated.length} book(s).`);
} finally {
	await sql.end({ timeout: 5 });
}
