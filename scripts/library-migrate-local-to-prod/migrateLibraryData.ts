/**
 * Path B library migration — copy user library rows from source Postgres → destination Postgres.
 *
 * README: scripts/library-migrate-local-to-prod/README.md
 */
import postgres from 'postgres';

const TABLES_IN_COPY_ORDER = [
	'people',
	'books',
	'book_authors',
	'book_categories',
	'essays',
	'essay_authors',
	'book_bible_coverage',
	'book_ancient_coverage',
	'scripture_references',
	'book_topics'
] as const;

type DependentTable = (typeof TABLES_IN_COPY_ORDER)[number];

const MISSING_SERIES_PLACEHOLDER = '__missing_series__';

type MigrationCtx = {
	dstOwnerId: string;
	srcProfileSet: ReadonlySet<string>;
	categoryLocalToProd: Map<string, string>;
	ancientLocalToProd: Map<string, string>;
	seriesMap: Map<string, string>;
};

async function writableColumns(conn: postgres.Sql, table: string): Promise<string[]> {
	const rows = await conn`
		SELECT column_name
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = ${table}
			AND COALESCE(is_generated, 'NEVER') = 'NEVER'
		ORDER BY ordinal_position
	`;
	return rows.map((r) => String(r.column_name));
}

async function fetchOwnerId(conn: postgres.Sql): Promise<string> {
	const rows = await conn`
		SELECT id
		FROM public.profiles
		WHERE role = 'owner' AND deleted_at IS NULL
		ORDER BY email
		LIMIT 1
	`;
	const id = rows[0]?.id;
	if (!id || typeof id !== 'string') {
		throw new Error('Destination has no owner profile (profiles.role = owner, deleted_at IS NULL)');
	}
	return id;
}

async function fetchProfileIds(conn: postgres.Sql): Promise<string[]> {
	const rows = await conn`SELECT id FROM public.profiles WHERE deleted_at IS NULL`;
	return rows.map((r) => String(r.id));
}

async function assertDestinationEmptyBooks(dst: postgres.Sql, allowNonempty: boolean) {
	const [{ count }] = await dst`
		SELECT COUNT(*)::int AS count FROM public.books WHERE deleted_at IS NULL
	`;
	if ((count as number) > 0 && !allowNonempty) {
		throw new Error(
			'Destination already has active books (deleted_at IS NULL). Refuse copy. Retry with --allow-non-empty-dst if you insist.'
		);
	}
}

async function fetchCategorySlugRows(conn: postgres.Sql): Promise<{ id: string; slug: string }[]> {
	const rows = await conn`SELECT id, slug FROM public.categories`;
	return rows.map((r) => ({ id: String(r.id), slug: String(r.slug) }));
}

/** canonical_name → id */
async function fetchAncientByCanon(conn: postgres.Sql): Promise<Map<string, string>> {
	const rows = await conn`SELECT id, canonical_name FROM public.ancient_texts`;
	const m = new Map<string, string>();
	for (const r of rows) m.set(String(r.canonical_name), String(r.id));
	return m;
}

type SeriesRow = { id: string; name: string; abbreviation: string | null };

async function fetchAllSeries(executor: postgres.Sql): Promise<SeriesRow[]> {
	const rows = await executor`
		SELECT id, name, abbreviation
		FROM public.series
		WHERE deleted_at IS NULL
	`;
	return rows.map((r) => ({
		id: String(r.id),
		name: String(r.name),
		abbreviation: r.abbreviation == null ? null : String(r.abbreviation)
	}));
}

async function fetchUsedSeriesFromSrc(src: postgres.Sql): Promise<SeriesRow[]> {
	const rows = await src`
		SELECT DISTINCT s.id, s.name, s.abbreviation
		FROM public.series s
		INNER JOIN public.books b ON b.series_id = s.id
	`;
	return rows.map((r) => ({
		id: String(r.id),
		name: String(r.name),
		abbreviation: r.abbreviation == null ? null : String(r.abbreviation)
	}));
}

function findMatchingProdSeries(prodRows: SeriesRow[], srcRow: SeriesRow): SeriesRow | undefined {
	const abbrEq = (a: string | null, b: string | null) => (a ?? '') === (b ?? '');
	const nameMatch = prodRows.filter((p) => p.name === srcRow.name);
	const exact = nameMatch.find((p) => abbrEq(p.abbreviation, srcRow.abbreviation));
	return exact ?? nameMatch[0];
}

function remapStoragePaths(
	raw: unknown,
	srcProfileIds: ReadonlySet<string>,
	dstOwnerId: string
): unknown {
	if (typeof raw !== 'string' || raw.length === 0) return raw;
	const trimmed = raw.trim();
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
	const parts = trimmed.split('/').filter((p) => p.length > 0);
	if (parts.length < 2) return raw;
	const first = parts[0]!;
	if (srcProfileIds.has(first)) parts[0] = dstOwnerId;
	return parts.join('/');
}

function remapCreated(raw: unknown, dstOwnerId: string): string | null {
	if (raw == null) return null;
	return dstOwnerId;
}

function trimmedInsertPayload(
	row: Record<string, unknown>,
	columns: readonly string[]
): Record<string, unknown> {
	const o: Record<string, unknown> = {};
	for (const c of columns) {
		if (!(c in row)) continue;
		const v = row[c];
		if (v !== undefined) o[c] = v;
	}
	return o;
}

async function fetchAllRows(
	src: postgres.Sql,
	table: DependentTable
): Promise<Record<string, unknown>[]> {
	return src.unsafe(`SELECT * FROM public.${table}`);
}

async function ensureSeriesMappings(
	executor: postgres.Sql,
	src: postgres.Sql,
	dstOwnerId: string,
	canInsertMissing: boolean
): Promise<Map<string, string>> {
	const seriesMap = new Map<string, string>();
	let prodScratch = await fetchAllSeries(executor);
	const usedSrc = await fetchUsedSeriesFromSrc(src);

	for (const s of usedSrc) {
		const matched = findMatchingProdSeries(prodScratch, s);
		if (matched) {
			seriesMap.set(s.id, matched.id);
			continue;
		}
		if (!canInsertMissing) {
			console.warn(
				`[dry-run] Series "${s.name}" (${s.abbreviation ?? 'no abbrev'}) missing on destination — apply will INSERT it.`
			);
			seriesMap.set(s.id, MISSING_SERIES_PLACEHOLDER);
			continue;
		}
		const now = new Date().toISOString();
		const [inserted] = await executor`
			INSERT INTO public.series (name, abbreviation, created_at, updated_at, created_by)
			VALUES (${s.name}, ${s.abbreviation}, ${now}, ${now}, ${dstOwnerId})
			RETURNING id, name, abbreviation
		`;
		const nid = inserted?.id;
		if (!nid || typeof nid !== 'string') throw new Error(`series insert failed for ${s.name}`);
		const newRow: SeriesRow = {
			id: String(nid),
			name: String(inserted!.name),
			abbreviation: inserted!.abbreviation == null ? null : String(inserted!.abbreviation)
		};
		prodScratch = [...prodScratch, newRow];
		seriesMap.set(s.id, newRow.id);
		console.warn(`Inserted series on destination: "${newRow.name}" → ${newRow.id}`);
	}
	return seriesMap;
}

function slugToId(rows: readonly { id: string; slug: string }[]): Map<string, string> {
	const m = new Map<string, string>();
	for (const r of rows) m.set(r.slug, r.id);
	return m;
}

/** Build local category id → destination id via slug. */
function buildCategoryBridge(
	srcRows: readonly { id: string; slug: string }[],
	dstSlugToId: Map<string, string>
): Map<string, string> {
	const m = new Map<string, string>();
	for (const r of srcRows) {
		const prodId = dstSlugToId.get(r.slug);
		if (!prodId) {
			throw new Error(
				`Slug "${r.slug}" exists on SOURCE categories but missing on DESTINATION. Run library_seed.sql on prod first.`
			);
		}
		m.set(r.id, prodId);
	}
	return m;
}

function buildAncientBridge(
	srcByCanon: Map<string, string>,
	dstByCanon: Map<string, string>
): Map<string, string> {
	const m = new Map<string, string>();
	for (const [canonName, srcId] of srcByCanon) {
		const dstId = dstByCanon.get(canonName);
		if (!dstId) {
			throw new Error(
				`ancient_texts "${canonName}" on SOURCE missing on DESTINATION. Run library_seed.sql on prod first.`
			);
		}
		m.set(srcId, dstId);
	}
	return m;
}

/** Resolve books.series_id; missing dry-run placeholders become null FK. */
function remapBookSeries(rawSeriesId: unknown, seriesMap: Map<string, string>): string | null {
	if (rawSeriesId == null || rawSeriesId === '') return null;
	const sid = String(rawSeriesId);
	const mapped = seriesMap.get(sid);
	if (mapped == null || mapped === '' || mapped === MISSING_SERIES_PLACEHOLDER) {
		return null;
	}
	return mapped;
}

function transformRow(
	table: DependentTable,
	raw: Record<string, unknown>,
	ctx: MigrationCtx
): Record<string, unknown> {
	const row = { ...raw };
	switch (table) {
		case 'people':
			row.created_by = remapCreated(row.created_by, ctx.dstOwnerId);
			break;
		case 'books': {
			row.created_by = remapCreated(row.created_by, ctx.dstOwnerId);
			const pk =
				row.primary_category_id != null && row.primary_category_id !== ''
					? String(row.primary_category_id)
					: '';
			row.primary_category_id = pk
				? (ctx.categoryLocalToProd.get(pk) ?? row.primary_category_id)
				: row.primary_category_id;
			row.series_id = remapBookSeries(row.series_id, ctx.seriesMap);
			break;
		}
		case 'book_categories': {
			const cid = row.category_id != null && row.category_id !== '' ? String(row.category_id) : '';
			row.category_id = cid
				? (ctx.categoryLocalToProd.get(cid) ?? row.category_id)
				: row.category_id;
			break;
		}
		case 'essay_authors':
		case 'book_authors':
			break;
		case 'essays':
			row.created_by = remapCreated(row.created_by, ctx.dstOwnerId);
			break;
		case 'book_bible_coverage':
			row.created_by = remapCreated(row.created_by, ctx.dstOwnerId);
			break;
		case 'book_ancient_coverage': {
			row.created_by = remapCreated(row.created_by, ctx.dstOwnerId);
			const aid = row.ancient_text_id != null ? String(row.ancient_text_id) : '';
			row.ancient_text_id = aid
				? (ctx.ancientLocalToProd.get(aid) ?? row.ancient_text_id)
				: row.ancient_text_id;
			break;
		}
		case 'scripture_references':
			row.created_by = remapCreated(row.created_by, ctx.dstOwnerId);
			row.source_image_url = remapStoragePaths(
				row.source_image_url,
				ctx.srcProfileSet,
				ctx.dstOwnerId
			);
			break;
		case 'book_topics':
			row.created_by = remapCreated(row.created_by, ctx.dstOwnerId);
			row.source_image_url = remapStoragePaths(
				row.source_image_url,
				ctx.srcProfileSet,
				ctx.dstOwnerId
			);
			break;
		default:
			break;
	}
	return row;
}

async function prefetchColumnLists(dst: postgres.Sql): Promise<Record<DependentTable, string[]>> {
	const out = {} as Record<DependentTable, string[]>;
	for (const t of TABLES_IN_COPY_ORDER) out[t] = await writableColumns(dst, t);
	return out;
}

type TransactionSql = Parameters<Parameters<postgres.Sql['begin']>[0]>[0];

async function insertOne(
	txn: TransactionSql,
	table: DependentTable,
	payload: Record<string, unknown>
): Promise<void> {
	switch (table) {
		case 'people':
			await txn`INSERT INTO public.people ${txn(payload)}`;
			break;
		case 'books':
			await txn`INSERT INTO public.books ${txn(payload)}`;
			break;
		case 'book_authors':
			await txn`INSERT INTO public.book_authors ${txn(payload)}`;
			break;
		case 'book_categories':
			await txn`INSERT INTO public.book_categories ${txn(payload)}`;
			break;
		case 'essays':
			await txn`INSERT INTO public.essays ${txn(payload)}`;
			break;
		case 'essay_authors':
			await txn`INSERT INTO public.essay_authors ${txn(payload)}`;
			break;
		case 'book_bible_coverage':
			await txn`INSERT INTO public.book_bible_coverage ${txn(payload)}`;
			break;
		case 'book_ancient_coverage':
			await txn`INSERT INTO public.book_ancient_coverage ${txn(payload)}`;
			break;
		case 'scripture_references':
			await txn`INSERT INTO public.scripture_references ${txn(payload)}`;
			break;
		case 'book_topics':
			await txn`INSERT INTO public.book_topics ${txn(payload)}`;
			break;
		default: {
			const _exhaust: never = table;
			void _exhaust;
		}
	}
}

async function migrate(): Promise<void> {
	const argv = process.argv.slice(2);
	const apply = argv.includes('--apply');
	const allowNonemptyDst = argv.includes('--allow-non-empty-dst');

	if (apply && process.env.LIBRARY_MIGRATE_CONFIRM !== 'yes') {
		console.error(
			'Refusing --apply without LIBRARY_MIGRATE_CONFIRM=yes (see README). Dry-run omitted writes.'
		);
		process.exit(1);
	}

	const srcUrl = process.env.LIBRARY_SRC_DATABASE_URL;
	const dstUrl = process.env.LIBRARY_DST_DATABASE_URL;
	if (!srcUrl?.trim()) throw new Error('Missing LIBRARY_SRC_DATABASE_URL');
	if (!dstUrl?.trim()) throw new Error('Missing LIBRARY_DST_DATABASE_URL');

	const src = postgres(srcUrl, { max: 1, idle_timeout: 20 });
	const dst = postgres(dstUrl, { max: 1, idle_timeout: 20 });

	try {
		const dstOwnerId = await fetchOwnerId(dst);
		const srcProfileIds = await fetchProfileIds(src);
		const srcProfileSet = new Set(srcProfileIds);

		await assertDestinationEmptyBooks(dst, allowNonemptyDst);

		console.log('[connect] Owner on destination:', dstOwnerId);

		const srcCatRows = await fetchCategorySlugRows(src);
		const dstCatRows = await fetchCategorySlugRows(dst);
		const dstSlugToId = slugToId(dstCatRows);
		const categoryLocalToProd = buildCategoryBridge(srcCatRows, dstSlugToId);

		const srcAncientByCanon = await fetchAncientByCanon(src);
		const dstAncientByCanon = await fetchAncientByCanon(dst);
		const ancientLocalToProd = buildAncientBridge(srcAncientByCanon, dstAncientByCanon);

		const colLists = await prefetchColumnLists(dst);

		if (!apply) {
			console.log('\n--- Dry run (no writes on destination) ---\n');
			await ensureSeriesMappings(dst, src, dstOwnerId, false);
			for (const t of TABLES_IN_COPY_ORDER) {
				const rows = await fetchAllRows(src, t);
				console.log(`SOURCE ${t}: ${rows.length} rows`);
			}
			console.log(
				'\nDry run finished. Resolve any warnings, then LIBRARY_MIGRATE_CONFIRM=yes with --apply.'
			);
			return;
		}

		await dst.begin(async (txn) => {
			const seriesMap = await ensureSeriesMappings(txn, src, dstOwnerId, true);
			const ctx: MigrationCtx = {
				dstOwnerId,
				srcProfileSet,
				categoryLocalToProd,
				ancientLocalToProd,
				seriesMap
			};

			for (const table of TABLES_IN_COPY_ORDER) {
				const cols = colLists[table];
				const rows = await fetchAllRows(src, table);
				let n = 0;
				for (const raw of rows) {
					const tr = transformRow(table, raw as Record<string, unknown>, ctx);
					const payload = trimmedInsertPayload(tr, cols);
					await insertOne(txn, table, payload);
					n++;
				}
				console.log(`Inserted ${table}: ${n}`);
			}
		});

		console.log('\nApply finished inside one transaction.');
		console.log('Verification queries: see README verification section.');
	} finally {
		await src.end({ timeout: 5 });
		await dst.end({ timeout: 5 });
	}
}

migrate().catch((e: unknown) => {
	console.error(e);
	process.exit(1);
});
