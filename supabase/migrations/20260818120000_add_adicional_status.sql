-- Add 'adicional' status for orders that have additional items added.
-- This status is set when a waiter/admin adds additional items to a served order.
-- It is NOT shown in the dashboard KPI cards or status filters.
-- Flow: adicional → finalizada (the order was already served, additional items are now served too)

-- NOTE: The previous version of this constraint (from migration 20260629120000)
-- allowed ('nueva','en_cocina','servida','finalizada','adicional') after the
-- lista→servida rename. This migration must carry forward those correct values.

alter table orders
  drop constraint if exists orders_status_check;

alter table orders
  add constraint orders_status_check
  check (status in ('nueva','en_cocina','servida','finalizada','adicional'));
