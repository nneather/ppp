-- Optional weekly progress on check-in rows (NULL progress_value = off).

alter table public.project_updates
  add column progress_value integer,
  add column progress_max integer,
  add column progress_note text;

alter table public.project_updates
  add constraint project_updates_progress_bounds_check
  check (
    progress_value is null
    or (
      progress_max is not null
      and progress_max > 0
      and progress_value >= 0
      and progress_value <= progress_max
    )
  );

comment on column public.project_updates.progress_value is
  'Progress numerator for this week; NULL means progress tracking is off.';
comment on column public.project_updates.progress_max is
  'Progress denominator (e.g. 100 for percent-style, or custom total).';
comment on column public.project_updates.progress_note is
  'Short label explaining what progress_max represents.';
