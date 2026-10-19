/**
 * Column bounds for a scripture-index page, from a vertical ink histogram.
 * Turretin leaves are three columns; many other indexes are two. A dark
 * scan edge is narrower than a text column and is dropped.
 */

export type ColumnSpan = { x0: number; x1: number };

function halfSpans(width: number, overlapRatio: number): ColumnSpan[] {
	const mid = Math.floor(width / 2);
	const overlap = Math.floor(width * overlapRatio);
	return [
		{ x0: 0, x1: Math.min(width, mid + overlap) },
		{ x0: Math.max(0, mid - overlap), x1: width }
	];
}

/**
 * Return 2 or 3 reading-order spans. Falls back to a midpoint split when the
 * histogram is not a clear multi-column page.
 */
export function columnSpansFromInk(
	ink: number[],
	width: number,
	overlapRatio = 0.04
): ColumnSpan[] {
	if (width < 2 || ink.length !== width) return halfSpans(Math.max(width, 2), overlapRatio);

	const window = Math.max(4, Math.floor(width / 200));
	const smooth = new Array<number>(width);
	for (let x = 0; x < width; x++) {
		let sum = 0;
		const a = Math.max(0, x - window);
		const b = Math.min(width - 1, x + window);
		for (let i = a; i <= b; i++) sum += ink[i] ?? 0;
		smooth[x] = sum;
	}
	let max = 0;
	for (const v of smooth) if (v > max) max = v;
	if (max <= 0) return halfSpans(width, overlapRatio);

	const threshold = max * 0.08;
	const minGutter = Math.max(8, Math.floor(width * 0.012));
	const gutters: { a: number; b: number }[] = [];
	let inGutter = false;
	let start = 0;
	for (let x = 0; x < width; x++) {
		const low = (smooth[x] ?? 0) < threshold;
		if (low && !inGutter) {
			inGutter = true;
			start = x;
		} else if (!low && inGutter) {
			inGutter = false;
			if (x - start >= minGutter) gutters.push({ a: start, b: x });
		}
	}
	if (inGutter && width - start >= minGutter) gutters.push({ a: start, b: width });

	const bands: ColumnSpan[] = [];
	let cursor = 0;
	for (const g of gutters) {
		if (g.a > cursor) bands.push({ x0: cursor, x1: g.a });
		cursor = g.b;
	}
	if (cursor < width) bands.push({ x0: cursor, x1: width });

	const minBand = Math.floor(width * 0.12);
	const columns = bands.filter((b) => b.x1 - b.x0 >= minBand);
	if (columns.length < 2 || columns.length > 3) return halfSpans(width, overlapRatio);

	const overlap = Math.floor(width * overlapRatio);
	return columns.map((b, i) => ({
		x0: Math.max(0, b.x0 - (i > 0 ? overlap : 0)),
		x1: Math.min(width, b.x1 + (i < columns.length - 1 ? overlap : 0))
	}));
}
