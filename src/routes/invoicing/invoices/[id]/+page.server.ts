import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { InvoiceDetail, InvoiceLineItemRow } from '$lib/types/invoicing';
export type { InvoiceDetail } from '$lib/types/invoicing';

/** Edge Functions return `{ error: string }` JSON; supabase-js may put that on `data` when status is non-2xx. */
function dataErrorMessage(data: unknown): string | null {
	if (data && typeof data === 'object' && data !== null && 'error' in data) {
		const e = (data as { error: unknown }).error;
		if (typeof e === 'string' && e.length > 0) return e;
	}
	return null;
}

async function edgeFunctionErrorMessage(err: unknown, data?: unknown): Promise<string> {
	const fromData = data !== undefined ? dataErrorMessage(data) : null;
	if (fromData) return fromData;

	console.error('[edge function invoke]', { err, data });

	const fallback =
		err && typeof err === 'object' && 'message' in err
			? String((err as { message: string }).message)
			: 'Request failed';

	const ctx =
		err && typeof err === 'object' && 'context' in err
			? (err as { context?: unknown }).context
			: undefined;
	if (ctx && typeof ctx === 'object' && ctx !== null && 'json' in ctx) {
		try {
			const res = ctx as Response;
			const body = (await res.clone().json()) as { error?: string; message?: string };
			if (body?.error && typeof body.error === 'string') return body.error;
			if (body?.message && typeof body.message === 'string') return body.message;
		} catch {
			/* ignore */
		}
	}
	return fallback;
}

/** Prefer JSON `error` from response body, then FunctionsError message. */
async function invokeFailureMessage(data: unknown, err: unknown): Promise<string> {
	const fromData = dataErrorMessage(data);
	if (fromData) return fromData;
	return edgeFunctionErrorMessage(err, data);
}

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
		.select('id, description, quantity, unit_price, total, is_one_off, sort_order')
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
			return fail(500, {
				message: softOneOffErr.message ?? 'Could not remove one-off time entries.'
			});
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

		const { error: delLiErr } = await supabase
			.from('invoice_line_items')
			.delete()
			.eq('invoice_id', id);

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
	},

	downloadPdf: async ({ params, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { downloadError: 'Unauthorized' });

		const id = params.id;
		const supabase = locals.supabase;

		const { data: row, error: fetchErr } = await supabase
			.from('invoices')
			.select('id, invoice_number, deleted_at')
			.eq('id', id)
			.maybeSingle();

		if (fetchErr || !row) {
			return fail(404, { downloadError: 'Invoice not found.' });
		}
		if (row.deleted_at != null) {
			return fail(400, { downloadError: 'Cannot download a discarded invoice.' });
		}

		const invoiceNumber = row.invoice_number as string;
		const safeFileBase = invoiceNumber.replace(/[^a-zA-Z0-9._-]+/g, '_');
		const filename = `${safeFileBase || 'invoice'}.pdf`;

		const {
			data: { session }
		} = await supabase.auth.getSession();
		const authHeaders = session?.access_token
			? { Authorization: `Bearer ${session.access_token}` }
			: undefined;

		const { data: pdfData, error: pdfErr } = await supabase.functions.invoke(
			'generate-invoice-pdf',
			{
				body: { invoice_id: id },
				headers: authHeaders
			}
		);

		const msg = await invokeFailureMessage(pdfData, pdfErr);
		if (pdfErr || dataErrorMessage(pdfData)) {
			console.error(pdfErr ?? pdfData);
			return fail(500, { downloadError: msg });
		}

		const pdf = (pdfData as { pdf?: string } | null)?.pdf;
		if (!pdf || typeof pdf !== 'string') {
			return fail(500, { downloadError: 'PDF generation returned no data.' });
		}

		return { pdfDownload: { pdf, filename } };
	},

	send: async ({ params, locals, request }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { sendError: 'Unauthorized' });

		const id = params.id;
		const supabase = locals.supabase;

		const { data: inv, error: fetchErr } = await supabase
			.from('invoices')
			.select('id, status')
			.eq('id', id)
			.is('deleted_at', null)
			.maybeSingle();

		if (fetchErr || !inv) {
			return fail(404, { sendError: 'Invoice not found.' });
		}
		if (inv.status !== 'draft') {
			return fail(400, { sendError: 'Only draft invoices can be sent.' });
		}

		const formData = await request.formData();
		const custom_message = String(formData.get('custom_message') ?? '');

		const {
			data: { session }
		} = await supabase.auth.getSession();
		const authHeaders = session?.access_token
			? { Authorization: `Bearer ${session.access_token}` }
			: undefined;

		const { data: pdfData, error: pdfErr } = await supabase.functions.invoke(
			'generate-invoice-pdf',
			{
				body: { invoice_id: id },
				headers: authHeaders
			}
		);

		if (pdfErr || dataErrorMessage(pdfData)) {
			console.error(pdfErr ?? pdfData);
			const msg = await invokeFailureMessage(pdfData, pdfErr);
			return fail(500, { sendError: msg });
		}

		const pdf = (pdfData as { pdf?: string } | null)?.pdf;
		if (!pdf || typeof pdf !== 'string') {
			return fail(500, { sendError: 'PDF generation returned no data.' });
		}

		const { data: sendData, error: sendErr } = await supabase.functions.invoke('send-invoice', {
			body: {
				invoice_id: id,
				pdf_base64: pdf,
				custom_message
			},
			headers: authHeaders
		});

		if (sendErr || dataErrorMessage(sendData)) {
			console.error(sendErr ?? sendData);
			const msg = await invokeFailureMessage(sendData, sendErr);
			return fail(500, { sendError: msg });
		}

		const ok = (sendData as { success?: boolean } | null)?.success === true;
		if (!ok) {
			return fail(500, { sendError: 'Email send did not complete successfully.' });
		}

		const sentAt = new Date().toISOString();
		const { error: updErr } = await supabase
			.from('invoices')
			.update({ status: 'sent', sent_at: sentAt })
			.eq('id', id)
			.eq('status', 'draft')
			.is('deleted_at', null);

		if (updErr) {
			console.error(updErr);
			return fail(500, {
				sendError:
					'Email was sent but updating the invoice failed. Check the invoice in Supabase and contact support if needed.'
			});
		}

		return { success: true };
	},

	sendTest: async ({ params, locals, request }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { sendTestError: 'Unauthorized' });

		const id = params.id;
		const supabase = locals.supabase;

		const { data: inv, error: fetchErr } = await supabase
			.from('invoices')
			.select('id, status')
			.eq('id', id)
			.is('deleted_at', null)
			.maybeSingle();

		if (fetchErr || !inv) {
			return fail(404, { sendTestError: 'Invoice not found.' });
		}
		if (inv.status !== 'draft') {
			return fail(400, { sendTestError: 'Only draft invoices can be test-sent.' });
		}

		const { data: profile, error: profileErr } = await supabase
			.from('profiles')
			.select('email')
			.eq('id', user.id)
			.maybeSingle();

		if (profileErr || !profile) {
			return fail(500, { sendTestError: 'Could not load your profile.' });
		}

		const testEmail = String((profile as { email: string }).email ?? '').trim();
		if (!testEmail) {
			return fail(400, {
				sendTestError: 'Your profile has no email address. Update it in Supabase Auth / profiles.'
			});
		}

		const formData = await request.formData();
		const custom_message = String(formData.get('custom_message') ?? '');

		const {
			data: { session }
		} = await supabase.auth.getSession();
		const authHeaders = session?.access_token
			? { Authorization: `Bearer ${session.access_token}` }
			: undefined;

		const { data: pdfData, error: pdfErr } = await supabase.functions.invoke(
			'generate-invoice-pdf',
			{
				body: { invoice_id: id },
				headers: authHeaders
			}
		);

		if (pdfErr || dataErrorMessage(pdfData)) {
			console.error(pdfErr ?? pdfData);
			const msg = await invokeFailureMessage(pdfData, pdfErr);
			return fail(500, { sendTestError: msg });
		}

		const pdf = (pdfData as { pdf?: string } | null)?.pdf;
		if (!pdf || typeof pdf !== 'string') {
			return fail(500, { sendTestError: 'PDF generation returned no data.' });
		}

		const { data: sendData, error: sendErr } = await supabase.functions.invoke('send-invoice', {
			body: {
				invoice_id: id,
				pdf_base64: pdf,
				custom_message,
				test_recipient: testEmail
			},
			headers: authHeaders
		});

		if (sendErr || dataErrorMessage(sendData)) {
			console.error(sendErr ?? sendData);
			const msg = await invokeFailureMessage(sendData, sendErr);
			return fail(500, { sendTestError: msg });
		}

		const ok = (sendData as { success?: boolean } | null)?.success === true;
		if (!ok) {
			return fail(500, { sendTestError: 'Test email did not complete successfully.' });
		}

		return { testSent: true as const, testEmail };
	},

	markPaid: async ({ params, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { markPaidError: 'Unauthorized' });

		const id = params.id;
		const supabase = locals.supabase;

		const { data: updated, error: updErr } = await supabase
			.from('invoices')
			.update({ status: 'paid', paid_at: new Date().toISOString() })
			.eq('id', id)
			.eq('status', 'sent')
			.is('deleted_at', null)
			.select('id')
			.maybeSingle();

		if (updErr) {
			console.error(updErr);
			return fail(500, { markPaidError: updErr.message ?? 'Could not mark invoice as paid.' });
		}
		if (!updated) {
			return fail(400, { markPaidError: 'Invoice not found or not in sent status.' });
		}

		return { success: true };
	}
};
