export type PeriodView = 'day' | 'week' | 'month';

export type ClientOption = {
	id: string;
	name: string;
};

export type TimeEntryRow = {
	id: string;
	client_id: string;
	client_name: string;
	date: string;
	hours: number;
	rate: number;
	description: string | null;
	billable: boolean;
	invoice_id: string | null;
	/** True when this row backs a one-off invoice line (ad hoc charge); not user-editable. */
	is_one_off: boolean;
	created_at: string;
};

export type UnbilledCount = {
	client_id: string;
	client_name: string;
	count: number;
};

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'discarded';

export type InvoiceRow = {
	id: string;
	client_id: string;
	client_name: string;
	invoice_number: string;
	period_start: string;
	period_end: string;
	status: InvoiceStatus;
	subtotal: number;
	total: number;
	created_at: string;
};

export type InvoiceLineItemRow = {
	id: string;
	description: string;
	quantity: number | null;
	unit_price: number | null;
	total: number;
	is_one_off: boolean;
	sort_order: number;
	/** Service period / billing window start (YYYY-MM-DD), null for legacy rows */
	start_date: string | null;
	/** Service period / billing window end (YYYY-MM-DD), null for legacy rows */
	end_date: string | null;
};

export type InvoiceDetail = InvoiceRow & {
	notes: string | null;
	sent_at: string | null;
	paid_at: string | null;
	line_items: InvoiceLineItemRow[];
};

/** One-off line submitted from the generate form (quantity × unit_price). */
export type OneOffLineInput = {
	description: string;
	quantity: number;
	unit_price: number;
	/** Charge date for the mirrored time entry (YYYY-MM-DD). */
	date: string;
};

/** Per-client min/max date among unbilled entries (for default period hints). */
export type UnbilledBounds = {
	client_id: string;
	min_date: string;
	max_date: string;
};

/** Unbilled row for client-side range preview in generate invoice sheet. */
export type UnbilledEntryPreview = {
	client_id: string;
	date: string;
	hours: number;
	rate: number;
};
