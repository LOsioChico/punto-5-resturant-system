-- Fix RLS policies and helper functions for soft-delete correctness.
--
-- Issues found:
-- 1. orders_select RLS allows waiters to see soft-deleted orders
-- 2. waiters_select RLS allows deleted waiters to read their own profile
-- 3. lookup_waiter_by_cedula doesn't filter deleted_at (defense in depth)
-- 4. current_waiter_id() doesn't filter deleted_at (defense in depth)

-- 1. orders_select: waiters should only see non-deleted orders
drop policy if exists orders_select on orders;
create policy orders_select on orders
  for select
  using (
    is_admin()
    OR (is_order_owner(orders.*) AND deleted_at IS NULL)
  );

-- 2. waiters_select: deleted waiters should not be able to read their profile
drop policy if exists waiters_select on waiters;
create policy waiters_select on waiters
  for select
  using (
    is_admin()
    OR (auth_id = auth.uid() AND deleted_at IS NULL)
  );

-- 2b. orders_update: waiters should not be able to update soft-deleted orders
drop policy if exists orders_update on orders;
create policy orders_update on orders
  for update
  using (
    is_admin()
    OR (is_order_owner(orders.*) AND deleted_at IS NULL)
  )
  with check (
    is_admin()
    OR (is_order_owner(orders.*) AND deleted_at IS NULL)
  );

-- 2c. waiters_update: deleted waiters should not be able to update their profile
--     (e.g. reactivate themselves by setting is_active = true)
drop policy if exists waiters_update on waiters;
create policy waiters_update on waiters
  for update
  using (
    is_admin()
    OR (auth_id = auth.uid() AND deleted_at IS NULL)
  )
  with check (
    is_admin()
    OR (auth_id = auth.uid() AND deleted_at IS NULL)
  );

-- 3. lookup_waiter_by_cedula: also filter deleted_at (defense in depth)
create or replace function lookup_waiter_by_cedula(p_cedula text)
returns table(cedula text, name text, is_active boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select cedula, name, is_active
  from public.waiters
  where cedula = p_cedula
    and is_active = true
    and deleted_at is null;
$$;

-- 4. current_waiter_id(): also filter deleted_at (defense in depth)
create or replace function current_waiter_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select id from waiters
  where auth_id = auth.uid()
    and is_active = true
    and deleted_at is null;
$$;
