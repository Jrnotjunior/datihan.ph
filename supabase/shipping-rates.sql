-- DATIHAN.PH — Owner shipping rates
-- Run this once in the Supabase SQL Editor.

create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  area_name text not null,
  shipping_fee numeric(12,2) not null default 0
    check (shipping_fee >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shipping_rates_owner_id_idx
  on public.shipping_rates(owner_id);

-- Store the rate selected by the customer with each order.
alter table public.orders
  add column if not exists shipping_rate_id uuid
  references public.shipping_rates(id) on delete set null;

alter table public.shipping_rates enable row level security;

drop policy if exists "Owners can view their shipping rates" on public.shipping_rates;
drop policy if exists "Customers can view active shipping rates" on public.shipping_rates;
drop policy if exists "Owners can create their shipping rates" on public.shipping_rates;
drop policy if exists "Owners can update their shipping rates" on public.shipping_rates;
drop policy if exists "Owners can delete their shipping rates" on public.shipping_rates;

create policy "Owners can view their shipping rates"
on public.shipping_rates
for select
to authenticated
using (auth.uid() = owner_id);

-- Customers need to see active delivery areas and fees at checkout.
create policy "Customers can view active shipping rates"
on public.shipping_rates
for select
to authenticated
using (is_active = true);

create policy "Owners can create their shipping rates"
on public.shipping_rates
for insert
to authenticated
with check (auth.uid() = owner_id);

create policy "Owners can update their shipping rates"
on public.shipping_rates
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Owners can delete their shipping rates"
on public.shipping_rates
for delete
to authenticated
using (auth.uid() = owner_id);
