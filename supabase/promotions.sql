-- DATIHAN.PH — Promotions table
-- Run this once in the Supabase SQL Editor.

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  discount_type text not null default 'percentage'
    check (discount_type in ('percentage', 'fixed', 'free_shipping')),
  discount_value numeric(12,2) not null default 0
    check (
      (discount_type = 'free_shipping' and discount_value = 0)
      or (discount_type <> 'free_shipping' and discount_value > 0)
    ),
  code text,
  product_ids text[] not null default '{}',
  start_date date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_valid_dates
    check (end_date is null or start_date is null or end_date >= start_date),
  constraint promotions_percentage_limit
    check (discount_type <> 'percentage' or discount_value <= 100)
);

-- Migration for an existing promotions table.
alter table public.promotions drop constraint if exists promotions_discount_type_check;
alter table public.promotions drop constraint if exists promotions_discount_value_check;
alter table public.promotions drop constraint if exists promotions_percentage_limit;

alter table public.promotions
  alter column discount_value set default 0;

alter table public.promotions
  add constraint promotions_discount_type_check
  check (discount_type in ('percentage', 'fixed', 'free_shipping'));

alter table public.promotions
  add constraint promotions_discount_value_check
  check (
    (discount_type = 'free_shipping' and discount_value = 0)
    or (discount_type <> 'free_shipping' and discount_value > 0)
  );

alter table public.promotions
  add constraint promotions_percentage_limit
  check (discount_type <> 'percentage' or discount_value <= 100);

create index if not exists promotions_owner_id_idx
  on public.promotions(owner_id);

create index if not exists promotions_dates_idx
  on public.promotions(start_date, end_date);

alter table public.promotions enable row level security;

drop policy if exists "Owners can view their promotions" on public.promotions;
drop policy if exists "Owners can create their promotions" on public.promotions;
drop policy if exists "Owners can update their promotions" on public.promotions;
drop policy if exists "Owners can delete their promotions" on public.promotions;

create policy "Owners can view their promotions"
on public.promotions
for select
to authenticated
using (auth.uid() = owner_id);

create policy "Owners can create their promotions"
on public.promotions
for insert
to authenticated
with check (auth.uid() = owner_id);

create policy "Owners can update their promotions"
on public.promotions
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Owners can delete their promotions"
on public.promotions
for delete
to authenticated
using (auth.uid() = owner_id);
