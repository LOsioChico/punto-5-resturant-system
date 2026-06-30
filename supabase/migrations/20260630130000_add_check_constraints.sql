-- ============================================================
-- Add CHECK constraints to prevent invalid numeric data.
--
-- The app validates inputs (e.g. delivery_fee > 0, quantity >= 1),
-- but DB-level constraints are the last line of defense against
-- bugs, direct SQL access, or future code that bypasses validation.
-- ============================================================

-- Dishes: price must be non-negative
alter table dishes
  add constraint dishes_price_non_negative check (price >= 0);

-- Orders: total must be non-negative
alter table orders
  add constraint orders_total_non_negative check (total >= 0);

-- Orders: delivery_fee must be non-negative (0 = no fee / non-delivery)
alter table orders
  add constraint orders_delivery_fee_non_negative check (delivery_fee >= 0);

-- Orders: table_number must be positive (1-17 regular, 18 delivery)
alter table orders
  add constraint orders_table_number_positive check (table_number > 0);

-- Order items: price must be non-negative (snapshot of dish price)
alter table order_items
  add constraint order_items_price_non_negative check (price >= 0);

-- Order items: quantity must be at least 1
alter table order_items
  add constraint order_items_quantity_min_one check (quantity >= 1);
