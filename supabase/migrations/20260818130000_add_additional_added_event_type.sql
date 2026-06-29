-- Add 'additional_added' to the order_events event_type check constraint.
-- This event type is used when a waiter or admin adds additional items to an order.
-- The original migration was missing this value, causing the event insert to fail silently.

alter table order_events
  drop constraint if exists order_events_event_type_check;

alter table order_events
  add constraint order_events_event_type_check
  check (event_type in ('created','status_changed','printed','updated','cancelled','additional_added'));
