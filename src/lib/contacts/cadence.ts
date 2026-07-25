/**
 * Cadence UI units (months / years) ↔ day-equivalent storage.
 * Storage stays `cadence_days` / `profiles.contact_cadence_days_default` ([181]).
 * Convention: 1 month = 30 days, 1 year = 365 days (90d default = 3 months).
 */

import { DEFAULT_CONTACT_CADENCE_DAYS } from '$lib/types/contacts';

export const CADENCE_UNITS = ['months', 'years'] as const;
export type CadenceUnit = (typeof CADENCE_UNITS)[number];

export const DAYS_PER_CADENCE_MONTH = 30;
export const DAYS_PER_CADENCE_YEAR = 365;

export type CadenceAmountUnit = {
	amount: number;
	unit: CadenceUnit;
};

/** Convert UI amount+unit → positive day count for storage. */
export function cadenceToDays(amount: number, unit: CadenceUnit): number {
	const n = Math.floor(amount);
	if (!Number.isFinite(n) || n < 1) {
		throw new Error('Cadence amount must be a positive integer.');
	}
	if (unit === 'years') return n * DAYS_PER_CADENCE_YEAR;
	return n * DAYS_PER_CADENCE_MONTH;
}

/**
 * Best-effort reverse of cadenceToDays for form seed / display.
 * Exact year multiples → years; else exact month multiples → months;
 * else round to nearest month (min 1).
 */
export function daysToCadence(days: number | null | undefined): CadenceAmountUnit | null {
	if (days == null || !Number.isFinite(days) || days < 1) return null;
	const d = Math.floor(days);
	if (d % DAYS_PER_CADENCE_YEAR === 0) {
		return { amount: d / DAYS_PER_CADENCE_YEAR, unit: 'years' };
	}
	if (d % DAYS_PER_CADENCE_MONTH === 0) {
		return { amount: d / DAYS_PER_CADENCE_MONTH, unit: 'months' };
	}
	return {
		amount: Math.max(1, Math.round(d / DAYS_PER_CADENCE_MONTH)),
		unit: 'months'
	};
}

/** Human label: "3 months", "1 year", "90 days" (odd legacy). */
export function formatCadenceLabel(days: number): string {
	const parsed = daysToCadence(days);
	if (!parsed) return `${DEFAULT_CONTACT_CADENCE_DAYS} days`;
	const exact =
		parsed.unit === 'years'
			? parsed.amount * DAYS_PER_CADENCE_YEAR === Math.floor(days)
			: parsed.amount * DAYS_PER_CADENCE_MONTH === Math.floor(days);
	if (!exact && Math.floor(days) % DAYS_PER_CADENCE_MONTH !== 0) {
		return `${Math.floor(days)} days`;
	}
	if (parsed.unit === 'years') {
		return parsed.amount === 1 ? '1 year' : `${parsed.amount} years`;
	}
	return parsed.amount === 1 ? '1 month' : `${parsed.amount} months`;
}

export function isCadenceUnit(v: string): v is CadenceUnit {
	return (CADENCE_UNITS as readonly string[]).includes(v);
}
