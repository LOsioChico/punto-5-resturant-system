import { describe, it, expect } from "vitest";
import {
  toggleQuickNote,
  diffOrderItems,
  hasCartChanged,
  type CartItem,
} from "./logic";

// Helper to create a cart item
function item(
  dish_id: string,
  dish_name: string,
  quantity: number,
  notes: string[] = [],
  price = 10000,
): CartItem {
  return {
    dish_id,
    dish_name,
    category_name: "Test",
    description: "",
    price,
    quantity,
    notes,
  };
}

// ============================================================
// toggleQuickNote
// ============================================================
describe("toggleQuickNote", () => {
  it("adds a note to empty string", () => {
    expect(toggleQuickNote("", "Sin cebolla")).toBe("Sin cebolla");
  });

  it("adds a note to existing notes", () => {
    expect(toggleQuickNote("Sin cebolla", "Sin tomate")).toBe(
      "Sin cebolla, Sin tomate",
    );
  });

  it("removes an existing note", () => {
    expect(toggleQuickNote("Sin cebolla, Sin tomate", "Sin cebolla")).toBe(
      "Sin tomate",
    );
  });

  it("removes the only note", () => {
    expect(toggleQuickNote("Sin cebolla", "Sin cebolla")).toBe("");
  });

  it("adds note when not present", () => {
    expect(toggleQuickNote("Sin cebolla", "Sin tomate")).toBe(
      "Sin cebolla, Sin tomate",
    );
  });

  it("handles notes with extra whitespace", () => {
    expect(toggleQuickNote("  Sin cebolla  ,  Sin tomate  ", "Sin cebolla")).toBe(
      "Sin tomate",
    );
  });

  it("handles empty parts in notes string", () => {
    expect(toggleQuickNote("Sin cebolla, , Sin tomate", "Sin piña")).toBe(
      "Sin cebolla, Sin tomate, Sin piña",
    );
  });

  it("toggles the same note twice returns to original", () => {
    const original = "Sin cebolla, Sin tomate";
    const toggled = toggleQuickNote(original, "Sin piña");
    const back = toggleQuickNote(toggled, "Sin piña");
    expect(back).toBe(original);
  });
});

// ============================================================
// diffOrderItems
// ============================================================
describe("diffOrderItems", () => {
  it("returns empty diff when items are identical", () => {
    const items = [item("1", "Burger", 2), item("2", "Fries", 1)];
    const diff = diffOrderItems(items, items);
    expect(diff.toInsert).toHaveLength(0);
    expect(diff.toUpdate).toHaveLength(0);
    expect(diff.toDelete).toHaveLength(0);
  });

  it("detects new items to insert", () => {
    const old = [item("1", "Burger", 2)];
    const current = [item("1", "Burger", 2), item("2", "Fries", 1)];
    const diff = diffOrderItems(old, current);
    expect(diff.toInsert).toHaveLength(1);
    expect(diff.toInsert[0].dish_name).toBe("Fries");
    expect(diff.toUpdate).toHaveLength(0);
    expect(diff.toDelete).toHaveLength(0);
  });

  it("detects removed items to delete", () => {
    const old = [item("1", "Burger", 2), item("2", "Fries", 1)];
    const current = [item("1", "Burger", 2)];
    const diff = diffOrderItems(old, current);
    expect(diff.toInsert).toHaveLength(0);
    expect(diff.toUpdate).toHaveLength(0);
    expect(diff.toDelete).toHaveLength(1);
    expect(diff.toDelete[0]).toBe("2");
  });

  it("detects quantity changes to update", () => {
    const old = [item("1", "Burger", 2)];
    const current = [item("1", "Burger", 3)];
    const diff = diffOrderItems(old, current);
    expect(diff.toUpdate).toHaveLength(1);
    expect(diff.toUpdate[0].quantity).toBe(3);
    expect(diff.toInsert).toHaveLength(0);
    expect(diff.toDelete).toHaveLength(0);
  });

  it("detects notes changes to update", () => {
    const old = [item("1", "Burger", 2, ["Sin cebolla"])];
    const current = [item("1", "Burger", 2, ["Sin tomate"])];
    const diff = diffOrderItems(old, current);
    expect(diff.toUpdate).toHaveLength(1);
    expect(diff.toUpdate[0].notes).toEqual(["Sin tomate"]);
  });

  it("does not update when notes are the same (both empty)", () => {
    const old = [item("1", "Burger", 2, [])];
    const current = [item("1", "Burger", 2, [])];
    const diff = diffOrderItems(old, current);
    expect(diff.toUpdate).toHaveLength(0);
  });

  it("handles combination of insert, update, and delete", () => {
    const old = [
      item("1", "Burger", 2, ["Sin cebolla"]),
      item("2", "Fries", 1),
      item("3", "Soda", 1),
    ];
    const current = [
      item("1", "Burger", 3, ["Sin cebolla"]),
      item("2", "Fries", 1),
      item("4", "Salad", 1),
    ];
    const diff = diffOrderItems(old, current);
    expect(diff.toInsert).toHaveLength(1);
    expect(diff.toInsert[0].dish_name).toBe("Salad");
    expect(diff.toUpdate).toHaveLength(1);
    expect(diff.toUpdate[0].quantity).toBe(3);
    expect(diff.toDelete).toHaveLength(1);
    expect(diff.toDelete[0]).toBe("3");
  });

  it("handles empty old items (all new)", () => {
    const current = [item("1", "Burger", 2)];
    const diff = diffOrderItems([], current);
    expect(diff.toInsert).toHaveLength(1);
    expect(diff.toUpdate).toHaveLength(0);
    expect(diff.toDelete).toHaveLength(0);
  });

  it("handles empty new items (all removed)", () => {
    const old = [item("1", "Burger", 2)];
    const diff = diffOrderItems(old, []);
    expect(diff.toInsert).toHaveLength(0);
    expect(diff.toUpdate).toHaveLength(0);
    expect(diff.toDelete).toHaveLength(1);
  });
});

// ============================================================
// hasCartChanged
// ============================================================
describe("hasCartChanged", () => {
  it("returns false for identical carts", () => {
    const items = [item("1", "Burger", 2, ["Sin cebolla"])];
    expect(hasCartChanged(items, items)).toBe(false);
  });

  it("returns true when quantity changes", () => {
    const initial = [item("1", "Burger", 2)];
    const current = [item("1", "Burger", 3)];
    expect(hasCartChanged(initial, current)).toBe(true);
  });

  it("returns true when notes change", () => {
    const initial = [item("1", "Burger", 2, ["Sin cebolla"])];
    const current = [item("1", "Burger", 2, ["Sin tomate"])];
    expect(hasCartChanged(initial, current)).toBe(true);
  });

  it("returns true when item is added", () => {
    const initial = [item("1", "Burger", 2)];
    const current = [item("1", "Burger", 2), item("2", "Fries", 1)];
    expect(hasCartChanged(initial, current)).toBe(true);
  });

  it("returns true when item is removed", () => {
    const initial = [item("1", "Burger", 2), item("2", "Fries", 1)];
    const current = [item("1", "Burger", 2)];
    expect(hasCartChanged(initial, current)).toBe(true);
  });

  it("returns false when notes are both empty", () => {
    const initial = [item("1", "Burger", 2, [])];
    const current = [item("1", "Burger", 2, [])];
    expect(hasCartChanged(initial, current)).toBe(false);
  });

  it("returns false for empty carts", () => {
    expect(hasCartChanged([], [])).toBe(false);
  });

  it("returns false when items are same but in different order", () => {
    const initial = [item("1", "Burger", 2), item("2", "Fries", 1)];
    const current = [item("2", "Fries", 1), item("1", "Burger", 2)];
    // Same items, different order — should NOT detect as changed
    expect(hasCartChanged(initial, current)).toBe(false);
  });
});
