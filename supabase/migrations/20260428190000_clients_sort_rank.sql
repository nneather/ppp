-- Adds a configurable per-client sort priority used by every customer picker.
-- Lower numbers sort first; NULL falls to the bottom alphabetically.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS sort_rank INTEGER;

CREATE INDEX IF NOT EXISTS clients_sort_rank_idx
  ON public.clients (sort_rank NULLS LAST, name);

UPDATE public.clients SET sort_rank = 1
  WHERE name = 'This Week Health' AND deleted_at IS NULL;

UPDATE public.clients SET sort_rank = 2
  WHERE name = 'Fountain of Life Church' AND deleted_at IS NULL;
