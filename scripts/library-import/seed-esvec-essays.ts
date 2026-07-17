/**
 * One-shot: seed ESVEC vols 2–12 essay rows (biblical book → contributor).
 * Vol 1 already seeded. Idempotent by (parent_book_id, essay_title).
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/library-import/seed-esvec-essays.ts
 */
import { config } from 'dotenv';
import postgres from 'postgres';
import { resolve } from 'node:path';
import { resolveLibraryResearchDatabaseUrl } from '../library-review-research/resolve-database-url.ts';

const ROOT = resolve(import.meta.dirname, '../..');
config({ path: resolve(ROOT, '.env') });
config({ path: resolve(ROOT, '.env.local'), override: true });

const OWNER_ID = 'a14833c9-459e-4667-aef3-dae698734f6d';

type PersonSpec = {
	first: string;
	middle: string | null;
	last: string;
	suffix?: string | null;
};

type EssaySpec = { title: string; author: PersonSpec };

/** Parent book UUID → essays (bible_books names). Contributors from Crossway TOCs. */
const BY_PARENT: Record<string, EssaySpec[]> = {
	// Vol 2 — Deuteronomy–Ruth
	'21549a88-6cb4-4469-859e-8199caaa22a7': [
		{ title: 'Deuteronomy', author: { first: 'August', middle: 'H.', last: 'Konkel' } },
		{ title: 'Joshua', author: { first: 'David', middle: null, last: 'Reimer' } },
		{ title: 'Judges', author: { first: 'Miles', middle: 'V.', last: 'Van Pelt' } },
		{ title: 'Ruth', author: { first: 'Mary', middle: 'Willson', last: 'Hannah' } }
	],
	// Vol 3 — 1 Samuel–2 Chronicles
	'2de5d0a2-e5d4-4302-bc4d-7e3ad7cb7cd4': [
		{ title: '1 Samuel', author: { first: 'John', middle: 'L.', last: 'Mackay' } },
		{ title: '2 Samuel', author: { first: 'John', middle: 'L.', last: 'Mackay' } },
		{ title: '1 Kings', author: { first: 'J.', middle: 'Gary', last: 'Millar' } },
		{ title: '2 Kings', author: { first: 'J.', middle: 'Gary', last: 'Millar' } },
		{ title: '1 Chronicles', author: { first: 'John', middle: 'W.', last: 'Olley' } },
		{ title: '2 Chronicles', author: { first: 'John', middle: 'W.', last: 'Olley' } }
	],
	// Vol 4 — Ezra–Job
	'0ca27bf7-333f-434c-b5be-96559924141f': [
		{ title: 'Ezra', author: { first: 'W.', middle: 'Brian', last: 'Aucker' } },
		{ title: 'Nehemiah', author: { first: 'W.', middle: 'Brian', last: 'Aucker' } },
		{ title: 'Esther', author: { first: 'Eric', middle: null, last: 'Ortlund' } },
		{ title: 'Job', author: { first: 'Douglas', middle: 'Sean', last: "O'Donnell" } }
	],
	// Vol 5 — Psalms–Song of Solomon (essay title matches bible_books: Song of Songs)
	'32d948c8-9f0c-40bd-8f01-ef433905ab3c': [
		{ title: 'Psalms', author: { first: 'C.', middle: 'John', last: 'Collins' } },
		{ title: 'Proverbs', author: { first: 'Ryan', middle: 'Patrick', last: "O'Dowd" } },
		{ title: 'Ecclesiastes', author: { first: 'Max', middle: null, last: 'Rogland' } },
		{ title: 'Song of Songs', author: { first: 'Douglas', middle: 'Sean', last: "O'Donnell" } }
	],
	// Vol 6 — Isaiah–Ezekiel
	'e22cfc63-eaa7-4a23-b559-1ad7b45138df': [
		{ title: 'Isaiah', author: { first: 'Robert', middle: null, last: 'Fyall' } },
		{ title: 'Jeremiah', author: { first: 'Jerry', middle: null, last: 'Hwang' } },
		{ title: 'Lamentations', author: { first: 'Jonathan', middle: null, last: 'Gibson' } },
		{ title: 'Ezekiel', author: { first: 'Iain', middle: 'M.', last: 'Duguid' } }
	],
	// Vol 7 — Daniel–Malachi
	'3a0b1085-7f04-4544-aca0-fb5214da564f': [
		{ title: 'Daniel', author: { first: 'Mitchell', middle: 'L.', last: 'Chase' } },
		{ title: 'Hosea', author: { first: 'George', middle: 'M.', last: 'Schwab', suffix: 'Sr.' } },
		{ title: 'Joel', author: { first: 'Allan', middle: 'M.', last: 'Harman' } },
		{ title: 'Amos', author: { first: 'Michael', middle: 'G.', last: 'McKelvey' } },
		{ title: 'Obadiah', author: { first: 'Max', middle: null, last: 'Rogland' } },
		{ title: 'Jonah', author: { first: 'Jay', middle: null, last: 'Sklar' } },
		{ title: 'Micah', author: { first: 'Stephen', middle: 'G.', last: 'Dempster' } },
		{ title: 'Nahum', author: { first: 'Daniel', middle: 'C.', last: 'Timmer' } },
		{ title: 'Habakkuk', author: { first: 'David', middle: 'G.', last: 'Firth' } },
		{ title: 'Zephaniah', author: { first: 'Jason', middle: 'S.', last: 'DeRouchie' } },
		{ title: 'Haggai', author: { first: 'Michael', middle: 'R.', last: 'Stead' } },
		{ title: 'Zechariah', author: { first: 'Anthony', middle: 'R.', last: 'Petterson' } },
		{ title: 'Malachi', author: { first: 'Eric', middle: null, last: 'Ortlund' } }
	],
	// Vol 8 — Matthew–Luke
	'bbd8c822-685b-4b30-84e3-8e20ad74dee5': [
		{ title: 'Matthew', author: { first: 'Daniel', middle: null, last: 'Doriani' } },
		{ title: 'Mark', author: { first: 'Hans', middle: 'F.', last: 'Bayer' } },
		{ title: 'Luke', author: { first: 'Thomas', middle: 'R.', last: 'Schreiner' } }
	],
	// Vol 9 — John–Acts
	'0019dde9-cfdc-4f1b-a146-ee71a170e585': [
		{ title: 'John', author: { first: 'James', middle: 'M.', last: 'Hamilton', suffix: 'Jr.' } },
		{ title: 'Acts', author: { first: 'Brian', middle: 'J.', last: 'Vickers' } }
	],
	// Vol 10 — Romans–Galatians
	'00bb1711-22b1-45aa-97cd-8da3d73d1c4c': [
		{ title: 'Romans', author: { first: 'Robert', middle: 'W.', last: 'Yarbrough' } },
		{ title: '1 Corinthians', author: { first: 'Andrew', middle: 'David', last: 'Naselli' } },
		{ title: '2 Corinthians', author: { first: 'Dane', middle: null, last: 'Ortlund' } },
		{ title: 'Galatians', author: { first: 'Frank', middle: null, last: 'Thielman' } }
	],
	// Vol 11 — Ephesians–Philemon
	'2aa3de3d-dd90-4203-9c3c-221e19ef9ed6': [
		{ title: 'Ephesians', author: { first: 'Benjamin', middle: 'L.', last: 'Merkle' } },
		{ title: 'Philippians', author: { first: 'Jason', middle: 'C.', last: 'Meyer' } },
		{ title: 'Colossians', author: { first: 'Alistair', middle: 'I.', last: 'Wilson' } },
		{ title: '1 Thessalonians', author: { first: 'David', middle: 'W.', last: 'Chapman' } },
		{ title: '2 Thessalonians', author: { first: 'David', middle: 'W.', last: 'Chapman' } },
		{ title: '1 Timothy', author: { first: 'Denny', middle: null, last: 'Burk' } },
		{ title: '2 Timothy', author: { first: 'Denny', middle: null, last: 'Burk' } },
		{ title: 'Titus', author: { first: 'Denny', middle: null, last: 'Burk' } },
		{ title: 'Philemon', author: { first: 'Alistair', middle: 'I.', last: 'Wilson' } }
	],
	// Vol 12 — Hebrews–Revelation
	'bc780c01-c7d7-46e5-945e-814f9b89bf6f': [
		{ title: 'Hebrews', author: { first: 'Dennis', middle: 'E.', last: 'Johnson' } },
		{ title: 'James', author: { first: 'Robert', middle: 'L.', last: 'Plummer' } },
		{ title: '1 Peter', author: { first: 'Sam', middle: null, last: 'Storms' } },
		{ title: '2 Peter', author: { first: 'Matthew', middle: 'S.', last: 'Harmon' } },
		{ title: '1 John', author: { first: 'Ray', middle: null, last: 'Van Neste' } },
		{ title: '2 John', author: { first: 'Ray', middle: null, last: 'Van Neste' } },
		{ title: '3 John', author: { first: 'Ray', middle: null, last: 'Van Neste' } },
		{ title: 'Jude', author: { first: 'Matthew', middle: 'S.', last: 'Harmon' } },
		{ title: 'Revelation', author: { first: 'Thomas', middle: 'R.', last: 'Schreiner' } }
	]
};

async function findOrCreatePerson(
	sql: postgres.Sql,
	spec: PersonSpec
): Promise<string> {
	const suffix = spec.suffix ?? null;

	// Exact match including middle + suffix
	const exact = await sql<{ id: string }[]>`
		SELECT id FROM people
		WHERE deleted_at IS NULL
			AND last_name = ${spec.last}
			AND first_name = ${spec.first}
			AND (
				(${spec.middle}::text IS NULL AND (middle_name IS NULL OR middle_name = ''))
				OR middle_name = ${spec.middle}
				OR (${spec.middle}::text IS NOT NULL AND middle_name = replace(${spec.middle}, '.', ''))
			)
			AND (
				(${suffix}::text IS NULL AND (suffix IS NULL OR suffix = ''))
				OR suffix = ${suffix}
			)
		LIMIT 1
	`;
	if (exact[0]) return exact[0].id;

	// Loose: first + last when middle on either side is empty/compatible
	const loose = await sql<{ id: string; middle_name: string | null; suffix: string | null }[]>`
		SELECT id, middle_name, suffix FROM people
		WHERE deleted_at IS NULL
			AND last_name = ${spec.last}
			AND first_name = ${spec.first}
		ORDER BY created_at
	`;
	if (loose.length === 1) {
		const row = loose[0]!;
		const midOk =
			!spec.middle ||
			!row.middle_name ||
			row.middle_name === spec.middle ||
			row.middle_name.replace(/\./g, '') === spec.middle.replace(/\./g, '');
		const sufOk = !suffix || !row.suffix || row.suffix === suffix;
		if (midOk && sufOk) return row.id;
	}
	for (const row of loose) {
		const midOk =
			spec.middle &&
			row.middle_name &&
			(row.middle_name === spec.middle ||
				row.middle_name.replace(/\./g, '') === spec.middle.replace(/\./g, '') ||
				row.middle_name.replace(/\./g, '') === spec.middle.replace(/\./g, '').charAt(0));
		const sufOk = (!suffix && !row.suffix) || row.suffix === suffix;
		if (midOk && sufOk) return row.id;
	}

	// Firth special: existing middle_name "G" without period
	if (spec.last === 'Firth' && spec.first === 'David') {
		const firth = await sql<{ id: string }[]>`
			SELECT id FROM people
			WHERE deleted_at IS NULL AND last_name = 'Firth' AND first_name = 'David'
			LIMIT 1
		`;
		if (firth[0]) return firth[0].id;
	}

	const inserted = await sql<{ id: string }[]>`
		INSERT INTO people (first_name, middle_name, last_name, suffix, created_by)
		VALUES (${spec.first}, ${spec.middle}, ${spec.last}, ${suffix}, ${OWNER_ID}::uuid)
		RETURNING id
	`;
	return inserted[0]!.id;
}

async function main() {
	const databaseUrl = await resolveLibraryResearchDatabaseUrl();
	const sql = postgres(databaseUrl, { max: 1, ssl: 'require' });
	let createdEssays = 0;
	let linkedAuthors = 0;
	let createdPeople = 0;

	try {
		await sql.begin(async (tx) => {
			const beforePeople = await tx`SELECT count(*)::int AS n FROM people WHERE deleted_at IS NULL`;
			const peopleBefore = beforePeople[0]!.n as number;

			for (const [parentId, essays] of Object.entries(BY_PARENT)) {
				for (const e of essays) {
					const personId = await findOrCreatePerson(tx, e.author);

					const existing = await tx<{ id: string }[]>`
						SELECT id FROM essays
						WHERE deleted_at IS NULL
							AND parent_book_id = ${parentId}::uuid
							AND essay_title = ${e.title}
						LIMIT 1
					`;

					let essayId = existing[0]?.id;
					if (!essayId) {
						const rows = await tx<{ id: string }[]>`
							INSERT INTO essays (essay_title, parent_book_id, page_start, page_end, created_by)
							VALUES (${e.title}, ${parentId}::uuid, NULL, NULL, ${OWNER_ID}::uuid)
							RETURNING id
						`;
						essayId = rows[0]!.id;
						createdEssays++;
					}

					const link = await tx`
						INSERT INTO essay_authors (essay_id, person_id, role, sort_order)
						VALUES (${essayId}::uuid, ${personId}::uuid, ${'author'}, 0)
						ON CONFLICT (essay_id, person_id) DO NOTHING
						RETURNING essay_id
					`;
					if (link.length) linkedAuthors++;
				}
			}

			const afterPeople = await tx`SELECT count(*)::int AS n FROM people WHERE deleted_at IS NULL`;
			createdPeople = (afterPeople[0]!.n as number) - peopleBefore;
		});

		const summary = await sql`
			SELECT b.volume_number, b.title AS volume, count(e.id)::int AS essays
			FROM books b
			LEFT JOIN essays e ON e.parent_book_id = b.id AND e.deleted_at IS NULL
			WHERE b.deleted_at IS NULL
				AND b.series_id = '8a7a8d92-9f56-40c4-adbd-6f3ddd868f40'::uuid
			GROUP BY b.id, b.volume_number, b.title
			ORDER BY b.volume_number::int
		`;
		console.log(
			`Done. +${createdEssays} essays, +${linkedAuthors} author links, +${createdPeople} people`
		);
		for (const r of summary) {
			console.log(`  Vol ${r.volume_number}: ${r.volume} — ${r.essays} essays`);
		}
	} finally {
		await sql.end({ timeout: 5 });
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
