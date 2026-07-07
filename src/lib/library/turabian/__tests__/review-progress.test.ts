import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	formatSprintElapsed,
	isSprintComplete,
	markMilestonesShown,
	milestoneKeysFor,
	milestoneLabel,
	readShownMilestones,
	readSprint,
	recordSprintClear,
	recordSprintSkip,
	startSprint,
	endSprint
} from '../review-progress';

/** Minimal in-memory localStorage so the guarded helpers run under node. */
function installFakeLocalStorage() {
	const store = new Map<string, string>();
	const fake = {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, String(v)),
		removeItem: (k: string) => void store.delete(k),
		clear: () => void store.clear(),
		key: (i: number) => [...store.keys()][i] ?? null,
		get length() {
			return store.size;
		}
	};
	Object.defineProperty(globalThis, 'localStorage', {
		value: fake,
		configurable: true,
		writable: true
	});
}

function removeFakeLocalStorage() {
	delete (globalThis as { localStorage?: unknown }).localStorage;
}

describe('milestoneKeysFor (pure)', () => {
	it('returns nothing before the first threshold', () => {
		expect(
			milestoneKeysFor({ slice: 'critical', cleared: 10, denominator: 265, lifetime: 50 })
		).toEqual([]);
	});

	it('accumulates slice thresholds as the burndown crosses them', () => {
		expect(
			milestoneKeysFor({ slice: 'critical', cleared: 140, denominator: 265, lifetime: 0 })
		).toEqual(['slice:critical:25', 'slice:critical:50']);
		expect(
			milestoneKeysFor({ slice: 'backlog', cleared: 1020, denominator: 1020, lifetime: 0 })
		).toEqual([
			'slice:backlog:25',
			'slice:backlog:50',
			'slice:backlog:75',
			'slice:backlog:100'
		]);
	});

	it('emits every lifetime step reached', () => {
		expect(
			milestoneKeysFor({ slice: 'backlog', cleared: 0, denominator: 1020, lifetime: 305 })
		).toEqual(['lifetime:100', 'lifetime:200', 'lifetime:300']);
	});

	it('guards zero denominators', () => {
		expect(milestoneKeysFor({ slice: 'backlog', cleared: 5, denominator: 0, lifetime: 0 })).toEqual(
			[]
		);
	});
});

describe('milestoneLabel', () => {
	it('labels slice percents with positive framing', () => {
		const half = milestoneLabel('slice:critical:50');
		expect(half.title).toContain('Half');
		expect(half.title).toContain('Citation Critical');
		const done = milestoneLabel('slice:backlog:100');
		expect(done.title).toContain('cleared');
	});

	it('labels lifetime steps', () => {
		expect(milestoneLabel('lifetime:300').title).toContain('300');
	});
});

describe('formatSprintElapsed', () => {
	it('formats seconds and minutes', () => {
		expect(formatSprintElapsed(58_000)).toBe('58s');
		expect(formatSprintElapsed(272_000)).toBe('4m 32s');
		expect(formatSprintElapsed(-5)).toBe('0s');
	});
});

describe('sprint state (fake localStorage)', () => {
	beforeEach(() => installFakeLocalStorage());
	afterEach(() => removeFakeLocalStorage());

	it('starts, records, completes, ends', () => {
		expect(readSprint()).toBeNull();
		startSprint(5, 'critical');
		let s = readSprint();
		expect(s?.target).toBe(5);
		expect(s?.deck).toBe('critical');

		for (let i = 0; i < 4; i++) s = recordSprintClear();
		expect(s?.cleared).toBe(4);
		expect(isSprintComplete(s)).toBe(false);

		s = recordSprintSkip();
		expect(s?.skipped).toBe(1);
		expect(s?.cleared).toBe(4);

		s = recordSprintClear();
		expect(isSprintComplete(s)).toBe(true);

		endSprint();
		expect(readSprint()).toBeNull();
	});

	it('free-flow sprints (null target) never complete', () => {
		startSprint(null, 'backlog');
		const s = recordSprintClear();
		expect(isSprintComplete(s)).toBe(false);
	});

	it('records shown milestones once', () => {
		expect(readShownMilestones().size).toBe(0);
		markMilestonesShown(['slice:critical:25', 'lifetime:100']);
		markMilestonesShown(['slice:critical:25']);
		const shown = readShownMilestones();
		expect(shown.size).toBe(2);
		expect(shown.has('lifetime:100')).toBe(true);
	});
});

describe('sprint state (no localStorage)', () => {
	it('all helpers degrade to null/no-op', () => {
		removeFakeLocalStorage();
		expect(readSprint()).toBeNull();
		expect(recordSprintClear()).toBeNull();
		expect(recordSprintSkip()).toBeNull();
		expect(readShownMilestones().size).toBe(0);
	});
});
