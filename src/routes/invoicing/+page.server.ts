import { fail, redirect } from '@sveltejs/kit';
import {
	addDaysYmd,
	calendarMonthContainingYmd,
	mondaySundayWeekContainingYmd,
	utcNoonFromYmd,
	ymdFromUtcNoon,
	ymdInChicago
} from '$lib/invoicing/chicago-date';
import { parseHoursInput, snapHoursToQuarter } from '$lib/invoicing/hours';
import {
	oneOffLedgerFromAmount,
	parseMoneyAmount
} from '$lib/invoicing/one-off';
import type { Actions, PageServerLoad } from './$types';
import type { ClientOption, PeriodView, TimeEntryRow, UnbilledCount } from '$lib/types/invoicing';
import { parseBillingCadence, parseConsultationGrouping } from '$lib/types/invoicing';
export type { ClientOption, PeriodView, TimeEntryRow, UnbilledCount } from '$lib/types/invoicing';

function periodBounds(
	view: PeriodView,
	anchorYMD: string
): { period_start: string; period_end: string; anchor: string } {
	const mid = utcNoonFromYmd(anchorYMD);
	const anchor = mid ? anchorYMD : ymdInChicago();

	if (view === 'day') {
		return { period_start: anchor, period_end: anchor, anchor };
	}

	if (view === 'month') {
		const m = calendarMonthContainingYmd(anchor);
		return { period_start: m.start, period_end: m.end, anchor };
	}

	const w = mondaySundayWeekContainingYmd(anchor);
	return { period_start: w.start, period_end: w.end, anchor };
}

function shiftAnchor(view: PeriodView, anchorYMD: string, delta: -1 | 1): string {
	const mid = utcNoonFromYmd(anchorYMD) ?? utcNoonFromYmd(ymdInChicago())!;
	if (view === 'day') {
		return addDaysYmd(ymdFromUtcNoon(mid), delta) ?? ymdFromUtcNoon(mid);
	}
	if (view === 'week') {
		return addDaysYmd(ymdFromUtcNoon(mid), 7 * delta) ?? ymdFromUtcNoon(mid);
	}
	const next = new Date(mid);
	next.setUTCMonth(next.getUTCMonth() + delta);
	return ymdFromUtcNoon(next);
}

function parseView(v: string | null): PeriodView {
	if (v === 'day' || v === 'month') return v;
	return 'week';
}

function isValidYmd(s: string): boolean {
	return utcNoonFromYmd(s) !== null;
}

export const load: PageServerLoad = async ({ url, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const view = parseView(url.searchParams.get('view'));
	const dateParam = url.searchParams.get('date');
	const anchor = dateParam && isValidYmd(dateParam) ? dateParam : ymdInChicago();
	const { period_start, period_end } = periodBounds(view, anchor);

	const supabase = locals.supabase;

	const [clientsRes, entriesRes, unbilledRes] = await Promise.all([
		supabase
			.from('clients')
			.select('id, name, billing_cadence, consultation_grouping')
			.is('deleted_at', null)
			.order('sort_rank', { ascending: true, nullsFirst: false })
			.order('name', { ascending: true }),
		supabase
			.from('time_entries')
			.select(
				`
				id,
				client_id,
				date,
				hours,
				rate,
				description,
				billable,
				invoice_id,
				is_one_off,
				created_at,
				clients!inner ( name )
			`
			)
			.is('deleted_at', null)
			.gte('date', period_start)
			.lte('date', period_end)
			.order('date', { ascending: false })
			.order('created_at', { ascending: false }),
		supabase.rpc('invoicing_unbilled_counts')
	]);

	if (clientsRes.error) {
		console.error(clientsRes.error);
		return {
			view,
			anchor,
			period_start,
			period_end,
			prevAnchor: shiftAnchor(view, anchor, -1),
			nextAnchor: shiftAnchor(view, anchor, 1),
			clients: [] as ClientOption[],
			entries: [] as TimeEntryRow[],
			unbilled: [] as UnbilledCount[],
			error: 'Could not load clients.'
		};
	}

	const clients: ClientOption[] = (clientsRes.data ?? []).map((c) => ({
		id: c.id,
		name: c.name,
		billing_cadence: parseBillingCadence(c.billing_cadence),
		consultation_grouping: parseConsultationGrouping(c.consultation_grouping)
	}));

	if (entriesRes.error) {
		console.error(entriesRes.error);
		return {
			view,
			anchor,
			period_start,
			period_end,
			prevAnchor: shiftAnchor(view, anchor, -1),
			nextAnchor: shiftAnchor(view, anchor, 1),
			clients,
			entries: [] as TimeEntryRow[],
			unbilled: [] as UnbilledCount[],
			error: 'Could not load time entries.'
		};
	}

	const rows = entriesRes.data ?? [];
	const entries: TimeEntryRow[] = rows.map((row: Record<string, unknown>) => {
		const clientsRel = row.clients as { name: string } | { name: string }[];
		const name = Array.isArray(clientsRel) ? clientsRel[0]?.name : clientsRel?.name;
		return {
			id: row.id as string,
			client_id: row.client_id as string,
			client_name: name ?? 'Unknown',
			date: row.date as string,
			hours: Number(row.hours),
			rate: Number(row.rate),
			description: (row.description as string | null) ?? null,
			billable: Boolean(row.billable),
			invoice_id: (row.invoice_id as string | null) ?? null,
			is_one_off: Boolean(row.is_one_off),
			created_at: row.created_at as string
		};
	});

	if (unbilledRes.error) {
		console.error(unbilledRes.error);
	}

	const unbilledRows = unbilledRes.data ?? [];
	const unbilled: UnbilledCount[] = unbilledRows.map(
		(row: {
			client_id: string;
			client_name: string;
			entry_count: number;
			hours?: number;
			amount?: number;
		}) => ({
			client_id: row.client_id,
			client_name: row.client_name,
			count: Number(row.entry_count),
			hours: row.hours != null ? Number(row.hours) : undefined,
			amount: row.amount != null ? Number(row.amount) : undefined
		})
	);

	return {
		view,
		anchor,
		period_start,
		period_end,
		prevAnchor: shiftAnchor(view, anchor, -1),
		nextAnchor: shiftAnchor(view, anchor, 1),
		clients,
		entries,
		unbilled,
		error: null as string | null
	};
};

async function lookupRate(
	supabase: import('@supabase/supabase-js').SupabaseClient,
	clientId: string,
	entryDate: string
): Promise<{ ok: true; rate: number } | { ok: false; message: string }> {
	const { data, error } = await supabase
		.from('client_rates')
		.select('rate')
		.eq('client_id', clientId)
		.lte('effective_from', entryDate)
		.or(`effective_to.is.null,effective_to.gte.${entryDate}`)
		.is('deleted_at', null)
		.order('effective_from', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (error) {
		console.error(error);
		return {
			ok: false,
			message: `Rate lookup failed: ${error.message ?? 'unknown error'}`
		};
	}
	if (!data) {
		return {
			ok: false,
			message: 'No active rate for this client on the selected date.'
		};
	}
	return { ok: true, rate: Number(data.rate) };
}

function parseHours(raw: FormDataEntryValue | null): number | null {
	if (raw == null || raw === '') return null;
	const n = parseHoursInput(String(raw));
	if (n == null) return null;
	return snapHoursToQuarter(Math.round(n * 100) / 100);
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'timeEntry' as const, message: 'Unauthorized' });

		const fd = await request.formData();
		const intent = String(fd.get('intent') ?? 'save').trim();
		const entryKind = String(fd.get('entry_kind') ?? 'hours').trim();
		const client_id = String(fd.get('client_id') ?? '').trim();
		const date = String(fd.get('date') ?? '').trim();
		const descriptionRaw = String(fd.get('description') ?? '').trim();

		if (!client_id || !isValidYmd(date)) {
			return fail(400, {
				kind: 'timeEntry' as const,
				message: 'Client and valid date are required.'
			});
		}

		if (entryKind === 'one_off') {
			const description = descriptionRaw;
			if (!description) {
				return fail(400, {
					kind: 'timeEntry' as const,
					message: 'One-off charges need a description.'
				});
			}
			const amount = parseMoneyAmount(String(fd.get('amount') ?? ''));
			if (amount == null || amount <= 0) {
				return fail(400, {
					kind: 'timeEntry' as const,
					message: 'Enter a valid charge amount.'
				});
			}
			const { hours, rate } = oneOffLedgerFromAmount(amount);
			const { error } = await locals.supabase.from('time_entries').insert({
				client_id,
				date,
				hours,
				rate,
				description,
				billable: true,
				is_one_off: true,
				created_by: user.id
			});
			if (error) {
				console.error(error);
				return fail(500, {
					kind: 'timeEntry' as const,
					message: `Could not save one-off charge: ${error.message ?? 'unknown error'}`
				});
			}
			if (intent === 'save_and_new') {
				return {
					kind: 'timeEntry' as const,
					success: true as const,
					saveAndNew: true as const,
					savedDate: date,
					entryKind: 'one_off' as const
				};
			}
			return { kind: 'timeEntry' as const, success: true as const };
		}

		const hours = parseHours(fd.get('hours'));
		const description = descriptionRaw || null;
		if (hours == null) {
			return fail(400, { kind: 'timeEntry' as const, message: 'Enter a valid number of hours.' });
		}

		const rateResult = await lookupRate(locals.supabase, client_id, date);
		if (!rateResult.ok) {
			return fail(400, { kind: 'timeEntry' as const, message: rateResult.message });
		}

		const { error } = await locals.supabase.from('time_entries').insert({
			client_id,
			date,
			hours,
			rate: rateResult.rate,
			description,
			billable: true,
			is_one_off: false,
			created_by: user.id
		});

		if (error) {
			console.error(error);
			return fail(500, {
				kind: 'timeEntry' as const,
				message: `Could not save time entry: ${error.message ?? 'unknown error'}`
			});
		}

		if (intent === 'save_and_new') {
			return {
				kind: 'timeEntry' as const,
				success: true as const,
				saveAndNew: true as const,
				savedDate: date,
				entryKind: 'hours' as const
			};
		}
		return { kind: 'timeEntry' as const, success: true as const };
	},

	update: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'timeEntry' as const, message: 'Unauthorized' });

		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		const client_id = String(fd.get('client_id') ?? '').trim();
		const date = String(fd.get('date') ?? '').trim();
		const descriptionRaw = String(fd.get('description') ?? '').trim();

		if (!id || !client_id || !isValidYmd(date)) {
			return fail(400, { kind: 'timeEntry' as const, message: 'Invalid entry or missing fields.' });
		}

		const { data: existing, error: fetchErr } = await locals.supabase
			.from('time_entries')
			.select('id, client_id, date, invoice_id, rate, is_one_off')
			.eq('id', id)
			.is('deleted_at', null)
			.maybeSingle();

		if (fetchErr || !existing) {
			return fail(404, { kind: 'timeEntry' as const, message: 'Entry not found.' });
		}
		if (existing.invoice_id) {
			return fail(400, { kind: 'timeEntry' as const, message: 'Cannot edit a billed time entry.' });
		}

		if (existing.is_one_off) {
			const description = descriptionRaw;
			if (!description) {
				return fail(400, {
					kind: 'timeEntry' as const,
					message: 'One-off charges need a description.'
				});
			}
			const amount = parseMoneyAmount(String(fd.get('amount') ?? ''));
			if (amount == null || amount <= 0) {
				return fail(400, {
					kind: 'timeEntry' as const,
					message: 'Enter a valid charge amount.'
				});
			}
			const { hours, rate } = oneOffLedgerFromAmount(amount);
			const { error } = await locals.supabase
				.from('time_entries')
				.update({
					client_id,
					date,
					hours,
					rate,
					description
				})
				.eq('id', id);
			if (error) {
				console.error(error);
				return fail(500, {
					kind: 'timeEntry' as const,
					message: `Could not update one-off charge: ${error.message ?? 'unknown error'}`
				});
			}
			return { kind: 'timeEntry' as const, success: true as const };
		}

		const hours = parseHours(fd.get('hours'));
		const description = descriptionRaw || null;
		if (hours == null) {
			return fail(400, { kind: 'timeEntry' as const, message: 'Enter a valid number of hours.' });
		}

		const storedRate = Number(existing.rate);
		const clientOrDateChanged = existing.client_id !== client_id || existing.date !== date;
		const needsRateRefresh =
			clientOrDateChanged || !Number.isFinite(storedRate) || storedRate <= 0;

		let rate = undefined as number | undefined;
		if (needsRateRefresh) {
			const rateResult = await lookupRate(locals.supabase, client_id, date);
			if (!rateResult.ok) {
				return fail(400, { kind: 'timeEntry' as const, message: rateResult.message });
			}
			rate = rateResult.rate;
		}

		const patch: Record<string, unknown> = {
			client_id,
			date,
			hours,
			description
		};
		if (rate !== undefined) patch.rate = rate;

		const { error } = await locals.supabase.from('time_entries').update(patch).eq('id', id);

		if (error) {
			console.error(error);
			return fail(500, {
				kind: 'timeEntry' as const,
				message: `Could not update time entry: ${error.message ?? 'unknown error'}`
			});
		}

		return { kind: 'timeEntry' as const, success: true as const };
	},

	delete: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'timeEntry' as const, message: 'Unauthorized' });

		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { kind: 'timeEntry' as const, message: 'Missing entry id.' });

		const { data: existing, error: fetchErr } = await locals.supabase
			.from('time_entries')
			.select('id, invoice_id')
			.eq('id', id)
			.is('deleted_at', null)
			.maybeSingle();

		if (fetchErr || !existing) {
			return fail(404, { kind: 'timeEntry' as const, message: 'Entry not found.' });
		}
		if (existing.invoice_id) {
			return fail(400, { kind: 'timeEntry' as const, message: 'Cannot delete a billed time entry.' });
		}

		const { error } = await locals.supabase
			.from('time_entries')
			.update({ deleted_at: new Date().toISOString() })
			.eq('id', id);

		if (error) {
			console.error(error);
			return fail(500, {
				kind: 'timeEntry' as const,
				message: `Could not delete time entry: ${error.message ?? 'unknown error'}`
			});
		}

		return { kind: 'timeEntry' as const, success: true as const };
	}
};
