-- Add 'adicional' status for orders that have additional items added.
-- This status is set when a waiter/admin adds additional items to a served order.
-- It is NOT shown in the dashboard KPI cards or status filters.
-- Flow: adicional → lista (kitchen finishes the additional) → servida

alter table orders
  drop constraint if exists orders_status_check;

alter table orders
  add constraint orders_status_check
  check (status in ('nueva','en_cocina','lista','servida','adicional'));
