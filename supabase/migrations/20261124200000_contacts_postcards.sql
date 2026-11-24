-- =============================================================================
-- Contacts: postcards via Lob (Christmas mailing plan, Phase 3)
-- Filed: 2026-11-24 — decision 324
--
-- postcard_designs  one per contact list: size, artwork paths, back message,
--                   return address. Edited on /contacts/postcards/[listId].
-- postcard_sends    one row per Lob postcard created (test proofs, the
--                   mail-to-me copy, and the live batch). The partial unique
--                   index is the never-mail-a-household-twice guard.
-- postcard-artwork  private Storage bucket for the front / back uploads. Lob
--                   fetches them through short-lived signed URLs.
--
-- HOW TO APPLY:
--   npm run supabase:db:push:dry → review → npm run supabase:db:push
-- =============================================================================

create table if not exists public.postcard_designs (
  id              uuid primary key default gen_random_uuid(),
  list_id         uuid not null references public.contact_lists(id),
  size            text not null default '6x9',
  front_path      text,
  back_mode       text not null default 'message',
  back_message    text not null default '',
  back_path       text,
  return_name     text,
  return_line_1   text,
  return_line_2   text,
  return_city     text,
  return_state    text,
  return_zip      text,
  price_cents     int,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id),
  constraint postcard_designs_size_check check (size in ('4x6', '5x7', '6x9', '6x11')),
  constraint postcard_designs_back_mode_check check (back_mode in ('message', 'upload')),
  constraint postcard_designs_price_check check (price_cents is null or price_cents >= 0)
);

create unique index if not exists postcard_designs_list_uidx
  on public.postcard_designs (list_id)
  where deleted_at is null;

drop trigger if exists trg_postcard_designs_updated_at on public.postcard_designs;
create trigger trg_postcard_designs_updated_at
  before update on public.postcard_designs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_postcard_designs on public.postcard_designs;
create trigger trg_audit_postcard_designs
  after insert or update or delete on public.postcard_designs
  for each row execute function public.write_audit_log();

alter table public.postcard_designs enable row level security;

drop policy if exists postcard_designs_owner on public.postcard_designs;
create policy postcard_designs_owner on public.postcard_designs
  for all
  using (public.app_is_owner())
  with check (public.app_is_owner());

grant select, insert, update, delete on public.postcard_designs to authenticated, service_role;

create table if not exists public.postcard_sends (
  id                uuid primary key default gen_random_uuid(),
  list_id           uuid not null references public.contact_lists(id),
  -- null for the mail-to-me copy (sent to the return address).
  household_id      uuid references public.households(id),
  recipient_name    text not null,
  address_snapshot  jsonb not null,
  -- proof = test key (renders a PDF, mails nothing) · self = live copy to the
  -- return address · batch = live card to a household.
  kind              text not null,
  mode              text not null,
  size              text not null,
  status            text not null,
  lob_id            text,
  lob_url           text,
  error             text,
  sent_on           date not null,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references public.profiles(id),
  constraint postcard_sends_kind_check check (kind in ('proof', 'self', 'batch')),
  constraint postcard_sends_mode_check check (mode in ('test', 'live')),
  -- pending = reserved before the Lob call (batch only); resolved to created/failed after.
  constraint postcard_sends_status_check check (status in ('pending', 'created', 'failed')),
  constraint postcard_sends_batch_has_household check (kind <> 'batch' or household_id is not null)
);

-- Never mail the same household twice from one list. The batch inserts a
-- `pending` row BEFORE calling Lob, so this index blocks a second tab or a
-- retried request before any money is spent. A `failed` row does not block a
-- retry; a stuck `pending` row does (check Lob, then fix it by hand).
create unique index if not exists postcard_sends_live_household_uidx
  on public.postcard_sends (list_id, household_id)
  where kind = 'batch' and status in ('pending', 'created') and deleted_at is null;

create index if not exists postcard_sends_list_idx
  on public.postcard_sends (list_id, created_at desc)
  where deleted_at is null;

drop trigger if exists trg_postcard_sends_updated_at on public.postcard_sends;
create trigger trg_postcard_sends_updated_at
  before update on public.postcard_sends
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_postcard_sends on public.postcard_sends;
create trigger trg_audit_postcard_sends
  after insert or update or delete on public.postcard_sends
  for each row execute function public.write_audit_log();

alter table public.postcard_sends enable row level security;

drop policy if exists postcard_sends_owner on public.postcard_sends;
create policy postcard_sends_owner on public.postcard_sends
  for all
  using (public.app_is_owner())
  with check (public.app_is_owner());

grant select, insert, update, delete on public.postcard_sends to authenticated, service_role;

-- Artwork bucket. Path: ${userId}/${listId}/${front|back}-${uuid}.{pdf|png|jpg}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'postcard-artwork',
  'postcard-artwork',
  false,
  20971520,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do nothing;

drop policy if exists postcard_artwork_select on storage.objects;
create policy postcard_artwork_select on storage.objects
  for select
  using (
    bucket_id = 'postcard-artwork'
    and public.app_is_owner()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists postcard_artwork_insert on storage.objects;
create policy postcard_artwork_insert on storage.objects
  for insert
  with check (
    bucket_id = 'postcard-artwork'
    and public.app_is_owner()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists postcard_artwork_delete on storage.objects;
create policy postcard_artwork_delete on storage.objects
  for delete
  using (
    bucket_id = 'postcard-artwork'
    and public.app_is_owner()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
