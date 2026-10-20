/**
 * Enforceable Turretin text-layer gates: review clear, gold leaves, lines scan,
 * full-row validation, apocrypha presence.
 *
 *   npm run turretin:gate
 *   npm run turretin:gate -- --parse
 *   npm run turretin:gate -- --parse /path/to.pdf
 *
 * Exit 0 pass / 2 fail / 1 usage or missing files.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { BIBLE_BOOK_NAMES } from '../../src/lib/library/bible-book-names.ts';
import { validateIndexRows } from '../../src/lib/library/scripture-index-validate.ts';
import { parseIndexEntry } from './parse-index-line.ts';
import {
	APOCRYPHA_BOOKS,
	isApocryphaBook,
	validateApocryphaRows
} from './turretin-apocrypha.ts';
import {
	compareGoldLeaves,
	rowsByPrintedPage,
	type TurretinRow
} from './turretin-gold.ts';
import { parseReviewBlocks, summarizeReview } from './turretin-review.ts';

const here = dirname(fileURLToPath(import.meta.url));

const FAIL_VALIDATE_REASONS = new Set([
	'unknown_bible_book',
	'chapter_out_of_range',
	'chapter_end_out_of_range',
	'verse_out_of_range',
	'verse_end_out_of_range',
	'out_of_canonical_order'
]);

const WARN_VALIDATE_REASONS = new Set(['short_page_among_longer']);

export type GateInputs = {
	linesText: string;
	reviewText: string;
	rows: TurretinRow[];
	goldDir?: string;
};

export type GateResult = {
	ok: boolean;
	failures: string[];
	warnings: string[];
	report: string[];
};

function countByReason(reasons: string[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const r of reasons) {
		out[r] = (out[r] ?? 0) + 1;
	}
	return out;
}

/** build-gold chapter-went-backwards scan over turretin.lines.txt */
export function scanLinesForChapterBackwards(linesText: string): string[] {
	const failures: string[] = [];
	let book = '';
	let prevChapter = 0;
	let lineNo = 0;
	for (const raw of linesText.split('\n')) {
		lineNo += 1;
		const line = raw.trim();
		if (!line) continue;
		if (line.startsWith('# book ')) {
			book = line.slice('# book '.length).trim();
			prevChapter = 0;
			continue;
		}
		if (line.startsWith('#')) continue;
		if (!book) {
			failures.push(`lines L${lineNo}: entry before book heading: ${line}`);
			continue;
		}
		try {
			const parsed = parseIndexEntry(line, book);
			const chapter = parsed[0]?.chapter_start ?? 0;
			if (chapter < prevChapter) {
				failures.push(
					`lines L${lineNo}: chapter went backwards (${prevChapter} → ${chapter}) in ${book}: ${line}`
				);
			}
			prevChapter = chapter;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			failures.push(`lines L${lineNo}: ${msg}`);
		}
	}
	return failures;
}

export function runGateChecks(inputs: GateInputs): GateResult {
	const failures: string[] = [];
	const warnings: string[] = [];
	const report: string[] = [];

	const blocks = parseReviewBlocks(inputs.reviewText);
	const summary = summarizeReview(blocks);
	report.push(
		`review: ${summary.open} open, ${summary.corrected} corrected, ${summary.skipped} skipped (${summary.total} blocks)`
	);
	const reasonEntries = Object.entries(summary.byReasonPrefix).sort((a, b) => b[1] - a[1]);
	if (reasonEntries.length) {
		report.push('review by reason prefix:');
		for (const [prefix, n] of reasonEntries) report.push(`  ${n}\t${prefix}`);
	}
	const pageEntries = Object.entries(summary.openByPrintedPage)
		.map(([p, n]) => [Number(p), n] as const)
		.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
	if (pageEntries.length) {
		report.push('open items by printed page (top):');
		for (const [p, n] of pageEntries.slice(0, 15)) report.push(`  p.${p}: ${n}`);
	}
	if (summary.open > 0) {
		failures.push(
			`review has ${summary.open} open block(s) — clear with corrected: / skip: or fix the PDF extract`
		);
	}

	const byPrinted = rowsByPrintedPage(inputs.rows);
	const gold = compareGoldLeaves(byPrinted, { goldDir: inputs.goldDir, log: false });
	report.push(
		`gold leaves: ${gold.totalMatch}/${gold.totalGold} exact (${(gold.overall * 100).toFixed(3)}%), ${gold.extraCount} extra(s)`
	);
	for (const leaf of gold.leaves) {
		report.push(
			`  p.${leaf.printed} vs ${leaf.goldId}: ${leaf.match}/${leaf.goldCount} (${(leaf.rate * 100).toFixed(2)}%)` +
				(leaf.misses.length ? `, ${leaf.misses.length} miss` : '') +
				(leaf.extras.length ? `, ${leaf.extras.length} extra` : '')
		);
		for (const m of leaf.misses) warnings.push(`gold miss p.${leaf.printed}: ${m}`);
		for (const e of leaf.extras) {
			failures.push(`gold extra on p.${leaf.printed}: ${e}`);
		}
	}
	if (gold.overall < 0.995) {
		failures.push(
			`gold overall ${(gold.overall * 100).toFixed(3)}% < 99.5% (${gold.totalMatch}/${gold.totalGold})`
		);
	}

	const lineFails = scanLinesForChapterBackwards(inputs.linesText);
	for (const f of lineFails) failures.push(f);
	if (lineFails.length === 0) report.push('lines scan: ok (no chapter-went-backwards)');
	else report.push(`lines scan: ${lineFails.length} failure(s)`);

	const canon = inputs.rows.filter((r) => !isApocryphaBook(r.bible_book));
	const apoc = inputs.rows.filter((r) => isApocryphaBook(r.bible_book));
	const canonSet = new Set<string>(BIBLE_BOOK_NAMES);

	const suspicious: string[] = [];
	for (let i = 0; i < inputs.rows.length; i++) {
		const r = inputs.rows[i]!;
		const vs = r.verse_start;
		if (vs != null && r.bible_book !== 'Psalms' && vs > 100) {
			suspicious.push(
				`row[${i}] ${r.bible_book} ${r.chapter_start}:${vs} (printed p.${r.printed_page ?? '?'})`
			);
		}
		if (!canonSet.has(r.bible_book) && !isApocryphaBook(r.bible_book)) {
			failures.push(`unknown bible_book in rows: ${r.bible_book} (row ${i})`);
		}
		if (r.bible_book === 'Son of Sirach') {
			failures.push(`non-NRSV spelling in rows: Son of Sirach (use Sirach)`);
		}
	}
	if (suspicious.length) {
		failures.push(`suspicious_verse_token: ${suspicious.length} row(s)`);
		for (const s of suspicious.slice(0, 10)) report.push(`  suspicious: ${s}`);
		if (suspicious.length > 10) report.push(`  … ${suspicious.length - 10} more`);
	}

	const canonIssues = validateIndexRows(canon);
	const apocIssues = validateApocryphaRows(apoc);
	const failReasons: string[] = [];
	const warnReasons: string[] = [];
	for (const issue of [...canonIssues, ...apocIssues]) {
		if (WARN_VALIDATE_REASONS.has(issue.reason)) warnReasons.push(issue.reason);
		else if (FAIL_VALIDATE_REASONS.has(issue.reason)) failReasons.push(issue.reason);
		else warnReasons.push(issue.reason);
	}
	const failCounts = countByReason(failReasons);
	const warnCounts = countByReason(warnReasons);
	report.push(
		`validate: ${failReasons.length} fail-class, ${warnReasons.length} warn-class (canon ${canon.length} + apoc ${apoc.length} rows)`
	);
	for (const [r, n] of Object.entries(failCounts).sort((a, b) => b[1] - a[1])) {
		report.push(`  fail ${n}\t${r}`);
		failures.push(`validateIndexRows/apocrypha: ${n}× ${r}`);
	}
	for (const [r, n] of Object.entries(warnCounts).sort((a, b) => b[1] - a[1])) {
		report.push(`  warn ${n}\t${r}`);
		warnings.push(`validate warn-only: ${n}× ${r}`);
	}

	const apocCounts: Record<string, number> = {};
	for (const name of APOCRYPHA_BOOKS) apocCounts[name] = 0;
	for (const r of apoc) {
		apocCounts[r.bible_book] = (apocCounts[r.bible_book] ?? 0) + 1;
	}
	report.push('apocrypha row counts:');
	let apocTotal = 0;
	for (const name of APOCRYPHA_BOOKS) {
		const n = apocCounts[name] ?? 0;
		apocTotal += n;
		report.push(`  ${name}: ${n}`);
	}
	if (apocTotal === 0) {
		failures.push('apocrypha: zero rows in rows.json (expected NRSV apocrypha books)');
	}

	return {
		ok: failures.length === 0,
		failures,
		warnings,
		report
	};
}

function loadGateInputsFromDisk(): GateInputs | { error: string } {
	const linesPath = join(here, 'turretin.lines.txt');
	const reviewPath = join(here, 'turretin.review.txt');
	const rowsPath = join(here, 'turretin.rows.json');
	for (const p of [linesPath, reviewPath, rowsPath]) {
		if (!existsSync(p)) return { error: `missing required file: ${p}` };
	}
	const rowsRaw = JSON.parse(readFileSync(rowsPath, 'utf8')) as { rows?: TurretinRow[] };
	if (!Array.isArray(rowsRaw.rows)) return { error: `${rowsPath}: missing rows array` };
	return {
		linesText: readFileSync(linesPath, 'utf8'),
		reviewText: readFileSync(reviewPath, 'utf8'),
		rows: rowsRaw.rows
	};
}

function maybeParse(argv: string[]): number | null {
	const idx = argv.indexOf('--parse');
	if (idx < 0) return null;
	const pdfArg = argv[idx + 1] && !argv[idx + 1]!.startsWith('-') ? argv[idx + 1] : undefined;
	const args = [join(here, 'parse-turretin-text.ts')];
	if (pdfArg) args.push(pdfArg);
	console.log(`Running parse first: npx tsx ${args.join(' ')}`);
	const r = spawnSync('npx', ['tsx', ...args], {
		stdio: 'inherit',
		cwd: join(here, '../..'),
		env: process.env
	});
	if (r.status !== 0) {
		console.error('parse failed; gate aborted');
		return r.status ?? 1;
	}
	return null;
}

function main(): void {
	const argv = process.argv.slice(2);
	const parseStatus = maybeParse(argv);
	if (parseStatus != null) process.exit(parseStatus);

	const loaded = loadGateInputsFromDisk();
	if ('error' in loaded) {
		console.error(loaded.error);
		console.error('Run npm run turretin:parse first, or turretin:gate -- --parse');
		process.exit(1);
	}

	const result = runGateChecks(loaded);
	for (const line of result.report) console.log(line);
	if (result.warnings.length) {
		console.log('--- warnings ---');
		for (const w of result.warnings.slice(0, 40)) console.log(`  ${w}`);
		if (result.warnings.length > 40) console.log(`  … ${result.warnings.length - 40} more`);
	}
	if (result.failures.length) {
		console.log('--- failures ---');
		for (const f of result.failures) console.log(`  FAIL: ${f}`);
		console.log('GATE FAIL');
		process.exit(2);
	}
	console.log('GATE PASS');
	process.exit(0);
}

const isMain =
	process.argv[1] &&
	(process.argv[1].endsWith('turretin-gate.ts') || process.argv[1].endsWith('turretin-gate.js'));
if (isMain) main();
