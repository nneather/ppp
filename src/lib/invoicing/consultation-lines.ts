import {
	calendarMonthContainingYmd,
	mondaySundayWeekContainingYmd
} from '$lib/invoicing/chicago-date';
import type { BillingCadence, ConsultationGrouping } from '$lib/types/invoicing';

export const DEFAULT_SERVICE_LABEL = 'Consultation Services';

export type ConsultationEntryInput = {
	date: string;
	hours: number;
	rate: number;
	description: string | null;
};

export type ConsultationLineOutput = {
	description: string;
	quantity: number;
	unit_price: number;
	total: number;
	is_one_off: false;
	start_date: string;
	end_date: string;
};

function roundMoney(n: number): number {
	return Math.round(n * 100) / 100;
}

type Bucket = {
	start_date: string;
	end_date: string;
	rate: number;
	hours: number;
};

function pushBucket(map: Map<string, Bucket>, key: string, bucket: Bucket, hours: number): void {
	const prev = map.get(key);
	if (prev) {
		prev.hours += hours;
	} else {
		map.set(key, { ...bucket, hours });
	}
}

function bucketsToLines(
	map: Map<string, Bucket>,
	serviceLabel: string
): ConsultationLineOutput[] {
	const lines: ConsultationLineOutput[] = [];
	for (const b of map.values()) {
		const qty = roundMoney(b.hours);
		const unit = roundMoney(b.rate);
		lines.push({
			description: serviceLabel,
			quantity: qty,
			unit_price: unit,
			total: roundMoney(qty * unit),
			is_one_off: false,
			start_date: b.start_date,
			end_date: b.end_date
		});
	}
	lines.sort((a, b) => {
		if (a.start_date !== b.start_date) return a.start_date < b.start_date ? -1 : 1;
		return a.unit_price - b.unit_price;
	});
	return lines;
}

export function buildConsultationLines(params: {
	entries: ConsultationEntryInput[];
	grouping: ConsultationGrouping;
	periodStart: string;
	periodEnd: string;
	serviceLabel?: string;
}): ConsultationLineOutput[] {
	const { entries, grouping, periodStart, periodEnd } = params;
	const serviceLabel = params.serviceLabel?.trim() || DEFAULT_SERVICE_LABEL;

	if (entries.length === 0) return [];

	if (grouping === 'per_entry') {
		const lines: ConsultationLineOutput[] = entries.map((e) => {
			const qty = roundMoney(e.hours);
			const unit = roundMoney(e.rate);
			const desc = e.description?.trim() || serviceLabel;
			return {
				description: desc,
				quantity: qty,
				unit_price: unit,
				total: roundMoney(qty * unit),
				is_one_off: false,
				start_date: e.date,
				end_date: e.date
			};
		});
		lines.sort((a, b) => {
			if (a.start_date !== b.start_date) return a.start_date < b.start_date ? -1 : 1;
			return a.unit_price - b.unit_price;
		});
		return lines;
	}

	const map = new Map<string, Bucket>();

	for (const e of entries) {
		const rate = Number(e.rate);
		const hours = Number(e.hours);
		const rateKey = rate.toFixed(4);

		if (grouping === 'by_rate') {
			const key = rateKey;
			pushBucket(map, key, { start_date: periodStart, end_date: periodEnd, rate, hours: 0 }, hours);
			continue;
		}

		if (grouping === 'weekly') {
			const week = mondaySundayWeekContainingYmd(e.date);
			const key = `${week.start}|${week.end}|${rateKey}`;
			pushBucket(
				map,
				key,
				{ start_date: week.start, end_date: week.end, rate, hours: 0 },
				hours
			);
			continue;
		}

		if (grouping === 'monthly') {
			const month = calendarMonthContainingYmd(e.date);
			const key = `${month.start}|${month.end}|${rateKey}`;
			pushBucket(
				map,
				key,
				{ start_date: month.start, end_date: month.end, rate, hours: 0 },
				hours
			);
		}
	}

	return bucketsToLines(map, serviceLabel);
}

export const BILLING_CADENCE_LABELS: Record<BillingCadence, string> = {
	weekly: 'Weekly',
	monthly: 'Monthly'
};

export const CONSULTATION_GROUPING_LABELS: Record<ConsultationGrouping, string> = {
	by_rate: 'By rate (whole period)',
	weekly: 'By week',
	monthly: 'By month',
	per_entry: 'Per time entry'
};
