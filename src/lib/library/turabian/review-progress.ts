import type { ReviewSlice } from './types';

export const REVIEW_PROGRESS_KEYS = {
	lifetimeCleared: 'library.review.lifetime_cleared',
	today: 'library.review.today',
	lastSlice: 'library.review.last_slice',
	lifetimeCritical: 'library.review.lifetime_critical',
	lifetimeBacklog: 'library.review.lifetime_backlog'
} as const;

export type ReviewTodayState = { date: string; count: number };

function localYmd(d = new Date()): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/** Sept 1, 2026 local — backlog becomes default slice. */
export function isBacklogDefaultSlice(d = new Date()): boolean {
	return d >= new Date(2026, 8, 1);
}

export function defaultReviewSlice(d = new Date()): ReviewSlice {
	return isBacklogDefaultSlice(d) ? 'backlog' : 'critical';
}

export function readReviewToday(): ReviewTodayState {
	if (typeof localStorage === 'undefined') return { date: localYmd(), count: 0 };
	try {
		const raw = localStorage.getItem(REVIEW_PROGRESS_KEYS.today);
		if (!raw) return { date: localYmd(), count: 0 };
		const parsed = JSON.parse(raw) as ReviewTodayState;
		if (parsed.date !== localYmd()) return { date: localYmd(), count: 0 };
		return { date: parsed.date, count: Number(parsed.count) || 0 };
	} catch {
		return { date: localYmd(), count: 0 };
	}
}

export function incrementReviewProgress(slice: ReviewSlice): void {
	if (typeof localStorage === 'undefined') return;
	const today = readReviewToday();
	const nextToday = { date: localYmd(), count: today.count + 1 };
	localStorage.setItem(REVIEW_PROGRESS_KEYS.today, JSON.stringify(nextToday));

	const lifetimeKey =
		slice === 'critical'
			? REVIEW_PROGRESS_KEYS.lifetimeCritical
			: REVIEW_PROGRESS_KEYS.lifetimeBacklog;
	const prev = Number(localStorage.getItem(lifetimeKey) ?? '0') || 0;
	localStorage.setItem(lifetimeKey, String(prev + 1));

	const allPrev = Number(localStorage.getItem(REVIEW_PROGRESS_KEYS.lifetimeCleared) ?? '0') || 0;
	localStorage.setItem(REVIEW_PROGRESS_KEYS.lifetimeCleared, String(allPrev + 1));
	localStorage.setItem(REVIEW_PROGRESS_KEYS.lastSlice, slice);
}

export function readLifetimeCleared(slice: ReviewSlice): number {
	if (typeof localStorage === 'undefined') return 0;
	const key =
		slice === 'critical'
			? REVIEW_PROGRESS_KEYS.lifetimeCritical
			: REVIEW_PROGRESS_KEYS.lifetimeBacklog;
	return Number(localStorage.getItem(key) ?? '0') || 0;
}

/** Denominator targets for burndown UI (tracker estimates). */
export const SLICE_DENOMINATORS: Record<ReviewSlice, number> = {
	critical: 265,
	backlog: 1020
};
