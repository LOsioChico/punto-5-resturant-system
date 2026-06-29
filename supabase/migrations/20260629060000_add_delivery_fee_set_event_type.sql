-- Add 'delivery_fee_set' to the order_events event_type check constraint.
-- This event is logged when an admin sets the delivery fee for an order.

ALTER TABLE order_events DROP CONSTRAINT IF EXISTS order_events_event_type_check;

ALTER TABLE order_events ADD CONSTRAINT order_events_event_type_check
  check (event_type in ('created','status_changed','printed','updated','cancelled','additional_added','delivery_fee_set'));
