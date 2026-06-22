-- Per-client default billing period and consultation line grouping on invoices.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS billing_cadence TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cadence IN ('weekly', 'monthly')),
  ADD COLUMN IF NOT EXISTS consultation_grouping TEXT NOT NULL DEFAULT 'by_rate'
    CHECK (consultation_grouping IN ('weekly', 'monthly', 'per_entry', 'by_rate'));

UPDATE public.clients
SET
  billing_cadence = 'weekly',
  consultation_grouping = 'weekly'
WHERE name = 'This Week Health' AND deleted_at IS NULL;

UPDATE public.clients
SET
  billing_cadence = 'monthly',
  consultation_grouping = 'monthly'
WHERE name = 'Fountain of Life Church' AND deleted_at IS NULL;
