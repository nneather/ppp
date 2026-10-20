/**
 * Propose books.acquired_on from an Amazon Items order-report CSV.
 *
 *   npm run library:amazon-acquired -- ./orders.csv
 *   LIBRARY_AMAZON_ACQUIRED_CONFIRM=yes npm run library:amazon-acquired -- ./orders.csv --apply
 *
 * Dry-run is the default. --apply updates acquired_on only, and only for ISBN
 * matches whose date differs. Title suggestions are never written.
 * Do not commit the CSV.
 *
 * README: scripts/library-amazon-acquired/README.md
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';
import postgres from 'postgres';
import {
	formatAmazonAcquiredReport,
	formatAmazonAcquiredTsv,
	isbnApplyRows,
	matchAmazonAcquiredOn,
	parseAmazonOrdersCsv,
	type LibraryAcquiredBook
} from '../../src/lib/library/amazon-acquired-on.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT_DIR = resolve(ROOT, 'data');
const OUT_TSV = resolve(OUT_DIR, 'library_amazon_acquired_preview.tsv');

dotenvConfig({ path: resolve(ROOT, '.env') });
dotenvConfig({ path: resolve(ROOT, '.env.local'), override: true });

const APPLY = process.argv.includes('--apply');
const csvArg = process.argv.slice(2).find((arg) => arg !== '--apply');

if (!csvArg) {
	console.error('Usage: npm run library:amazon-acquired -- <orders.csv> [--apply]');
	console.error('Apply requires LIBRARY_AMAZON_ACQUIRED_CONFIRM=yes.');
	console.error('Do not commit the CSV.');
	process.exit(2);
}

if (APPLY && process.env.LIBRARY_AMAZON_ACQUIRED_CONFIRM !== 'yes') {
	console.error('Refusing --apply without LIBRARY_AMAZON_ACQUIRED_CONFIRM=yes');
	process.exit(2);
}

const csvPath = isAbsolute(csvArg) ? csvArg : resolve(process.cwd(), csvArg);
let csvText: string;
try {
	csvText = readFileSync(csvPath, 'utf8');
} catch {
	console.error(`Could not read ${csvPath}`);
	process.exit(2);
}

const parsed = parseAmazonOrdersCsv(csvText);
if (!parsed.ok) {
	console.error(parsed.message);
	process.exit(2);
}

const databaseUrl =
	process.env.LIBRARY_AUDIT_DATABASE_URL?.trim() ||
	process.env.LIBRARY_DST_DATABASE_URL?.trim() ||
	process.env.LIBRARY_SRC_DATABASE_URL?.trim();
if (!databaseUrl) {
	console.error(
		'Set LIBRARY_DST_DATABASE_URL (or LIBRARY_SRC_DATABASE_URL / LIBRARY_AUDIT_DATABASE_URL) in .env.local. See scripts/library-amazon-acquired/README.md'
	);
	process.exit(2);
}

type DbBook = {
	id: string;
	title: string | null;
	subtitle: string | null;
	edition: string | null;
	isbn: string | null;
	owned: boolean;
	acquired_on: string | null;
};

async function main(): Promise<void> {
		const sql = postgres(databaseUrl!, { max: 1, ssl: 'require' });
	try {
		const dbRows = await sql<DbBook[]>`
			SELECT id, title, subtitle, edition, isbn, owned, acquired_on::text AS acquired_on
			FROM public.books
			WHERE deleted_at IS NULL
				AND owned = true
			ORDER BY title NULLS LAST, id
		`;
		const books: LibraryAcquiredBook[] = dbRows.map((row) => ({
			id: row.id,
			title: row.title,
			subtitle: row.subtitle,
			edition: row.edition,
			isbn: row.isbn,
			owned: row.owned,
			acquiredOn: row.acquired_on
		}));
		const match = matchAmazonAcquiredOn({
			orders: parsed.ok ? parsed.orders : [],
			books,
			unparsed: parsed.ok ? parsed.unparsed : 0
		});
		const report = formatAmazonAcquiredReport(match);
		if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
		writeFileSync(OUT_TSV, formatAmazonAcquiredTsv(match), 'utf8');

		console.log(report.trimEnd());
		console.log(`Wrote ${OUT_TSV}`);
		console.log(
			`Owned books scanned: ${books.length}. Order rows: ${parsed.ok ? parsed.orders.length : 0}.`
		);
		console.log('Do not commit the order CSV.');

		const writes = isbnApplyRows(match);
		if (!APPLY) {
			console.log('Dry run — nothing written. Title suggestions are never applied.');
			return;
		}
		if (writes.length === 0) {
			console.log('Nothing to apply.');
			return;
		}

		await sql.begin(async (tx) => {
			for (const row of writes) {
				const updated = await tx<{ id: string }[]>`
					UPDATE public.books
					SET acquired_on = ${row.proposedOn}
					WHERE id = ${row.bookId}
						AND owned = true
						AND deleted_at IS NULL
					RETURNING id
				`;
				if (updated.length !== 1) {
					throw new Error(`Refused to update ${row.bookId} (not an owned live book).`);
				}
			}
		});
		console.log(`Updated acquired_on on ${writes.length} books.`);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

main().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
