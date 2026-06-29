/**
 * Helpers for Supabase realtime handlers.
 *
 * When an order is updated, the realtime handler needs to decide whether
 * to reload the order's items from the database or just patch the order
 * fields in local state. Items only change when a waiter edits the order
 * or adds additionals — admin actions (status changes, delivery fee) don't
 * touch items.
 */

import type { Order } from "./types";

/**
 * Check whether a realtime order UPDATE should trigger an item reload.
 *
 * Returns true when:
 * - The order was modified by a waiter (edit or additional) — items may have changed
 * - The order's status is "adicional" — additional items were added
 *
 * Returns false for admin-only actions (status advance/undo, delivery fee set)
 * where items are unchanged and can be preserved from local state.
 */
export function needsItemReload(order: Pick<Order, "updated_by_type" | "updated_at" | "status">): boolean {
  return (
    (order.updated_by_type === "waiter" && order.updated_at !== null) ||
    order.status === "adicional"
  );
}
