-- Add soft delete columns to waiters and orders tables.
--
-- Waiters: `deleted_at` allows reusing a cédula after soft delete.
--   The unique constraint on `cedula` is replaced with a partial unique
--   index that only applies to non-deleted rows, so a new waiter can be
--   created with the same cédula as a previously deleted one.
--
-- Orders: `deleted_at` allows admin to remove orders from the dashboard
--   without losing the audit trail.

-- 1. Waiters: add deleted_at column
alter table waiters add column if not exists deleted_at timestamptz;

-- 2. Waiters: replace unique constraint on cedula with partial unique index
--    Drop the old constraint and create a new one that only applies to
--    non-deleted rows. This allows reusing a cédula after soft delete.
alter table waiters drop constraint if exists waiters_cedula_key;
create unique index if not exists waiters_cedula_unique_active
  on waiters (cedula) where deleted_at is null;

-- 3. Orders: add deleted_at column
alter table orders add column if not exists deleted_at timestamptz;

-- 4. Orders: index for filtering out soft-deleted orders
create index if not exists idx_orders_active
  on orders (created_at) where deleted_at is null;
