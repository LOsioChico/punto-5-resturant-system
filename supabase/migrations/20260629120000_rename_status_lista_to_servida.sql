-- Rename order statuses: lista → servida, servida → finalizada
--
-- "lista" (kitchen ready) is renamed to "servida" (food on table)
-- "servida" (was terminal) is renamed to "finalizada" (payment confirmed)
--
-- Order matters: rename servida → finalizada FIRST to free up "servida",
-- then rename lista → servida.
-- The check constraint must be dropped before the renames (it would block
-- the UPDATE) and re-added with the new allowed values at the end.

-- 1. Drop check constraint (it would block status values not in the old list)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- 2. Rename servida → finalizada (orders + order_events)
UPDATE orders SET status = 'finalizada' WHERE status = 'servida';
UPDATE order_events SET from_status = 'finalizada' WHERE from_status = 'servida';
UPDATE order_events SET to_status = 'finalizada' WHERE to_status = 'servida';

-- 3. Rename lista → servida (now safe, no conflict)
UPDATE orders SET status = 'servida' WHERE status = 'lista';
UPDATE order_events SET from_status = 'servida' WHERE from_status = 'lista';
UPDATE order_events SET to_status = 'servida' WHERE to_status = 'lista';

-- 4. Re-add check constraint with new allowed values
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  check (status in ('nueva','en_cocina','servida','finalizada','adicional'));
