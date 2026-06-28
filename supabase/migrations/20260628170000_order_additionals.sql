-- Order adicionals — allows adding items to a served order
-- without creating a new order. Items are flagged with is_additional
-- and grouped by additional_number (round 1, 2, etc.)

-- Add columns to order_items
alter table order_items
  add column if not exists is_additional boolean not null default false,
  add column if not exists additional_number int;

-- Index for filtering additional items
create index if not exists idx_order_items_additional
  on order_items (order_id, is_additional, additional_number);
