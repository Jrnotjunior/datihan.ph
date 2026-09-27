-- DATIHAN.PH: owner-managed GCash payment QR
-- The active QR is replaceable so the shop owner can switch receiving accounts
-- without changing the website code.

create table if not exists public.payment_qr_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz
);

create index if not exists payment_qr_codes_owner_created_idx
  on public.payment_qr_codes(owner_id, created_at desc);

create unique index if not exists payment_qr_codes_one_active_per_owner_idx
  on public.payment_qr_codes(owner_id)
  where is_active = true;

alter table public.payment_qr_codes enable row level security;

drop policy if exists "Owners can view their payment QR history" on public.payment_qr_codes;
create policy "Owners can view their payment QR history"
  on public.payment_qr_codes
  for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "Owners can create their payment QR" on public.payment_qr_codes;
create policy "Owners can create their payment QR"
  on public.payment_qr_codes
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

-- When a new QR is activated, automatically deactivate the previous one.
create or replace function public.activate_payment_qr()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active then
    update public.payment_qr_codes
       set is_active = false,
           deactivated_at = now()
     where owner_id = new.owner_id
       and id <> new.id
       and is_active = true;
  end if;
  return new;
end;
$$;

drop trigger if exists payment_qr_activate_trigger on public.payment_qr_codes;
create trigger payment_qr_activate_trigger
before insert on public.payment_qr_codes
for each row execute function public.activate_payment_qr();

-- Public read is intentional: customers must be able to load the active QR
-- during checkout. Uploads remain restricted to an authenticated user's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-qr',
  'payment-qr',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

 drop policy if exists "Public can view payment QR" on storage.objects;
create policy "Public can view payment QR"
  on storage.objects
  for select
  to public
  using (bucket_id = 'payment-qr');

drop policy if exists "Authenticated users can upload payment QR" on storage.objects;
create policy "Authenticated users can upload payment QR"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'payment-qr'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Authenticated users can update payment QR" on storage.objects;
create policy "Authenticated users can update payment QR"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'payment-qr'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'payment-qr'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Authenticated users can delete payment QR" on storage.objects;
create policy "Authenticated users can delete payment QR"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'payment-qr'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
