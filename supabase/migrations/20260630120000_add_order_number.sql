-- ============================================================
-- Add order_number column — a human-readable sequential number
-- for each order, shown on printed commands and searchable in
-- the admin dashboard.
--
-- Uses a Postgres SEQUENCE for gap-free sequential numbering.
-- The sequence is owned by the orders table and incremented via
-- a DEFAULT clause, so every INSERT gets the next number
-- automatically without any app-level logic.
-- ============================================================

-- 1. Add the column (nullable first so existing rows don't fail)
alter table orders add column if not exists order_number int;

-- 2. Create a sequence starting at 1
create sequence if not exists orders_order_number_seq as int;

-- 3. Backfill existing rows with sequential numbers (oldest first)
with numbered as (
  select id, row_number() over (order by created_at) as rn
  from orders
  where order_number is null
)
update orders o
set order_number = numbered.rn
from numbered
where o.id = numbered.id;

-- 4. Set the sequence to the max existing order_number + 1
select setval('orders_order_number_seq',
  coalesce((select max(order_number) from orders), 0) + 1,
  false);

-- 5. Make the column NOT NULL with a DEFAULT from the sequence
alter table orders
  alter column order_number set default nextval('orders_order_number_seq'),
  alter column order_number set not null;

-- 6. Create an index for searching by order_number
create index if not exists idx_orders_order_number on orders(order_number);
