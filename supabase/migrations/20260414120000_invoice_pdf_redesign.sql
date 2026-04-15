-- Client billing addresses + line item date ranges for invoice PDF layout
ALTER TABLE public.clients
	ADD COLUMN IF NOT EXISTS address_line_1 TEXT,
	ADD COLUMN IF NOT EXISTS address_line_2 TEXT;

ALTER TABLE public.invoice_line_items
	ADD COLUMN IF NOT EXISTS start_date DATE,
	ADD COLUMN IF NOT EXISTS end_date DATE;
