-- One-off (ad hoc) charges mirrored as time_entries for ledger balance
ALTER TABLE public.time_entries
	ADD COLUMN IF NOT EXISTS is_one_off BOOLEAN NOT NULL DEFAULT false;
