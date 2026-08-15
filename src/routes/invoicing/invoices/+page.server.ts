import { fail, redirect } from '@sveltejs/kit';
import { buildConsultationLines } from '$lib/invoicing/consultation-lines';
import { utcNoonFromYmd } from '$lib/invoicing/chicago-date';
import {
	oneOffLineFromLedgerEntry,
	parseOneOffsJson,
	roundMoney
} from '$lib/invoicing/one-off';
import type { Actions, PageServerLoad } from './$types';
import type {
	ClientOption,
	InvoiceRow,
	OneOffLineInput,
	UnbilledBounds,
	UnbilledEntryPreview,
	UnbilledCount
} from '$lib/types/invoicing';
import { parseBillingCadence, parseConsultationGrouping } from '$lib/types/invoicing';
export type {
	ClientOption,
	InvoiceRow,
	OneOffLineInput,
	UnbilledBounds,
	UnbilledEntryPreview,
	UnbilledCount
} from '$lib/types/invoicing';

function isValidYmd(s: string): boolean {
	return utcNoonFromYmd(s) !== null;
}

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;

	const [clientsRes, invoicesRes, discardedInvoicesRes, unbilledRes] = await Promise.all([
		supabase
			.from('clients')
			.select('id, name, billing_cadence, consultation_grouping')
			.is('deleted_at', null)
			.order('sort_rank', { ascending: true, nullsFirst: false })
			.order('name', { ascending: true }),
		supabase
			.from('invoices')
			.select(
				`
				id,
				client_id,
				invoice_number,
				period_start,
				period_end,
				status,
				subtotal,
				total,
				created_at,
				clients!inner ( name )
			`
			)
			.is('deleted_at', null)
			.order('created_at', { ascending: false }),
		supabase
			.from('invoices')
			.select(
				`
				id,
				client_id,
				invoice_number,
				period_start,
				period_end,
				status,
				subtotal,
				total,
				created_at,
				clients!inner ( name )
			`
			)
			.not('deleted_at', 'is', null)
			.order('created_at', { ascending: false }),
		supabase
			.from('time_entries')
			.select('client_id, date, hours, rate, is_one_off, clients!inner ( name )')
			.is('invoice_id', null)
			.is('deleted_at', null)
	]);

	if (clientsRes.error) {
		console.error(clientsRes.error);
		return {
			clients: [] as ClientOption[],
			invoices: [] as InvoiceRow[],
			unbilledBounds: [] as UnbilledBounds[],
			unbilledEntries: [] as UnbilledEntryPreview[],
			unbilledSummary: [] as UnbilledCount[],
			error: 'Could not load clients.'
		};
	}

	const clients: ClientOption[] = (clientsRes.data ?? []).map((c) => ({
		id: c.id,
		name: c.name,
		billing_cadence: parseBillingCadence(c.billing_cadence),
		consultation_grouping: parseConsultationGrouping(c.consultation_grouping)
	}));

	function aggregateUnbilled(): {
		unbilledBounds: UnbilledBounds[];
		unbilledEntries: UnbilledEntryPreview[];
		unbilledSummary: UnbilledCount[];
	} {
		const entries: UnbilledEntryPreview[] = [];
		const boundsByClient = new Map<string, { min: string; max: string }>();
		const summaryMap = new Map<string, { client_name: string; count: number }>();

		if (!unbilledRes.error && unbilledRes.data) {
			for (const raw of unbilledRes.data) {
				const row = raw as Record<string, unknown>;
				const cid = row.client_id as string;
				const date = row.date as string;
				const hours = Number(row.hours);
				const rate = Number(row.rate);
				const is_one_off = Boolean(row.is_one_off);
				entries.push({ client_id: cid, date, hours, rate, is_one_off });

				const prev = boundsByClient.get(cid);
				if (!prev) boundsByClient.set(cid, { min: date, max: date });
				else {
					if (date < prev.min) prev.min = date;
					if (date > prev.max) prev.max = date;
				}

				const rel = row.clients as { name: string } | { name: string }[] | null;
				const cname = Array.isArray(rel) ? rel[0]?.name : rel?.name;
				const name = cname ?? 'Unknown';
				const s = summaryMap.get(cid);
				if (s) s.count += 1;
				else summaryMap.set(cid, { client_name: name, count: 1 });
			}
		} else if (unbilledRes.error) {
			console.error(unbilledRes.error);
		}

		const unbilledBounds: UnbilledBounds[] = [...boundsByClient.entries()].map(
			([client_id, b]) => ({
				client_id,
				min_date: b.min,
				max_date: b.max
			})
		);

		const unbilledSummary: UnbilledCount[] = [...summaryMap.entries()].map(([client_id, v]) => ({
			client_id,
			client_name: v.client_name,
			count: v.count
		}));

		return { unbilledBounds, unbilledEntries: entries, unbilledSummary };
	}

	const { unbilledBounds, unbilledEntries, unbilledSummary } = aggregateUnbilled();

	if (invoicesRes.error) {
		console.error(invoicesRes.error);
		return {
			clients,
			invoices: [] as InvoiceRow[],
			unbilledBounds,
			unbilledEntries,
			unbilledSummary,
			error: 'Could not load invoices.'
		};
	}

	function mapInvoiceRow(row: Record<string, unknown>, status: InvoiceRow['status']): InvoiceRow {
		const rel = row.clients as { name: string } | { name: string }[] | null;
		const name = Array.isArray(rel) ? rel[0]?.name : rel?.name;
		return {
			id: row.id as string,
			client_id: row.client_id as string,
			client_name: name ?? 'Unknown',
			invoice_number: row.invoice_number as string,
			period_start: row.period_start as string,
			period_end: row.period_end as string,
			status,
			subtotal: Number(row.subtotal ?? 0),
			total: Number(row.total ?? 0),
			created_at: row.created_at as string
		};
	}

	const rows = invoicesRes.data ?? [];
	const activeInvoices: InvoiceRow[] = rows.map((row: Record<string, unknown>) =>
		mapInvoiceRow(row, row.status as InvoiceRow['status'])
	);

	if (discardedInvoicesRes.error) {
		console.error(discardedInvoicesRes.error);
	}

	const discardedRows = discardedInvoicesRes.data ?? [];
	const discardedInvoices: InvoiceRow[] = discardedRows.map((row: Record<string, unknown>) =>
		mapInvoiceRow(row, 'discarded')
	);

	const invoices: InvoiceRow[] = [...activeInvoices, ...discardedInvoices].sort((a, b) => {
		const ta = new Date(a.created_at).getTime();
		const tb = new Date(b.created_at).getTime();
		return tb - ta;
	});

	return {
		clients,
		invoices,
		unbilledBounds,
		unbilledEntries,
		unbilledSummary,
		error: null as string | null
	};
};

export const actions: Actions = {
	generate: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { message: 'Unauthorized' });

		const fd = await request.formData();
		const client_id = String(fd.get('client_id') ?? '').trim();
		const period_start = String(fd.get('period_start') ?? '').trim();
		const period_end = String(fd.get('period_end') ?? '').trim();
		const oneOffsRaw = fd.get('one_offs');
		const oneOffsParsed = parseOneOffsJson(
			typeof oneOffsRaw === 'string' ? oneOffsRaw : oneOffsRaw != null ? String(oneOffsRaw) : null,
			period_end
		);
		if (!oneOffsParsed.ok) {
			return fail(400, { message: oneOffsParsed.message });
		}

		if (!client_id || !isValidYmd(period_start) || !isValidYmd(period_end)) {
			return fail(400, { message: 'Client, period start, and period end are required.' });
		}
		if (period_start > period_end) {
			return fail(400, { message: 'Period start must be on or before period end.' });
		}

		const supabase = locals.supabase;

		const [entriesRes, clientRes] = await Promise.all([
			supabase
				.from('time_entries')
				.select('id, hours, rate, date, description, is_one_off')
				.eq('client_id', client_id)
				.gte('date', period_start)
				.lte('date', period_end)
				.is('invoice_id', null)
				.is('deleted_at', null),
			supabase
				.from('clients')
				.select('consultation_grouping')
				.eq('id', client_id)
				.is('deleted_at', null)
				.maybeSingle()
		]);

		const { data: entries, error: entriesErr } = entriesRes;
		const { data: clientRow, error: clientErr } = clientRes;

		if (entriesErr) {
			console.error(entriesErr);
			return fail(500, { message: `Could not load time entries: ${entriesErr.message}` });
		}
		if (clientErr) {
			console.error(clientErr);
			return fail(500, { message: clientErr.message ?? 'Could not load client.' });
		}
		if (!clientRow) {
			return fail(404, { message: 'Client not found.' });
		}

		const consultationGrouping = parseConsultationGrouping(clientRow.consultation_grouping);

		const entryRows = entries ?? [];
		const hourEntries = entryRows.filter((e) => !e.is_one_off);
		const existingOneOffEntries = entryRows.filter((e) => e.is_one_off);

		const existingOneOffLines = existingOneOffEntries.map((e) =>
			oneOffLineFromLedgerEntry({
				date: e.date as string,
				hours: Number(e.hours),
				rate: Number(e.rate),
				description: (e.description as string | null) ?? null
			})
		);

		const formOneOffLines = oneOffsParsed.lines.map((o) => ({
			description: o.description,
			quantity: o.quantity,
			unit_price: roundMoney(o.unit_price),
			total: roundMoney(o.quantity * o.unit_price),
			is_one_off: true as const,
			start_date: o.date,
			end_date: o.date
		}));

		if (hourEntries.length === 0 && existingOneOffLines.length === 0 && formOneOffLines.length === 0) {
			return fail(400, {
				message:
					'No unbilled time entries in this range and no one-off lines. Add entries or a line item.'
			});
		}

		const { data: invoiceNumber, error: rpcErr } = await supabase.rpc('generate_invoice_number');
		if (rpcErr || invoiceNumber == null || typeof invoiceNumber !== 'string') {
			console.error(rpcErr);
			return fail(500, {
				message:
					rpcErr?.message ??
					'Could not generate invoice number. Ask an admin to grant EXECUTE on generate_invoice_number.'
			});
		}

		/** Roll up consultation hours per client billing preference. */
		const timeBasedLines = buildConsultationLines({
			entries: hourEntries.map((e) => ({
				date: e.date as string,
				hours: Number(e.hours),
				rate: Number(e.rate),
				description: (e.description as string | null) ?? null
			})),
			grouping: consultationGrouping,
			periodStart: period_start,
			periodEnd: period_end
		});

		const allLines = [...timeBasedLines, ...existingOneOffLines, ...formOneOffLines];
		const subtotal = roundMoney(allLines.reduce((s, l) => s + l.total, 0));
		const total = subtotal;

		const { data: insertedInvoice, error: invErr } = await supabase
			.from('invoices')
			.insert({
				client_id,
				invoice_number: invoiceNumber,
				period_start,
				period_end,
				status: 'draft',
				subtotal,
				total,
				created_by: user.id
			})
			.select('id')
			.single();

		if (invErr || !insertedInvoice) {
			console.error(invErr);
			return fail(500, { message: invErr?.message ?? 'Could not create invoice.' });
		}

		const invoiceId = insertedInvoice.id as string;

		const linePayload = allLines.map((line, i) => ({
			invoice_id: invoiceId,
			description: line.description,
			quantity: line.quantity,
			unit_price: line.unit_price,
			total: line.total,
			is_one_off: line.is_one_off,
			start_date: line.start_date,
			end_date: line.end_date,
			sort_order: i,
			created_by: user.id
		}));

		const { error: liErr } = await supabase.from('invoice_line_items').insert(linePayload);

		if (liErr) {
			console.error(liErr);
			await supabase.from('invoices').delete().eq('id', invoiceId);
			return fail(500, { message: liErr.message ?? 'Could not create line items.' });
		}

		const allEntryIds = entryRows.map((e) => e.id as string);
		if (allEntryIds.length > 0) {
			const { error: upErr } = await supabase
				.from('time_entries')
				.update({ invoice_id: invoiceId })
				.in('id', allEntryIds);

			if (upErr) {
				console.error(upErr);
				await supabase.from('invoices').delete().eq('id', invoiceId);
				return fail(500, {
					message: upErr.message ?? 'Could not link time entries to the invoice.'
				});
			}
		}

		if (oneOffsParsed.lines.length > 0) {
			const oneOffEntryPayload = oneOffsParsed.lines.map((o) => ({
				client_id,
				date: o.date,
				hours: roundMoney(o.quantity),
				rate: roundMoney(o.unit_price),
				description: o.description,
				billable: true,
				invoice_id: invoiceId,
				is_one_off: true,
				created_by: user.id
			}));
			const { error: oneOffErr } = await supabase.from('time_entries').insert(oneOffEntryPayload);
			if (oneOffErr) {
				console.error(oneOffErr);
				if (allEntryIds.length > 0) {
					await supabase.from('time_entries').update({ invoice_id: null }).in('id', allEntryIds);
				}
				await supabase.from('invoices').delete().eq('id', invoiceId);
				return fail(500, {
					message: oneOffErr.message ?? 'Could not create time entries for one-off lines.'
				});
			}
		}

		redirect(303, `/invoicing/invoices/${invoiceId}`);
	}
};
