/**
 * Import the gated Turretin scripture index (turretin.rows.json) into
 * scripture_references on the three Institutes of Elenctic Theology volumes.
 *
 *   npm run turretin:import                     # dry run (default)
 *   npm run turretin:import -- --apply          # write
 *   npm run turretin:import -- --apply --revive-deleted
 *
 * Env (.env / .env.local): PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * POS_OWNER_ID (asserted as the live owner profile before any read/write).
 *
 * Refuses to run unless `turretin:gate` passes on the same local artifacts.
 * Re-runs are idempotent: rows already live on the volume (same passage range
 * + pages) are skipped; soft-deleted matches stay deleted unless --revive-deleted.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPppMcpClient } from '../ppp-mcp/client.ts';
import { loadGateInputsFromDisk, runGateChecks } from './turretin-gate.ts';
import {
	formatImportPlan,
	pendingVocabFile,
	planTurretinImport,
	resolveTurretinVolumes,
	TURRETIN_SERIES_NAME,
	type ExistingScriptureRef,
	type TurretinVolumeBookRow
} from './turretin-import-plan.ts';

const APPLY = process.argv.includes('--apply');
const REVIVE_DELETED = process.argv.includes('--revive-deleted');
const PAGE = 1000;
const INSERT_CHUNK = 500;
const PENDING_PATH = join(
	dirname(fileURLToPath(import.meta.url)),
	'turretin-apocrypha-pending.json'
);

async function main(): Promise<number> {
	const gateInputs = loadGateInputsFromDisk();
	if ('error' in gateInputs) {
		console.error(gateInputs.error);
		console.error('Run npm run turretin:parse first.');
		return 1;
	}
	const gate = runGateChecks(gateInputs);
	if (!gate.ok) {
		for (const f of gate.failures) console.error(`  FAIL: ${f}`);
		console.error('turretin:gate fails on local artifacts — import refused.');
		return 2;
	}
	console.log('turretin:gate PASS on local artifacts');
	const rows = gateInputs.rows;

	const { supabase, ownerId } = await getPppMcpClient();
	console.log(`owner asserted: ${ownerId}`);

	const { data: series, error: seriesErr } = await supabase
		.from('series')
		.select('id')
		.eq('name', TURRETIN_SERIES_NAME)
		.is('deleted_at', null);
	if (seriesErr) throw new Error(`series lookup: ${seriesErr.message}`);
	if (!series || series.length !== 1) {
		console.error(`Expected one live series "${TURRETIN_SERIES_NAME}", found ${series?.length ?? 0}.`);
		return 1;
	}
	const seriesId = series[0]!.id;

	const { data: books, error: booksErr } = await supabase
		.from('books')
		.select('id, volume_number, deleted_at')
		.eq('series_id', seriesId);
	if (booksErr) throw new Error(`books lookup: ${booksErr.message}`);

	const bookIds = (books ?? []).filter((b) => b.deleted_at == null).map((b) => b.id);
	const { data: outline, error: outlineErr } = await supabase
		.from('book_outline_sections')
		.select('book_id, page_end')
		.in('book_id', bookIds)
		.is('deleted_at', null);
	if (outlineErr) throw new Error(`outline lookup: ${outlineErr.message}`);
	const outlineMax = new Map<string, number>();
	for (const o of outline ?? []) {
		outlineMax.set(o.book_id, Math.max(outlineMax.get(o.book_id) ?? 0, o.page_end));
	}

	const resolved = resolveTurretinVolumes((books ?? []) as TurretinVolumeBookRow[], outlineMax);
	if (!resolved.ok) {
		console.error(resolved.message);
		return 1;
	}
	for (const v of resolved.volumes) {
		console.log(`vol ${v.label} → ${v.bookId} (outline max p.${v.pageMax ?? '?'})`);
	}

	const { data: vocab, error: vocabErr } = await supabase.from('bible_books').select('name');
	if (vocabErr) throw new Error(`bible_books lookup: ${vocabErr.message}`);
	const knownBibleBooks = new Set((vocab ?? []).map((b) => b.name));

	const volumeBookIds = resolved.volumes.map((v) => v.bookId);
	const existing: ExistingScriptureRef[] = [];
	for (let from = 0; ; from += PAGE) {
		const { data, error } = await supabase
			.from('scripture_references')
			.select('id, book_id, bible_book, verse_start_abs, verse_end_abs, page_start, page_end, deleted_at')
			.in('book_id', volumeBookIds)
			.order('id')
			.range(from, from + PAGE - 1);
		if (error) throw new Error(`scripture_references lookup: ${error.message}`);
		existing.push(...((data ?? []) as ExistingScriptureRef[]));
		if (!data || data.length < PAGE) break;
	}
	console.log(`existing scripture_references on volumes: ${existing.length} (incl. deleted)`);

	const plan = planTurretinImport({
		rows,
		volumes: resolved.volumes,
		existing,
		knownBibleBooks,
		ownerId,
		reviveDeleted: REVIVE_DELETED
	});
	console.log('');
	for (const line of formatImportPlan(plan, rows.length)) console.log(line);

	const pending = pendingVocabFile(plan);
	writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2) + '\n');
	console.log(`\nheld for vocab: ${pending.rows.length} rows → ${PENDING_PATH}`);

	if (!APPLY) {
		console.log('\nDry run — nothing written. Re-run with --apply to insert.');
		return 0;
	}

	const startedAt = new Date().toISOString();
	console.log(`\nApplying at ${startedAt} …`);
	let inserted = 0;
	for (let i = 0; i < plan.inserts.length; i += INSERT_CHUNK) {
		const chunk = plan.inserts.slice(i, i + INSERT_CHUNK);
		const { data, error } = await supabase.from('scripture_references').insert(chunk).select('id');
		if (error) {
			console.error(`insert failed at chunk ${i / INSERT_CHUNK + 1}: ${error.message}`);
			console.error(`inserted so far: ${inserted}. Re-run is safe — inserted rows are skipped.`);
			return 1;
		}
		inserted += data?.length ?? 0;
	}

	let revived = 0;
	for (let i = 0; i < plan.reviveIds.length; i += INSERT_CHUNK) {
		const ids = plan.reviveIds.slice(i, i + INSERT_CHUNK);
		const { data, error } = await supabase
			.from('scripture_references')
			.update({ deleted_at: null })
			.in('id', ids)
			.in('book_id', volumeBookIds)
			.select('id');
		if (error) {
			console.error(`revive failed: ${error.message}`);
			return 1;
		}
		revived += data?.length ?? 0;
	}

	console.log(`Inserted ${inserted}, revived ${revived}. Run started ${startedAt}.`);
	return 0;
}

main().then(
	(code) => process.exit(code),
	(err: unknown) => {
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	}
);
