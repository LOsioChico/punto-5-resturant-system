/**
 * Pure functions extracted from POS components for testability.
 */

export interface CartItem {
  dish_id: string;
  dish_name: string;
  category_name: string;
  price: number;
  quantity: number;
  notes: string;
}

/** Toggle a quick note on/off within the notes string (comma-separated). */
export function toggleQuickNote(current: string, note: string): string {
  const parts = current
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const idx = parts.indexOf(note);
  if (idx >= 0) {
    parts.splice(idx, 1);
  } else {
    parts.push(note);
  }
  return parts.join(", ");
}

/**
 * Compute the diff between old order items and new cart items.
 * Returns what to insert, update, and delete.
 */
export function diffOrderItems(
  oldItems: CartItem[],
  newItems: CartItem[],
): {
  toInsert: CartItem[];
  toUpdate: { id: string; quantity: number; notes: string | null }[];
  toDelete: string[];
} {
  // Build maps by dish_id for diffing — need the old item IDs
  const oldByDish = new Map(oldItems.map((i) => [i.dish_id, i]));
  const newByDish = new Map(newItems.map((i) => [i.dish_id, i]));

  const toInsert: CartItem[] = [];
  const toUpdate: { id: string; quantity: number; notes: string | null }[] = [];
  const toDelete: string[] = [];

  for (const newItem of newItems) {
    const old = oldByDish.get(newItem.dish_id);
    if (!old) {
      toInsert.push(newItem);
    } else if (
      old.quantity !== newItem.quantity ||
      (old.notes ?? "") !== newItem.notes
    ) {
      toUpdate.push({
        id: old.dish_id, // In real app this is the order_item id; for testing we use dish_id
        quantity: newItem.quantity,
        notes: newItem.notes || null,
      });
    }
  }

  for (const oldItem of oldItems) {
    if (!newByDish.has(oldItem.dish_id)) {
      toDelete.push(oldItem.dish_id);
    }
  }

  return { toInsert, toUpdate, toDelete };
}

/**
 * Check if the cart has actually changed from the initial edit state.
 */
export function hasCartChanged(
  initial: CartItem[],
  current: CartItem[],
): boolean {
  if (initial.length !== current.length) return true;
  const initialMap = new Map(initial.map((i) => [i.dish_id, i]));
  for (const item of current) {
    const old = initialMap.get(item.dish_id);
    if (!old) return true;
    if (old.quantity !== item.quantity || (old.notes ?? "") !== (item.notes ?? "")) return true;
  }
  return false;
}
