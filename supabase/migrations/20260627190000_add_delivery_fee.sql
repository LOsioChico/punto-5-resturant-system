-- Add delivery_fee column for admin-set delivery charge per order
-- This is separate from the desechables ($1000/dish) which is automatic
ALTER TABLE orders ADD COLUMN delivery_fee int not null default 0;
