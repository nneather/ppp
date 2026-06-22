import { describe, expect, it } from 'vitest';
import { buildConsultationLines } from './consultation-lines';

describe('buildConsultationLines', () => {
	const period = { periodStart: '2026-06-01', periodEnd: '2026-06-30' };

	it('by_rate collapses all hours per rate across the full period', () => {
		const lines = buildConsultationLines({
			entries: [
				{ date: '2026-06-03', hours: 2, rate: 100, description: null },
				{ date: '2026-06-20', hours: 3, rate: 100, description: null }
			],
			grouping: 'by_rate',
			...period
		});
		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatchObject({
			description: 'Consultation Services',
			quantity: 5,
			unit_price: 100,
			total: 500,
			start_date: '2026-06-01',
			end_date: '2026-06-30'
		});
	});

	it('by_rate splits lines when rates differ', () => {
		const lines = buildConsultationLines({
			entries: [
				{ date: '2026-06-03', hours: 2, rate: 100, description: null },
				{ date: '2026-06-04', hours: 1, rate: 150, description: null }
			],
			grouping: 'by_rate',
			...period
		});
		expect(lines).toHaveLength(2);
		expect(lines.map((l) => l.unit_price).sort()).toEqual([100, 150]);
	});

	it('weekly groups entries in the same Mon–Sun week', () => {
		const lines = buildConsultationLines({
			entries: [
				{ date: '2026-06-02', hours: 2, rate: 100, description: null },
				{ date: '2026-06-04', hours: 1, rate: 100, description: null },
				{ date: '2026-06-10', hours: 4, rate: 100, description: null }
			],
			grouping: 'weekly',
			...period
		});
		expect(lines).toHaveLength(2);
		expect(lines[0]).toMatchObject({
			quantity: 3,
			start_date: '2026-06-01',
			end_date: '2026-06-07'
		});
		expect(lines[1]).toMatchObject({
			quantity: 4,
			start_date: '2026-06-08',
			end_date: '2026-06-14'
		});
	});

	it('monthly groups entries in the same calendar month', () => {
		const lines = buildConsultationLines({
			entries: [
				{ date: '2026-06-03', hours: 2, rate: 100, description: null },
				{ date: '2026-06-25', hours: 3, rate: 100, description: null },
				{ date: '2026-07-02', hours: 1, rate: 100, description: null }
			],
			grouping: 'monthly',
			periodStart: '2026-06-01',
			periodEnd: '2026-07-31'
		});
		expect(lines).toHaveLength(2);
		expect(lines[0]).toMatchObject({
			quantity: 5,
			start_date: '2026-06-01',
			end_date: '2026-06-30'
		});
		expect(lines[1]).toMatchObject({
			quantity: 1,
			start_date: '2026-07-01',
			end_date: '2026-07-31'
		});
	});

	it('per_entry emits one line per entry with description fallback', () => {
		const lines = buildConsultationLines({
			entries: [
				{ date: '2026-06-03', hours: 2, rate: 100, description: 'HeLOS sprint' },
				{ date: '2026-06-04', hours: 1, rate: 100, description: null }
			],
			grouping: 'per_entry',
			...period
		});
		expect(lines).toHaveLength(2);
		expect(lines[0].description).toBe('HeLOS sprint');
		expect(lines[1].description).toBe('Consultation Services');
		expect(lines[0].start_date).toBe('2026-06-03');
		expect(lines[0].end_date).toBe('2026-06-03');
	});

	it('returns empty array for no entries', () => {
		expect(
			buildConsultationLines({
				entries: [],
				grouping: 'weekly',
				...period
			})
		).toEqual([]);
	});
});
