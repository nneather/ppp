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
	created_at: string;
};

export type UnbilledCount = {
	client_id: string;
	client_name: string;
	count: number;
};
