import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseInvoiceId(raw: unknown): string | null {
	const id = typeof raw === 'string' ? raw.trim() : '';
	return UUID_RE.test(id) ? id : null;
}

export type MarkPaidActionKind = 'markPaid' | 'unmarkPaid';

type PaidToggleOk = {
	kind: MarkPaidActionKind;
	success: true;
	invoiceId: string;
	invoiceNumber: string;
};

async function toggleInvoicePaid(
	supabase: SupabaseClient,
	invoiceId: string,
	paid: boolean
): Promise<PaidToggleOk | ReturnType<typeof fail>> {
	const kind: MarkPaidActionKind = paid ? 'markPaid' : 'unmarkPaid';
	const { data: updated, error } = await supabase
		.from('invoices')
		.update(
			paid
				? { status: 'paid', paid_at: new Date().toISOString() }
				: { status: 'sent', paid_at: null }
		)
		.eq('id', invoiceId)
		.eq('status', paid ? 'sent' : 'paid')
		.is('deleted_at', null)
		.select('id, invoice_number')
		.maybeSingle();

	if (error) {
		console.error(error);
		return fail(500, {
			kind,
			invoiceId,
			message: error.message ?? (paid ? 'Could not mark invoice as paid.' : 'Could not undo payment.')
		});
	}
	if (!updated) {
		return fail(400, {
			kind,
			invoiceId,
			message: paid
				? 'Invoice not found or not in sent status.'
				: 'Invoice not found or not in paid status.'
		});
	}

	return {
		kind,
		success: true as const,
		invoiceId: updated.id as string,
		invoiceNumber: updated.invoice_number as string
	};
}

export async function markInvoicePaidAction(supabase: SupabaseClient, invoiceId: string) {
	return toggleInvoicePaid(supabase, invoiceId, true);
}

export async function unmarkInvoicePaidAction(supabase: SupabaseClient, invoiceId: string) {
	return toggleInvoicePaid(supabase, invoiceId, false);
}

export function failMarkPaidAuth(kind: MarkPaidActionKind) {
	return fail(401, { kind, message: 'Unauthorized' });
}

export function failMarkPaidMissing(kind: MarkPaidActionKind) {
	return fail(400, { kind, message: 'Missing invoice.' });
}
