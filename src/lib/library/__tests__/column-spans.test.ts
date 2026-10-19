import { describe, expect, it } from 'vitest';
import { columnSpansFromInk } from '../column-spans';

function paint(width: number, bands: [number, number][]): number[] {
	const ink = new Array<number>(width).fill(0);
	for (const [a, b] of bands) {
		for (let x = a; x < b; x++) ink[x] = 400;
	}
	return ink;
}

describe('columnSpansFromInk', () => {
	it('finds three text columns and ignores the margins', () => {
		const width = 1500;
		const ink = paint(width, [
			[160, 510],
			[600, 970],
			[1040, 1420]
		]);
		const spans = columnSpansFromInk(ink, width, 0);
		expect(spans).toHaveLength(3);
		expect(spans[0]!.x0).toBeGreaterThan(100);
		expect(spans[0]!.x1).toBeLessThan(560);
		expect(spans[2]!.x0).toBeGreaterThan(990);
	});

	it('finds two columns', () => {
		const width = 1000;
		const ink = paint(width, [
			[80, 420],
			[560, 940]
		]);
		expect(columnSpansFromInk(ink, width, 0)).toHaveLength(2);
	});

	it('falls back to a midpoint split when the page is one block of ink', () => {
		const width = 800;
		const ink = paint(width, [[40, 760]]);
		const spans = columnSpansFromInk(ink, width, 0);
		expect(spans).toHaveLength(2);
		expect(spans[0]!.x0).toBe(0);
		expect(spans[1]!.x1).toBe(width);
	});
});
