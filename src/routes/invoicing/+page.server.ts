import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { ClientOption, PeriodView, TimeEntryRow, UnbilledCount } from '$lib/types/invoicing';
export type { ClientOption, PeriodView, TimeEntryRow, UnbilledCount } from '$lib/types/invoicing';

function pad2(n: number): string {
	return String(n).padStart(2, '0');
}

/** Local calendar YYYY-MM-DD */
function toYMD(d: Date): string {
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseYMD(s: string): Date | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
	if (!m) return null;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const day = Number(m[3]);
	const d = new Date(y, mo - 1, day);
	if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) return null;
	return d;
}

function todayYMD(): string {
	return toYMD(new Date());
}

function periodBounds(
	view: PeriodView,
	anchorYMD: string
): { period_start: string; period_end: string; anchor: string } {
	const anchor = parseYMD(anchorYMD) ?? new Date();
	const y = anchor.getFullYear();
	const mo = anchor.getMonth();
	const d = anchor.getDate();

	if (view === 'day') {
		const s = toYMD(new Date(y, mo, d));
		return { period_start: s, period_end: s, anchor: s };
	}

	if (view === 'month') {
		const start = toYMD(new Date(y, mo, 1));
		const end = toYMD(new Date(y, mo + 1, 0));
		return { period_start: start, period_end: end, anchor: toYMD(anchor) };
	}

	// week: Monday–Sunday containing anchor
	const day = anchor.getDay(); // 0 Sun .. 6 Sat
	const diffToMonday = (day + 6) % 7;
	const monday = new Date(y, mo, d - diffToMonday);
	const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
	return {
		period_start: toYMD(monday),
		period_end: toYMD(sunday),
		anchor: toYMD(anchor)
	};
}

function shiftAnchor(view: PeriodView, anchorYMD: string, delta: -1 | 1): string {
	const anchor = parseYMD(anchorYMD) ?? new Date();
	const y = anchor.getFullYear();
	const mo = anchor.getMonth();
	const d = anchor.getDate();

	if (view === 'day') {
		const next = new Date(y, mo, d + delta);
		return toYMD(next);
	}
	if (view === 'week') {
		const next = new Date(y, mo, d + 7 * delta);
		return toYMD(next);
	}
	const next = new Date(y, mo + delta, d);
	return toYMD(next);
}

function parseView(v: string | null): PeriodView {
	if (v === 'day' || v === 'month') return v;
	return 'week';
}

export const load: PageServerLoad = async ({ url, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const view = parseView(url.searchParams.get('view'));
	const dateParam = url.searchParams.get('date');
	const anchor = dateParam && parseYMD(dateParam) ? dateParam : todayYMD();
	const { period_start, period_end } = periodBounds(view, anchor);

	const supabase = locals.supabase;

	const [clientsRes, entriesRes, unbilledRes] = await Promise.all([
		supabase
			.from('clients')
			.select('id, name')
			.is('deleted_at', null)
			.order('created_at', { ascending: true }),
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
		supabase
			.from('time_entries')
			.select('client_id, clients!inner(name)')
			.is('deleted_at', null)
			.is('invoice_id', null)
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
		name: c.name
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

	const unbilledMap = new Map<string, { client_name: string; count: number }>();
	if (!unbilledRes.error && unbilledRes.data) {
		for (const row of unbilledRes.data) {
			const cid = row.client_id as string;
			const rel = row.clients as { name: string } | { name: string }[] | null;
			const cname = Array.isArray(rel) ? rel[0]?.name : rel?.name;
			const name = cname ?? 'Unknown';
			const prev = unbilledMap.get(cid);
			unbilledMap.set(cid, {
				client_name: name,
				count: (prev?.count ?? 0) + 1
			});
		}
	} else if (unbilledRes.error) {
		console.error(unbilledRes.error);
	}

	const unbilled: UnbilledCount[] = [...unbilledMap.entries()].map(([client_id, v]) => ({
		client_id,
		client_name: v.client_name,
		count: v.count
	}));

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
	const n = Number(String(raw).replace(',', '.'));
	if (!Number.isFinite(n) || n <= 0 || n > 99999) return null;
	return Math.round(n * 100) / 100;
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { message: 'Unauthorized' });

		const fd = await request.formData();
		const client_id = String(fd.get('client_id') ?? '').trim();
		const date = String(fd.get('date') ?? '').trim();
		const hours = parseHours(fd.get('hours'));
		const description = String(fd.get('description') ?? '').trim() || null;

		if (!client_id || !parseYMD(date)) {
			return fail(400, { message: 'Client and valid date are required.' });
		}
		if (hours == null) {
			return fail(400, { message: 'Enter a valid number of hours.' });
		}

		const rateResult = await lookupRate(locals.supabase, client_id, date);
		if (!rateResult.ok) {
			return fail(400, { message: rateResult.message });
		}

		const { error } = await locals.supabase.from('time_entries').insert({
			client_id,
			date,
			hours,
			rate: rateResult.rate,
			description,
			billable: true,
			created_by: user.id
		});

		if (error) {
			console.error(error);
			return fail(500, {
				message: `Could not save time entry: ${error.message ?? 'unknown error'}`
			});
		}

		return { success: true as const };
	},

	update: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { message: 'Unauthorized' });

		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		const client_id = String(fd.get('client_id') ?? '').trim();
		const date = String(fd.get('date') ?? '').trim();
		const hours = parseHours(fd.get('hours'));
		const description = String(fd.get('description') ?? '').trim() || null;

		if (!id || !client_id || !parseYMD(date)) {
			return fail(400, { message: 'Invalid entry or missing fields.' });
		}
		if (hours == null) {
			return fail(400, { message: 'Enter a valid number of hours.' });
		}

		const { data: existing, error: fetchErr } = await locals.supabase
			.from('time_entries')
			.select('id, client_id, date, invoice_id, rate, is_one_off')
			.eq('id', id)
			.is('deleted_at', null)
			.maybeSingle();

		if (fetchErr || !existing) {
			return fail(404, { message: 'Entry not found.' });
		}
		if (existing.invoice_id) {
			return fail(400, { message: 'Cannot edit a billed time entry.' });
		}
		if (existing.is_one_off) {
			return fail(400, { message: 'Cannot edit a one-off charge entry.' });
		}

		const storedRate = Number(existing.rate);
		const clientOrDateChanged = existing.client_id !== client_id || existing.date !== date;
		// Re-stamp rate when client/date change, or when row still has a zero
		// rate (e.g. legacy seed) so a save without changing client/date fixes it.
		const needsRateRefresh = clientOrDateChanged || !Number.isFinite(storedRate) || storedRate <= 0;

		let rate = undefined as number | undefined;
		if (needsRateRefresh) {
			const rateResult = await lookupRate(locals.supabase, client_id, date);
			if (!rateResult.ok) {
				return fail(400, { message: rateResult.message });
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
				message: `Could not update time entry: ${error.message ?? 'unknown error'}`
			});
		}

		return { success: true as const };
	},

	delete: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { message: 'Unauthorized' });

		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { message: 'Missing entry id.' });

		const { data: existing, error: fetchErr } = await locals.supabase
			.from('time_entries')
			.select('id, invoice_id, is_one_off')
			.eq('id', id)
			.is('deleted_at', null)
			.maybeSingle();

		if (fetchErr || !existing) {
			return fail(404, { message: 'Entry not found.' });
		}
		if (existing.invoice_id) {
			return fail(400, { message: 'Cannot delete a billed time entry.' });
		}
		if (existing.is_one_off) {
			return fail(400, { message: 'Cannot delete a one-off charge entry.' });
		}

		const { error } = await locals.supabase
			.from('time_entries')
			.update({ deleted_at: new Date().toISOString() })
			.eq('id', id);

		if (error) {
			console.error(error);
			return fail(500, {
				message: `Could not delete time entry: ${error.message ?? 'unknown error'}`
			});
		}

		return { success: true as const };
	}
};
