import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { InvoiceDetail, InvoiceLineItemRow } from '$lib/types/invoicing';
export type { InvoiceDetail } from '$lib/types/invoicing';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const { id } = params;
	const supabase = locals.supabase;

	const { data: row, error: invErr } = await supabase
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
			notes,
			sent_at,
			paid_at,
			created_at,
			deleted_at,
			clients!inner ( name )
		`
		)
		.eq('id', id)
		.maybeSingle();

	if (invErr) {
		console.error(invErr);
		error(500, 'Could not load invoice.');
	}
	if (!row) {
		error(404, 'Invoice not found.');
	}

	const { data: lineRows, error: liErr } = await supabase
		.from('invoice_line_items')
		.select(
			'id, description, quantity, unit_price, total, is_one_off, sort_order'
		)
		.eq('invoice_id', id)
		.order('sort_order', { ascending: true });

	if (liErr) {
		console.error(liErr);
		error(500, 'Could not load line items.');
	}

	const rel = row.clients as { name: string } | { name: string }[] | null;
	const client_name = Array.isArray(rel) ? rel[0]?.name : rel?.name;

	const line_items: InvoiceLineItemRow[] = (lineRows ?? []).map((l) => ({
		id: l.id as string,
		description: l.description as string,
		quantity: l.quantity != null ? Number(l.quantity) : null,
		unit_price: l.unit_price != null ? Number(l.unit_price) : null,
		total: Number(l.total),
		is_one_off: Boolean(l.is_one_off),
		sort_order: Number(l.sort_order)
	}));

	const deleted_at = row.deleted_at as string | null;
	const displayStatus: InvoiceDetail['status'] =
		deleted_at != null ? 'discarded' : (row.status as InvoiceDetail['status']);

	const detail: InvoiceDetail = {
		id: row.id as string,
		client_id: row.client_id as string,
		client_name: client_name ?? 'Unknown',
		invoice_number: row.invoice_number as string,
		period_start: row.period_start as string,
		period_end: row.period_end as string,
		status: displayStatus,
		subtotal: Number(row.subtotal ?? 0),
		total: Number(row.total ?? 0),
		created_at: row.created_at as string,
		notes: (row.notes as string | null) ?? null,
		sent_at: (row.sent_at as string | null) ?? null,
		paid_at: (row.paid_at as string | null) ?? null,
		line_items
	};

	return { invoice: detail };
};

export const actions: Actions = {
	discard: async ({ params, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { message: 'Unauthorized' });

		const id = params.id;
		const supabase = locals.supabase;

		const { data: inv, error: fetchErr } = await supabase
			.from('invoices')
			.select('id, status')
			.eq('id', id)
			.is('deleted_at', null)
			.maybeSingle();

		if (fetchErr || !inv) {
			return fail(404, { message: 'Invoice not found.' });
		}
		if (inv.status !== 'draft') {
			return fail(400, { message: 'Only draft invoices can be discarded.' });
		}

		const { error: softOneOffErr } = await supabase
			.from('time_entries')
			.update({ deleted_at: new Date().toISOString() })
			.eq('invoice_id', id)
			.eq('is_one_off', true)
			.is('deleted_at', null);

		if (softOneOffErr) {
			console.error(softOneOffErr);
			return fail(500, { message: softOneOffErr.message ?? 'Could not remove one-off time entries.' });
		}

		const { error: unlinkErr } = await supabase
			.from('time_entries')
			.update({ invoice_id: null })
			.eq('invoice_id', id)
			.eq('is_one_off', false);

		if (unlinkErr) {
			console.error(unlinkErr);
			return fail(500, { message: unlinkErr.message ?? 'Could not unlink time entries.' });
		}

		const { error: delLiErr } = await supabase.from('invoice_line_items').delete().eq('invoice_id', id);

		if (delLiErr) {
			console.error(delLiErr);
			return fail(500, { message: delLiErr.message ?? 'Could not remove line items.' });
		}

		const { error: softErr } = await supabase
			.from('invoices')
			.update({ deleted_at: new Date().toISOString() })
			.eq('id', id)
			.eq('status', 'draft');

		if (softErr) {
			console.error(softErr);
			return fail(500, { message: softErr.message ?? 'Could not discard invoice.' });
		}

		redirect(303, '/invoicing/invoices');
	}
};
