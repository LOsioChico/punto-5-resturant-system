-- Add delivery_name column for delivery/to-go orders (table 18)
-- When an order is for "Domicilio", this stores the customer name or description
-- so the kitchen knows who it's for.
ALTER TABLE orders ADD COLUMN delivery_name text;

-- Delivery orders (table 18) should have a delivery_name
-- We enforce this at the app level, not via DB constraint, to avoid
-- blocking existing orders.
