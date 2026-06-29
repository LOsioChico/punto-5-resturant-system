/**
 * Pure functions extracted from POS components for testability.
 */

export interface CartItem {
  dish_id: string;
  dish_name: string;
  category_name: string;
  description: string;
  price: number;
  quantity: number;
  notes: string[];
}

/** Toggle a quick note on/off for a specific unit's notes string (comma-separated within a unit). */
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
 * Set the note for a specific unit index within a cart item's notes array.
 * Returns a new notes array with the updated value.
 */
export function setUnitNote(notes: string[], index: number, value: string): string[] {
  const result = [...notes];
  result[index] = value;
  return result;
}

/**
 * Resize the notes array to match the quantity.
 * When quantity increases, pad with empty strings.
 * When quantity decreases, truncate.
 */
export function syncNotesWithQuantity(notes: string[], quantity: number): string[] {
  if (notes.length === quantity) return notes;
  if (notes.length < quantity) {
    return [...notes, ...Array(quantity - notes.length).fill("")];
  }
  return notes.slice(0, quantity);
}

/**
 * Check if a notes array has any non-empty entries.
 */
export function hasNotes(notes: string[] | null | undefined): boolean {
  if (!notes || notes.length === 0) return false;
  return notes.some((n) => n.trim().length > 0);
}

/** Check if a single unit's note string contains "Para llevar". */
export function isParaLlevar(note: string | null | undefined): boolean {
  if (!note) return false;
  return note
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .includes("para llevar");
}

/**
 * Normalize a note string for comparison: split by comma, trim, lowercase,
 * sort tokens alphabetically, and rejoin. So "Para llevar, Sin cebolla"
 * and "Sin cebolla, Para llevar" both become "para llevar, sin cebolla".
 */
export function normalizeNote(note: string): string {
  return note
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(", ");
}

/**
 * Check if all non-empty notes in an array are equivalent (same tokens,
 * regardless of order). Empty notes are ignored.
 */
export function allNotesSame(notes: string[]): boolean {
  const nonEmpty = notes.filter((n) => n.trim());
  if (nonEmpty.length === 0) return true;
  const first = normalizeNote(nonEmpty[0]);
  return nonEmpty.every((n) => normalizeNote(n) === first);
}

/**
 * Count how many units of a cart item have "Para llevar" in their notes.
 */
export function countParaLlevar(notes: string[]): number {
  return notes.filter(isParaLlevar).length;
}

/**
 * Normalize notes for comparison: trim each entry, drop trailing empty entries.
 */
function normalizeNotes(notes: string[] | null | undefined): string[] {
  if (!notes) return [];
  const trimmed = notes.map((n) => n.trim());
  // Drop trailing empty strings (they don't change meaning)
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") {
    trimmed.pop();
  }
  return trimmed;
}

/**
 * Compare two notes arrays for equality (ignoring trailing empty strings).
 */
function notesEqual(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  const na = normalizeNotes(a);
  const nb = normalizeNotes(b);
  if (na.length !== nb.length) return false;
  return na.every((v, i) => v === nb[i]);
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
  toUpdate: { id: string; quantity: number; notes: string[] | null }[];
  toDelete: string[];
} {
  // Build maps by dish_id for diffing — need the old item IDs
  const oldByDish = new Map(oldItems.map((i) => [i.dish_id, i]));
  const newByDish = new Map(newItems.map((i) => [i.dish_id, i]));

  const toInsert: CartItem[] = [];
  const toUpdate: { id: string; quantity: number; notes: string[] | null }[] = [];
  const toDelete: string[] = [];

  for (const newItem of newItems) {
    const old = oldByDish.get(newItem.dish_id);
    if (!old) {
      toInsert.push(newItem);
    } else if (
      old.quantity !== newItem.quantity ||
      !notesEqual(old.notes, newItem.notes)
    ) {
      toUpdate.push({
        id: old.dish_id, // In real app this is the order_item id; for testing we use dish_id
        quantity: newItem.quantity,
        notes: hasNotes(newItem.notes) ? newItem.notes : null,
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
    if (old.quantity !== item.quantity || !notesEqual(old.notes, item.notes)) return true;
  }
  return false;
}
