/**
 * Import the Battles / McNeill scripture index into scripture_references
 * on the two Institutes volumes.
 *
 *   npm run calvin:import -- --docx "/path/Index.docx"            # dry run
 *   npm run calvin:import -- --docx "/path/Index.docx" --apply    # write
 *
 * Env (.env / .env.local): PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * POS_OWNER_ID. Refuses to write when a row does not parse or does not land
 * on exactly one outline chapter. Re-runs skip live twins and leave
 * soft-deleted twins deleted.
 */
import { execFileSync } from 'node:child_process';
import { getPppMcpClient } from '../ppp-mcp/client.ts';
import { paragraphsFromDocumentXml, parseCalvinParagraphs } from './calvin-index-parse.ts';
import {
	CALVIN_SERIES_NAME,
	formatCalvinPlan,
	planCalvinImport,
	resolveCalvinVolumes,
	type CalvinExistingRef,
	type CalvinVolumeBookRow
} from './calvin-index-plan.ts';

const APPLY = process.argv.includes('--apply');
const PAGE = 1000;
const INSERT_CHUNK = 500;

function docxPath(): string {
	const flag = process.argv.indexOf('--docx');
	const path = flag >= 0 ? process.argv[flag + 1]?.trim() : '';
	if (!path) {
		throw new Error('Pass --docx "/path/to/Battles Institutes Scripture Index.docx".');
	}
	return path;
}

function readDocumentXml(path: string): string {
	return execFileSync('unzip', ['-p', path, 'word/document.xml'], {
		encoding: 'utf8',
		maxBuffer: 32 * 1024 * 1024
	});
}

async function main(): Promise<number> {
	const path = docxPath();
	const parsed = parseCalvinParagraphs(paragraphsFromDocumentXml(readDocumentXml(path)));
	console.log(
		`docx rows: ${parsed.rows.length}  glossary skipped: ${parsed.glossary}  parse failures: ${parsed.failures.length}`
	);
	for (const failure of parsed.failures.slice(0, 20)) {
		console.error(`  ${failure.reason}: ${failure.line}`);
	}
	if (parsed.failures.length > 0) return 1;

	const { supabase, ownerId } = await getPppMcpClient();
	console.log(`owner asserted: ${ownerId}`);

	const { data: series, error: seriesErr } = await supabase
		.from('series')
		.select('id')
		.eq('name', CALVIN_SERIES_NAME)
		.is('deleted_at', null);
	if (seriesErr) throw new Error(`series lookup: ${seriesErr.message}`);
	if (!series || series.length !== 1) {
		console.error(
			`Expected one live series "${CALVIN_SERIES_NAME}", found ${series?.length ?? 0}.`
		);
		return 1;
	}

	const { data: books, error: booksErr } = await supabase
		.from('books')
		.select('id, volume_number, deleted_at')
		.eq('series_id', series[0]!.id);
	if (booksErr) throw new Error(`books lookup: ${booksErr.message}`);

	const bookIds = (books ?? []).filter((b) => b.deleted_at == null).map((b) => b.id);
	const { data: outline, error: outlineErr } = await supabase
		.from('book_outline_sections')
		.select('book_id, locator')
		.in('book_id', bookIds)
		.is('deleted_at', null);
	if (outlineErr) throw new Error(`outline lookup: ${outlineErr.message}`);
	const locatorsByBookId = new Map<string, (string | null)[]>();
	for (const section of outline ?? []) {
		const list = locatorsByBookId.get(section.book_id) ?? [];
		list.push(section.locator);
		locatorsByBookId.set(section.book_id, list);
	}

	const resolved = resolveCalvinVolumes((books ?? []) as CalvinVolumeBookRow[], locatorsByBookId);
	if (!resolved.ok) {
		console.error(resolved.message);
		return 1;
	}
	for (const volume of resolved.volumes) {
		console.log(
			`vol ${volume.volumeNumber} → ${volume.bookId} (${volume.locators.length} outline chapters)`
		);
	}

	const { data: vocab, error: vocabErr } = await supabase.from('bible_books').select('name');
	if (vocabErr) throw new Error(`bible_books lookup: ${vocabErr.message}`);
	const knownBibleBooks = new Set((vocab ?? []).map((b) => b.name));

	const volumeBookIds = resolved.volumes.map((v) => v.bookId);
	const existing: CalvinExistingRef[] = [];
	for (let from = 0; ; from += PAGE) {
		const { data, error } = await supabase
			.from('scripture_references')
			.select(
				'id, book_id, bible_book, chapter_start, verse_start, chapter_end, verse_end, page_start, page_end, deleted_at'
			)
			.in('book_id', volumeBookIds)
			.order('id')
			.range(from, from + PAGE - 1);
		if (error) throw new Error(`scripture_references lookup: ${error.message}`);
		existing.push(...((data ?? []) as CalvinExistingRef[]));
		if (!data || data.length < PAGE) break;
	}
	console.log(`existing scripture_references on volumes: ${existing.length} (incl. deleted)`);

	const plan = planCalvinImport({
		rows: parsed.rows,
		volumes: resolved.volumes,
		existing,
		knownBibleBooks,
		ownerId
	});
	console.log('');
	for (const line of formatCalvinPlan(plan, parsed.rows.length)) console.log(line);
	if (plan.failures.length > 0) return 1;

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

	let retired = 0;
	for (let i = 0; i < plan.retireIds.length; i += INSERT_CHUNK) {
		const ids = plan.retireIds.slice(i, i + INSERT_CHUNK);
		const { data, error } = await supabase
			.from('scripture_references')
			.update({ deleted_at: startedAt })
			.in('id', ids)
			.in('book_id', volumeBookIds)
			.is('deleted_at', null)
			.select('id');
		if (error) {
			console.error(`retire failed: ${error.message}`);
			return 1;
		}
		retired += data?.length ?? 0;
	}

	console.log(`Inserted ${inserted}, retired ${retired}. Run started ${startedAt}.`);
	return 0;
}

main().then(
	(code) => process.exit(code),
	(err: unknown) => {
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	}
);
