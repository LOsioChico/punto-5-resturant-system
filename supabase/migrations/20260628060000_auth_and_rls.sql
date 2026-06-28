-- ============================================================
-- Authentication: waiters table + waiter_id/actor_id columns
--
-- This migration adds:
--   1. `waiters` table — links Supabase Auth accounts to waiter profiles
--   2. `orders.waiter_id` — FK to waiters.id (replaces name-only identification)
--   3. `order_events.actor_id` — FK to auth.users for real audit trail
--   4. Tightened RLS policies (replacing the POC "allow all" policies)
--
-- Auth accounts are created via the admin UI (Supabase client),
-- not via this migration. The admin account is created manually
-- via the Supabase dashboard or a setup script.
-- ============================================================

-- ============================================================
-- Waiters table
-- ============================================================
create table if not exists waiters (
  id           uuid primary key default gen_random_uuid(),
  auth_id      uuid not null references auth.users(id) on delete cascade,
  cedula       text not null unique,              -- Colombian national ID
  name         text not null,                      -- display name
  is_active    boolean not null default true,      -- admin can deactivate
  pin_changed  boolean not null default false,     -- false = must change PIN on first login
  created_at   timestamptz not null default now(),
  created_by   text                                -- admin email who created this waiter
);

create index if not exists idx_waiters_auth_id on waiters(auth_id);
create index if not exists idx_waiters_cedula on waiters(cedula);
create index if not exists idx_waiters_active on waiters(is_active) where is_active = true;

-- ============================================================
-- Add waiter_id to orders (NOT NULL — every order must have a waiter)
-- Existing test orders are deleted first since they have no waiter_id.
-- ============================================================
alter table orders add column if not exists waiter_id uuid references waiters(id) on delete restrict;

-- Delete existing orders that have no waiter_id (test data from POC)
delete from order_items where order_id in (select id from orders where waiter_id is null);
delete from order_events where order_id in (select id from orders where waiter_id is null);
delete from orders where waiter_id is null;

-- Now enforce NOT NULL
alter table orders alter column waiter_id set not null;
create index if not exists idx_orders_waiter_id on orders(waiter_id);

-- ============================================================
-- Add actor_id to order_events (nullable — system events may not have an actor)
-- ============================================================
alter table order_events add column if not exists actor_id uuid references auth.users(id) on delete set null;
create index if not exists idx_order_events_actor_id on order_events(actor_id) where actor_id is not null;

-- ============================================================
-- RLS — replace POC "allow all" policies with real enforcement
-- ============================================================

-- Drop all existing POC policies
drop policy if exists "poc_read_categories"  on categories;
drop policy if exists "poc_read_dishes"      on dishes;
drop policy if exists "poc_read_orders"      on orders;
drop policy if exists "poc_insert_orders"    on orders;
drop policy if exists "poc_update_orders"    on orders;
drop policy if exists "poc_delete_orders"    on orders;
drop policy if exists "poc_read_order_items"   on order_items;
drop policy if exists "poc_insert_order_items" on order_items;
drop policy if exists "poc_update_order_items" on order_items;
drop policy if exists "poc_delete_order_items" on order_items;
drop policy if exists "poc_read_order_events"  on order_events;
drop policy if exists "poc_insert_order_events" on order_events;
drop policy if exists "poc_insert_push_subs" on push_subscriptions;
drop policy if exists "poc_delete_push_subs" on push_subscriptions;
drop policy if exists "poc_read_push_subs"   on push_subscriptions;

-- Helper function: check if current user is admin
-- Admins have app_metadata.role = 'admin'
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- Helper function: get current waiter's id
-- Looks up waiters table by auth.uid()
create or replace function current_waiter_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from waiters where auth_id = auth.uid() and is_active = true;
$$;

-- Helper function: check if current user is an active waiter
create or replace function is_waiter()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from waiters where auth_id = auth.uid() and is_active = true);
$$;

-- Helper function: check if current waiter owns an order
create or replace function is_order_owner(order_row orders)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select order_row.waiter_id = current_waiter_id();
$$;

-- ============================================================
-- Categories & Dishes — read-only for authenticated users
-- ============================================================
create policy "read_categories" on categories
  for select to authenticated using (true);

create policy "read_dishes" on dishes
  for select to authenticated using (true);

-- ============================================================
-- Waiters — read-only for authenticated, write via service_role only
-- (admin manages waiters through the edge function using service role)
-- ============================================================
alter table waiters enable row level security;

create policy "read_waiters" on waiters
  for select to authenticated using (true);

create policy "service_role_all_waiters" on waiters
  for all to service_role using (true) with check (true);

-- Security definer function for public waiter lookup by cédula.
-- The login page needs to verify a cédula exists before showing the PIN
-- keypad, but the user has no session yet. This function exposes only
-- cedula, name, and is_active for active waiters.
create or replace function public.lookup_waiter_by_cedula(p_cedula text)
returns table(cedula text, name text, is_active boolean)
language sql
stable
security definer
set search_path = public
as $$
  select cedula, name, is_active
  from public.waiters
  where cedula = p_cedula and is_active = true;
$$;

grant execute on function public.lookup_waiter_by_cedula(text) to anon, authenticated;

-- ============================================================
-- Orders — admin: all | waiter: own orders only
-- ============================================================
create policy "orders_select" on orders
  for select to authenticated using (
    is_admin() or is_order_owner(orders)
  );

create policy "orders_insert" on orders
  for insert to authenticated with check (
    is_admin() or waiter_id = current_waiter_id()
  );

create policy "orders_update" on orders
  for update to authenticated using (
    is_admin() or is_order_owner(orders)
  ) with check (
    is_admin() or is_order_owner(orders)
  );

create policy "orders_delete" on orders
  for delete to authenticated using (is_admin());

-- ============================================================
-- Order items — admin: all | waiter: own order's items only
-- ============================================================
create policy "order_items_select" on order_items
  for select to authenticated using (
    is_admin() or exists(
      select 1 from orders o
      where o.id = order_items.order_id
      and o.waiter_id = current_waiter_id()
    )
  );

create policy "order_items_insert" on order_items
  for insert to authenticated with check (
    is_admin() or exists(
      select 1 from orders o
      where o.id = order_items.order_id
      and o.waiter_id = current_waiter_id()
    )
  );

create policy "order_items_update" on order_items
  for update to authenticated using (
    is_admin() or exists(
      select 1 from orders o
      where o.id = order_items.order_id
      and o.waiter_id = current_waiter_id()
    )
  ) with check (
    is_admin() or exists(
      select 1 from orders o
      where o.id = order_items.order_id
      and o.waiter_id = current_waiter_id()
    )
  );

create policy "order_items_delete" on order_items
  for delete to authenticated using (
    is_admin() or exists(
      select 1 from orders o
      where o.id = order_items.order_id
      and o.waiter_id = current_waiter_id()
    )
  );

-- ============================================================
-- Order events — admin: read all | waiter: read own, insert own
-- ============================================================
create policy "order_events_select" on order_events
  for select to authenticated using (
    is_admin() or exists(
      select 1 from orders o
      where o.id = order_events.order_id
      and o.waiter_id = current_waiter_id()
    )
  );

create policy "order_events_insert" on order_events
  for insert to authenticated with check (
    is_admin() or exists(
      select 1 from orders o
      where o.id = order_events.order_id
      and o.waiter_id = current_waiter_id()
    )
  );

-- ============================================================
-- Waiters — admin: all | waiter: read own row only
-- ============================================================
create policy "waiters_select" on waiters
  for select to authenticated using (
    is_admin() or auth_id = auth.uid()
  );

create policy "waiters_insert" on waiters
  for insert to authenticated with check (is_admin());

create policy "waiters_update" on waiters
  for update to authenticated using (
    is_admin() or auth_id = auth.uid()
  ) with check (
    is_admin() or auth_id = auth.uid()
  );

create policy "waiters_delete" on waiters
  for delete to authenticated using (is_admin());

-- ============================================================
-- Push subscriptions — waiter: manage own only
-- ============================================================
create policy "push_subs_select" on push_subscriptions
  for select to authenticated using (
    is_admin() or exists(
      select 1 from waiters w
      where w.name = push_subscriptions.waiter_name
      and w.auth_id = auth.uid()
    )
  );

create policy "push_subs_insert" on push_subscriptions
  for insert to authenticated with check (
    exists(
      select 1 from waiters w
      where w.name = push_subscriptions.waiter_name
      and w.auth_id = auth.uid()
      and w.is_active = true
    )
  );

create policy "push_subs_delete" on push_subscriptions
  for delete to authenticated using (
    exists(
      select 1 from waiters w
      where w.name = push_subscriptions.waiter_name
      and w.auth_id = auth.uid()
    )
  );

-- ============================================================
-- GRANTs — re-grant with authenticated role (drop anon)
-- ============================================================
revoke select on categories from anon;
revoke select on dishes from anon;
revoke select on orders from anon;
revoke insert on orders from anon;
revoke update on orders from anon;
revoke select on order_items from anon;
revoke insert on order_items from anon;
revoke update on order_items from anon;
revoke delete on order_items from anon;
revoke select on order_events from anon;
revoke insert on order_events from anon;
revoke insert on push_subscriptions from anon;
revoke delete on push_subscriptions from anon;
revoke select on push_subscriptions from anon;

grant select on categories    to authenticated;
grant select on dishes        to authenticated;
grant select on orders        to authenticated;
grant insert on orders        to authenticated;
grant update on orders        to authenticated;
grant delete on orders        to authenticated;
grant select on order_items   to authenticated;
grant insert on order_items   to authenticated;
grant update on order_items   to authenticated;
grant delete on order_items   to authenticated;
grant select on order_events  to authenticated;
grant insert on order_events  to authenticated;
grant select on waiters       to authenticated;
grant insert on waiters       to authenticated;
grant update on waiters       to authenticated;
grant delete on waiters       to authenticated;
grant select on push_subscriptions to authenticated;
grant insert on push_subscriptions to authenticated;
grant delete on push_subscriptions to authenticated;

-- Grant execute on helper functions
grant execute on function is_admin() to authenticated;
grant execute on function is_waiter() to authenticated;
grant execute on function current_waiter_id() to authenticated;
grant execute on function is_order_owner(orders) to authenticated;
