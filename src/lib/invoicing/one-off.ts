/**
 * One-off charge helpers — ledger rows use hours=qty, rate=unit_price, is_one_off=true.
 */
import { utcNoonFromYmd } from './chicago-date';
import type { OneOffLineInput } from '$lib/types/invoicing';

export function roundMoney(n: number): number {
	return Math.round(n * 100) / 100;
}

/** Parse a positive money amount from form text (qty or unit price). */
export function parseMoneyAmount(raw: string): number | null {
	const t = raw.trim().replace(/[$,]/g, '').replace(',', '.');
	if (!t) return null;
	const n = Number(t);
	if (!Number.isFinite(n) || n < 0 || n > 9999999.99) return null;
	return roundMoney(n);
}

/** Hours-sheet one-off: quantity is always 1; amount → rate. */
export function oneOffLedgerFromAmount(amount: number): { hours: number; rate: number } {
	return { hours: 1, rate: roundMoney(amount) };
}

export function lineTotalFromHoursRate(hours: number, rate: number): number {
	return roundMoney((Number(hours) || 0) * (Number(rate) || 0));
}

export function parseOneOffsJson(
	raw: string | null,
	defaultChargeDate: string
): { ok: true; lines: OneOffLineInput[] } | { ok: false; message: string } {
	if (raw == null || raw === '') return { ok: true, lines: [] };
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { ok: false, message: 'Invalid one-off line items JSON.' };
	}
	if (!Array.isArray(parsed)) {
		return { ok: false, message: 'One-off line items must be a JSON array.' };
	}
	const lines: OneOffLineInput[] = [];
	for (const item of parsed) {
		if (item == null || typeof item !== 'object') {
			return { ok: false, message: 'Each one-off line must be an object.' };
		}
		const o = item as Record<string, unknown>;
		const description = String(o.description ?? '').trim();
		const quantity = Number(o.quantity);
		const unit_price = Number(o.unit_price);
		const dateRaw = String(o.date ?? '').trim();
		let date: string;
		if (dateRaw) {
			if (!utcNoonFromYmd(dateRaw)) {
				return { ok: false, message: 'Each one-off line needs a valid charge date.' };
			}
			date = dateRaw;
		} else if (utcNoonFromYmd(defaultChargeDate)) {
			date = defaultChargeDate;
		} else {
			return { ok: false, message: 'Each one-off line needs a valid charge date.' };
		}
		if (!description) {
			return { ok: false, message: 'Each one-off line needs a description.' };
		}
		if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 99999) {
			return { ok: false, message: 'Each one-off line needs a valid quantity.' };
		}
		if (!Number.isFinite(unit_price) || unit_price < 0) {
			return { ok: false, message: 'Each one-off line needs a valid unit price.' };
		}
		lines.push({
			description,
			quantity: roundMoney(quantity),
			unit_price: roundMoney(unit_price),
			date
		});
	}
	return { ok: true, lines };
}

/** Invoice line shape from an existing one-off time_entries row. */
export function oneOffLineFromLedgerEntry(e: {
	date: string;
	hours: number;
	rate: number;
	description: string | null;
}): {
	description: string;
	quantity: number;
	unit_price: number;
	total: number;
	is_one_off: true;
	start_date: string;
	end_date: string;
} {
	const quantity = roundMoney(Number(e.hours) || 0);
	const unit_price = roundMoney(Number(e.rate) || 0);
	return {
		description: e.description?.trim() || 'One-off charge',
		quantity,
		unit_price,
		total: roundMoney(quantity * unit_price),
		is_one_off: true,
		start_date: e.date,
		end_date: e.date
	};
}
