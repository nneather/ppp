/**
 * Gold-leaf exact-key compare for Turretin printed pages vs gold/page-0N.json.
 * Same key shape as compare.ts.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IndexGoldRow } from './parse-index-line.ts';

const here = dirname(fileURLToPath(import.meta.url));

export const GOLD_LEAF_PAGES: { printed: number; goldId: string }[] = [
	{ printed: 760, goldId: 'page-03' },
	{ printed: 764, goldId: 'page-01' },
	{ printed: 766, goldId: 'page-02' }
];

export type TurretinRow = IndexGoldRow & {
	printed_page?: number;
	column?: number;
	/** Original accepted index line (for per-book resort). */
	source_line?: string;
};

export function rowKey(r: Pick<
	IndexGoldRow,
	| 'bible_book'
	| 'chapter_start'
	| 'verse_start'
	| 'chapter_end'
	| 'verse_end'
	| 'page_start'
	| 'page_end'
	| 'volume'
>): string {
	return [
		r.bible_book,
		r.chapter_start,
		r.verse_start ?? '',
		r.chapter_end ?? '',
		r.verse_end ?? '',
		r.page_start,
		r.page_end ?? '',
		r.volume
	].join('|');
}

export type GoldLeafResult = {
	printed: number;
	goldId: string;
	match: number;
	goldCount: number;
	rate: number;
	misses: string[];
	extras: string[];
};

export type GoldCompareSummary = {
	leaves: GoldLeafResult[];
	totalMatch: number;
	totalGold: number;
	overall: number;
	extraCount: number;
};

export function compareGoldLeaves(
	rowsByPrinted: Map<number, TurretinRow[]>,
	opts?: { goldDir?: string; log?: boolean }
): GoldCompareSummary {
	const goldDir = opts?.goldDir ?? join(here, 'gold');
	const log = opts?.log ?? false;
	const leaves: GoldLeafResult[] = [];
	let totalGold = 0;
	let totalMatch = 0;
	let extraCount = 0;

	if (log) console.log('--- Gold leaf diff (exact keys as compare.ts) ---');

	for (const { printed, goldId } of GOLD_LEAF_PAGES) {
		const goldPath = join(goldDir, `${goldId}.json`);
		const goldRaw = JSON.parse(readFileSync(goldPath, 'utf8')) as {
			running_book?: string;
			rows: IndexGoldRow[];
		};
		const goldRows = goldRaw.rows;
		const parsedRows = rowsByPrinted.get(printed) ?? [];
		const goldKeys = new Set(goldRows.map(rowKey));
		const parsedKeys = new Set(parsedRows.map(rowKey));
		let match = 0;
		const misses: string[] = [];
		for (const g of goldRows) {
			const k = rowKey(g);
			if (parsedKeys.has(k)) match += 1;
			else misses.push(k);
		}
		const extras = [...parsedKeys].filter((k) => !goldKeys.has(k));
		const rate = goldRows.length === 0 ? 0 : match / goldRows.length;
		leaves.push({
			printed,
			goldId,
			match,
			goldCount: goldRows.length,
			rate,
			misses,
			extras
		});
		totalGold += goldRows.length;
		totalMatch += match;
		extraCount += extras.length;

		if (log) {
			console.log(
				`printed p.${printed} vs ${goldId}: ${match}/${goldRows.length} exact (${(rate * 100).toFixed(2)}%)` +
					(misses.length ? ` — ${misses.length} miss` : '') +
					(extras.length ? `, ${extras.length} extra` : '')
			);
			for (const m of misses) console.log(`  miss: ${m}`);
			for (const e of extras.slice(0, 20)) console.log(`  extra: ${e}`);
			if (extras.length > 20) console.log(`  … ${extras.length - 20} more extras`);
		}
	}

	const overall = totalGold === 0 ? 0 : totalMatch / totalGold;
	if (log) {
		console.log('---');
		console.log(
			`gold leaves overall: ${totalMatch}/${totalGold} exact (${(overall * 100).toFixed(3)}%)`
		);
	}

	return { leaves, totalMatch, totalGold, overall, extraCount };
}

/** Same key as compare.ts / gold diff — duplicate rows break import dedupe expectations. */
export function findDuplicateRowKeys(
	rows: TurretinRow[]
): { key: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const r of rows) {
		const k = rowKey(r);
		counts.set(k, (counts.get(k) ?? 0) + 1);
	}
	return [...counts.entries()]
		.filter(([, n]) => n > 1)
		.map(([key, count]) => ({ key, count }))
		.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** Group rows that carry printed_page into a map for gold compare. */
export function rowsByPrintedPage(rows: TurretinRow[]): Map<number, TurretinRow[]> {
	const map = new Map<number, TurretinRow[]>();
	for (const r of rows) {
		const p = r.printed_page;
		if (p == null) continue;
		const list = map.get(p) ?? [];
		list.push(r);
		map.set(p, list);
	}
	return map;
}
