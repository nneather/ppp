/** Weekly check-in progress display helpers. */

export const DEFAULT_PROGRESS_MAX = 100;

export function isProgressEnabled(progressValue: number | null | undefined): boolean {
	return progressValue != null;
}

export function formatProgressLabel(value: number, max: number): string {
	if (max === 100) return `${value}/100%`;
	return `${value}/${max}`;
}

/** 0–100 for native progress element (value/max is 0–max). */
export function progressPercent(value: number, max: number): number {
	if (max <= 0) return 0;
	const pct = (value / max) * 100;
	return Math.min(100, Math.max(0, pct));
}

export function parseProgressMax(raw: unknown): number | null {
	if (raw === null || raw === undefined || raw === '') return null;
	const n = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isInteger(n) || n < 1) return null;
	return n;
}

export function parseProgressValue(raw: unknown, max: number): number | null {
	if (raw === null || raw === undefined || raw === '') return null;
	const n = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isInteger(n) || n < 0 || n > max) return null;
	return n;
}
