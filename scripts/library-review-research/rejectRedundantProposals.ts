/**
 * One-off: reject pending proposals whose every proposed field is already
 * satisfied on the book (chiefly location-only rows where effective location
 * exists via publisher registry). Run after 069 ships:
 *
 *   npx tsx scripts/library-review-research/rejectRedundantProposals.ts
 *
 * Requires LIBRARY_DST_DATABASE_URL (or LIBRARY_RESEARCH_DATABASE_URL) in .env.local.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';
import postgres from 'postgres';
import { resolveLibraryResearchDatabaseUrl } from './resolve-database-url.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

dotenvConfig({ path: resolve(ROOT, '.env') });
dotenvConfig({ path: resolve(ROOT, '.env.local'), override: true });

const APPLY = process.argv.includes('--apply');

async function main() {
	const databaseUrl = await resolveLibraryResearchDatabaseUrl();
	const sql = postgres(databaseUrl, { max: 1, ssl: 'require' });

	const candidates = await sql<{ id: string; book_id: string; fields: Record<string, unknown> }[]>`
		SELECT p.id, p.book_id, p.fields
		FROM public.book_metadata_proposals p
		JOIN public.books b ON b.id = p.book_id AND b.deleted_at IS NULL
		LEFT JOIN public.publishers pub ON pub.id = b.publisher_id AND pub.deleted_at IS NULL
		LEFT JOIN public.publishers parent ON parent.id = pub.parent_id AND parent.deleted_at IS NULL
		WHERE p.status = 'pending' AND p.deleted_at IS NULL
	`;

	let redundant = 0;
	const ids: string[] = [];

	for (const row of candidates) {
		const fields = row.fields ?? {};
		const keys = Object.keys(fields);
		if (keys.length === 0) {
			ids.push(row.id);
			redundant++;
			continue;
		}

		const [{ book }] = await sql<
			{
				book: {
					genre: string | null;
					year: number | null;
					publisher: string | null;
					publisher_id: string | null;
					publisher_location: string | null;
					effective_location: string | null;
				};
			}[]
		>`
			SELECT json_build_object(
				'genre', b.genre,
				'year', b.year,
				'publisher', b.publisher,
				'publisher_id', b.publisher_id,
				'publisher_location', b.publisher_location,
				'effective_location', COALESCE(
					NULLIF(TRIM(b.publisher_location), ''),
					NULLIF(TRIM(pub.default_location), ''),
					NULLIF(TRIM(parent.default_location), '')
				)
			) AS book
			FROM public.books b
			LEFT JOIN public.publishers pub ON pub.id = b.publisher_id AND pub.deleted_at IS NULL
			LEFT JOIN public.publishers parent ON parent.id = pub.parent_id AND parent.deleted_at IS NULL
			WHERE b.id = ${row.book_id}
		`;

		if (!book) continue;

		const allSatisfied = keys.every((k) => {
			switch (k) {
				case 'genre':
					return book.genre != null;
				case 'year':
					return book.year != null;
				case 'publisher':
					return book.publisher != null || book.publisher_id != null;
				case 'publisher_location':
					return (
						(book.publisher_location?.trim() ?? '') !== '' ||
						(book.effective_location?.trim() ?? '') !== ''
					);
				default:
					return false;
			}
		});

		if (allSatisfied) {
			ids.push(row.id);
			redundant++;
		}
	}

	console.log(`${redundant} redundant pending proposals of ${candidates.length} pending.`);

	if (APPLY && ids.length > 0) {
		const res = await sql`
			UPDATE public.book_metadata_proposals
			SET status = 'rejected', reviewed_at = now()
			WHERE id = ANY(${ids}::uuid[])
				AND status = 'pending'
				AND deleted_at IS NULL
		`;
		console.log(`Rejected ${res.count} proposals.`);
	} else if (!APPLY) {
		console.log('Dry run — pass --apply to reject.');
	}

	await sql.end({ timeout: 5 });
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
