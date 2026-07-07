import type { ReviewSlice } from './types';

export const REVIEW_PROGRESS_KEYS = {
	lifetimeCleared: 'library.review.lifetime_cleared',
	today: 'library.review.today',
	lastSlice: 'library.review.last_slice',
	lifetimeCritical: 'library.review.lifetime_critical',
	lifetimeBacklog: 'library.review.lifetime_backlog',
	sprint: 'library.review.sprint',
	milestones: 'library.review.milestones'
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

export function readLifetimeClearedTotal(): number {
	if (typeof localStorage === 'undefined') return 0;
	return Number(localStorage.getItem(REVIEW_PROGRESS_KEYS.lifetimeCleared) ?? '0') || 0;
}

/** Denominator targets for burndown UI (tracker estimates). */
export const SLICE_DENOMINATORS: Record<ReviewSlice, number> = {
	critical: 265,
	backlog: 1020
};

// ---------------------------------------------------------------------------
// Sprints — pick a size, clear it, get a summary. Abandoning is silent (the
// state just gets overwritten or ended); there is no failure state by design.
// ---------------------------------------------------------------------------

export const SPRINT_CHOICES = [5, 10, 25] as const;

export type SprintState = {
	/** null = free flow (count up, no finish line). */
	target: number | null;
	cleared: number;
	skipped: number;
	/** Epoch ms. */
	startedAt: number;
	/** Deck key at sprint start (informational — decks can change mid-sprint). */
	deck: string;
};

export function readSprint(): SprintState | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(REVIEW_PROGRESS_KEYS.sprint);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as SprintState;
		if (typeof parsed.startedAt !== 'number' || typeof parsed.cleared !== 'number') return null;
		return {
			target: typeof parsed.target === 'number' ? parsed.target : null,
			cleared: parsed.cleared || 0,
			skipped: Number(parsed.skipped) || 0,
			startedAt: parsed.startedAt,
			deck: typeof parsed.deck === 'string' ? parsed.deck : ''
		};
	} catch {
		return null;
	}
}

function writeSprint(state: SprintState | null): void {
	if (typeof localStorage === 'undefined') return;
	if (state === null) localStorage.removeItem(REVIEW_PROGRESS_KEYS.sprint);
	else localStorage.setItem(REVIEW_PROGRESS_KEYS.sprint, JSON.stringify(state));
}

export function startSprint(target: number | null, deck: string): SprintState {
	const state: SprintState = { target, cleared: 0, skipped: 0, startedAt: Date.now(), deck };
	writeSprint(state);
	return state;
}

export function recordSprintClear(): SprintState | null {
	const state = readSprint();
	if (!state) return null;
	const next = { ...state, cleared: state.cleared + 1 };
	writeSprint(next);
	return next;
}

export function recordSprintSkip(): SprintState | null {
	const state = readSprint();
	if (!state) return null;
	const next = { ...state, skipped: state.skipped + 1 };
	writeSprint(next);
	return next;
}

export function endSprint(): void {
	writeSprint(null);
}

export function isSprintComplete(state: SprintState | null): boolean {
	return state !== null && state.target !== null && state.cleared >= state.target;
}

/** "4m 32s" / "58s" — end-of-sprint summary elapsed label. */
export function formatSprintElapsed(ms: number): string {
	const totalSec = Math.max(0, Math.round(ms / 1000));
	const min = Math.floor(totalSec / 60);
	const sec = totalSec % 60;
	if (min === 0) return `${sec}s`;
	return `${min}m ${sec}s`;
}

// ---------------------------------------------------------------------------
// Milestones — one-time interstitials at slice-percent thresholds and every
// 100 lifetime clears. Positive framing only; a shown-set in localStorage
// guarantees each fires once. Recoverable by design: no dates, no resets.
// ---------------------------------------------------------------------------

export const SLICE_MILESTONE_PERCENTS = [25, 50, 75, 100] as const;
export const LIFETIME_MILESTONE_STEP = 100;

/**
 * Pure: every milestone key the given progress has reached. The caller
 * subtracts the already-shown set (`readShownMilestones`) and celebrates the
 * rest. Keys: `slice:critical:50`, `lifetime:300`, …
 */
export function milestoneKeysFor(args: {
	slice: ReviewSlice;
	cleared: number;
	denominator: number;
	lifetime: number;
}): string[] {
	const out: string[] = [];
	if (args.denominator > 0 && args.cleared > 0) {
		const pct = (args.cleared / args.denominator) * 100;
		for (const p of SLICE_MILESTONE_PERCENTS) {
			if (pct >= p) out.push(`slice:${args.slice}:${p}`);
		}
	}
	if (args.lifetime >= LIFETIME_MILESTONE_STEP) {
		for (
			let step = LIFETIME_MILESTONE_STEP;
			step <= args.lifetime;
			step += LIFETIME_MILESTONE_STEP
		) {
			out.push(`lifetime:${step}`);
		}
	}
	return out;
}

/** Human copy for a milestone key. Positive framing only — never "X to go". */
export function milestoneLabel(key: string): { title: string; subtitle: string } {
	const sliceMatch = key.match(/^slice:(critical|backlog):(\d+)$/);
	if (sliceMatch) {
		const sliceLabel = sliceMatch[1] === 'critical' ? 'Citation Critical' : 'the backlog';
		const pct = Number(sliceMatch[2]);
		if (pct >= 100) {
			return {
				title: `${sliceLabel === 'the backlog' ? 'Backlog' : sliceLabel} cleared!`,
				subtitle: 'Every book in this slice is confirmed. Extraordinary.'
			};
		}
		const word = pct === 25 ? 'A quarter' : pct === 50 ? 'Half' : 'Three quarters';
		return {
			title: `${word} of ${sliceLabel} verified`,
			subtitle: `${pct}% of the slice is citation-ready.`
		};
	}
	const lifetimeMatch = key.match(/^lifetime:(\d+)$/);
	if (lifetimeMatch) {
		return {
			title: `${Number(lifetimeMatch[1]).toLocaleString()} books reviewed`,
			subtitle: 'All-time clears across every deck.'
		};
	}
	return { title: 'Milestone reached', subtitle: key };
}

export function readShownMilestones(): Set<string> {
	if (typeof localStorage === 'undefined') return new Set();
	try {
		const raw = localStorage.getItem(REVIEW_PROGRESS_KEYS.milestones);
		if (!raw) return new Set();
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return new Set();
		return new Set(parsed.filter((k): k is string => typeof k === 'string'));
	} catch {
		return new Set();
	}
}

export function markMilestonesShown(keys: string[]): void {
	if (typeof localStorage === 'undefined' || keys.length === 0) return;
	const shown = readShownMilestones();
	for (const k of keys) shown.add(k);
	localStorage.setItem(REVIEW_PROGRESS_KEYS.milestones, JSON.stringify([...shown]));
}
