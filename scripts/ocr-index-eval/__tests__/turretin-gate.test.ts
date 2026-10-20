import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runGateChecks, scanLinesForChapterBackwards } from '../turretin-gate.ts';
import type { TurretinRow } from '../turretin-gold.ts';
import { rowKey } from '../turretin-gold.ts';

const goldRow = (partial: Partial<TurretinRow> & Pick<TurretinRow, 'bible_book' | 'chapter_start' | 'page_start' | 'volume'>): TurretinRow => ({
	verse_start: undefined,
	...partial
});

function writeTempGold(rows: TurretinRow[]): string {
	const dir = join(tmpdir(), `turretin-gate-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(dir, { recursive: true });
	// Gate compares printed 760/764/766 to page-03/01/02 — put all rows on 760 / page-03 for a tiny fixture.
	const payload = { id: 'page-03', rows: rows.map(({ printed_page: _p, column: _c, ...r }) => r) };
	writeFileSync(join(dir, 'page-03.json'), JSON.stringify(payload));
	writeFileSync(join(dir, 'page-01.json'), JSON.stringify({ id: 'page-01', rows: [] }));
	writeFileSync(join(dir, 'page-02.json'), JSON.stringify({ id: 'page-02', rows: [] }));
	return dir;
}

describe('runGateChecks', () => {
	it('passes when review empty, gold exact, apocrypha present', () => {
		const apoc = goldRow({
			bible_book: 'Tobit',
			chapter_start: 5,
			verse_start: 12,
			page_start: '103',
			volume: '1',
			printed_page: 754
		});
		const leaf = goldRow({
			bible_book: 'John',
			chapter_start: 3,
			verse_start: 1,
			page_start: '10',
			volume: '1',
			printed_page: 760
		});
		const goldDir = writeTempGold([leaf]);
		const result = runGateChecks({
			linesText: ['# book John', '3:1—1:10', '# book Tobit', '5:12—1:103'].join('\n'),
			reviewText: '',
			rows: [leaf, apoc],
			goldDir
		});
		expect(result.ok).toBe(true);
		expect(result.failures).toEqual([]);
	});

	it('fails on open review blocks', () => {
		const result = runGateChecks({
			linesText: '# book John\n',
			reviewText: ['# p.760 col 1', 'reason: suspicious_verse_token', 'book: John', '8:141—3:1', ''].join(
				'\n'
			),
			rows: [
				goldRow({
					bible_book: 'Tobit',
					chapter_start: 1,
					page_start: '1',
					volume: '1',
					printed_page: 754
				})
			],
			goldDir: writeTempGold([])
		});
		expect(result.ok).toBe(false);
		expect(result.failures.some((f) => f.includes('open block'))).toBe(true);
	});

	it('fails on gold extras', () => {
		const goldOnly = goldRow({
			bible_book: 'John',
			chapter_start: 1,
			verse_start: 1,
			page_start: '10',
			volume: '1',
			printed_page: 760
		});
		const extra = goldRow({
			bible_book: 'John',
			chapter_start: 1,
			verse_start: 2,
			page_start: '11',
			volume: '1',
			printed_page: 760
		});
		const goldDir = writeTempGold([goldOnly]);
		const result = runGateChecks({
			linesText: '# book John\n1:1—1:10\n1:2—1:11\n# book Tobit\n1:1—1:1\n',
			reviewText: '',
			rows: [
				goldOnly,
				extra,
				goldRow({
					bible_book: 'Tobit',
					chapter_start: 1,
					page_start: '1',
					volume: '1',
					printed_page: 754
				})
			],
			goldDir
		});
		expect(result.ok).toBe(false);
		expect(result.failures.some((f) => f.includes('gold extra'))).toBe(true);
		expect(rowKey(extra)).toContain('John|1|2');
	});

	it('fails when apocrypha row count is zero', () => {
		const result = runGateChecks({
			linesText: '# book John\n1:1—1:10\n',
			reviewText: '',
			rows: [
				goldRow({
					bible_book: 'John',
					chapter_start: 1,
					verse_start: 1,
					page_start: '10',
					volume: '1',
					printed_page: 760
				})
			],
			goldDir: writeTempGold([])
		});
		expect(result.ok).toBe(false);
		expect(result.failures.some((f) => f.includes('apocrypha: zero rows'))).toBe(true);
	});

	it('treats short_page_among_longer as warn-only', () => {
		const rows: TurretinRow[] = [
			goldRow({
				bible_book: 'Genesis',
				chapter_start: 1,
				verse_start: 10,
				page_start: '10',
				volume: '1',
				printed_page: 740
			}),
			goldRow({
				bible_book: 'Genesis',
				chapter_start: 1,
				verse_start: 10,
				page_start: '242',
				volume: '1',
				printed_page: 740
			}),
			goldRow({
				bible_book: 'Tobit',
				chapter_start: 1,
				page_start: '1',
				volume: '1',
				printed_page: 754
			})
		];
		const result = runGateChecks({
			linesText: '# book Genesis\n1:10—1:10, 242\n# book Tobit\n1—1:1\n',
			reviewText: '',
			rows,
			goldDir: writeTempGold([])
		});
		expect(result.warnings.some((w) => w.includes('short_page_among_longer'))).toBe(true);
		expect(result.failures.some((f) => f.includes('short_page_among_longer'))).toBe(false);
	});
});

describe('scanLinesForChapterBackwards', () => {
	it('flags backwards chapters', () => {
		const fails = scanLinesForChapterBackwards(
			['# book Genesis', '13:1—1:100', '12:1—1:101'].join('\n')
		);
		expect(fails.some((f) => f.includes('chapter went backwards'))).toBe(true);
	});
});
