import { describe, expect, it } from 'vitest';
import {
	lineTotalFromHoursRate,
	oneOffLedgerFromAmount,
	oneOffLineFromLedgerEntry,
	parseMoneyAmount,
	parseOneOffsJson
} from './one-off';

describe('parseMoneyAmount', () => {
	it('parses dollars and commas', () => {
		expect(parseMoneyAmount('1600')).toBe(1600);
		expect(parseMoneyAmount('$1,600.50')).toBe(1600.5);
		expect(parseMoneyAmount('0')).toBe(0);
	});

	it('rejects invalid', () => {
		expect(parseMoneyAmount('')).toBeNull();
		expect(parseMoneyAmount('abc')).toBeNull();
		expect(parseMoneyAmount('-5')).toBeNull();
	});
});

describe('oneOffLedgerFromAmount', () => {
	it('stores qty 1 and rate = amount', () => {
		expect(oneOffLedgerFromAmount(1600)).toEqual({ hours: 1, rate: 1600 });
	});
});

describe('lineTotalFromHoursRate', () => {
	it('rounds money', () => {
		expect(lineTotalFromHoursRate(1, 1600)).toBe(1600);
		expect(lineTotalFromHoursRate(2.5, 100)).toBe(250);
	});
});

describe('oneOffLineFromLedgerEntry', () => {
	it('maps ledger row to invoice line', () => {
		expect(
			oneOffLineFromLedgerEntry({
				date: '2026-08-10',
				hours: 1,
				rate: 1600,
				description: 'City Tour Dinner Trip'
			})
		).toEqual({
			description: 'City Tour Dinner Trip',
			quantity: 1,
			unit_price: 1600,
			total: 1600,
			is_one_off: true,
			start_date: '2026-08-10',
			end_date: '2026-08-10'
		});
	});
});

describe('parseOneOffsJson', () => {
	it('parses valid lines', () => {
		const r = parseOneOffsJson(
			JSON.stringify([
				{ description: 'Fee', quantity: 1, unit_price: 100, date: '2026-08-01' }
			]),
			'2026-08-15'
		);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.lines).toHaveLength(1);
			expect(r.lines[0].description).toBe('Fee');
		}
	});

	it('defaults date from period end', () => {
		const r = parseOneOffsJson(
			JSON.stringify([{ description: 'Fee', quantity: 1, unit_price: 50 }]),
			'2026-08-15'
		);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.lines[0].date).toBe('2026-08-15');
	});
});
