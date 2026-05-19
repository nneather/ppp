/**
 * Run async tasks with a fixed concurrency limit (used by OCR file pipelines).
 */
export async function runWithConcurrency<T>(
	items: T[],
	concurrency: number,
	fn: (item: T, index: number) => Promise<void>
): Promise<void> {
	if (items.length === 0) return;
	let next = 0;
	const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
		while (next < items.length) {
			const i = next++;
			await fn(items[i], i);
		}
	});
	await Promise.all(workers);
}
