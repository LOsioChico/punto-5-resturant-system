import { describe, it, expect } from "vitest";
import {
  toggleQuickNote,
  diffOrderItems,
  hasCartChanged,
  isParaLlevar,
  countParaLlevar,
  normalizeNote,
  allNotesSame,
  removeParaLlevar,
  addParaLlevar,
  syncNotesForTableChange,
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

describe("isParaLlevar", () => {
  it("returns true for 'Para llevar'", () => {
    expect(isParaLlevar("Para llevar")).toBe(true);
  });

  it("returns true when 'Para llevar' is part of comma-separated notes", () => {
    expect(isParaLlevar("Sin cebolla, Para llevar")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isParaLlevar("para llevar")).toBe(true);
    expect(isParaLlevar("PARA LLEVAR")).toBe(true);
  });

  it("returns false for other notes", () => {
    expect(isParaLlevar("Sin cebolla")).toBe(false);
    expect(isParaLlevar("")).toBe(false);
    expect(isParaLlevar(null)).toBe(false);
    expect(isParaLlevar(undefined)).toBe(false);
  });
});

describe("countParaLlevar", () => {
  it("counts units with 'Para llevar' in notes", () => {
    expect(countParaLlevar(["Para llevar", "", "Sin cebolla, Para llevar"])).toBe(2);
  });

  it("returns 0 when no units have it", () => {
    expect(countParaLlevar(["Sin cebolla", "", ""])).toBe(0);
  });

  it("returns 0 for empty notes", () => {
    expect(countParaLlevar([])).toBe(0);
  });

  it("counts all units with it (Todas mode)", () => {
    expect(countParaLlevar(["Para llevar", "Para llevar", "Para llevar"])).toBe(3);
  });

  it("counts comma-separated 'Para llevar' alongside other notes", () => {
    expect(countParaLlevar(["Sin cebolla, Para llevar", "Para llevar, Sin salsas"])).toBe(2);
  });

  it("counts only 1 after switching from Todas to Por unidad", () => {
    // After switch: note kept on first unit only
    expect(countParaLlevar(["Para llevar", "", ""])).toBe(1);
  });
});

describe("normalizeNote", () => {
  it("sorts tokens alphabetically and lowercases", () => {
    expect(normalizeNote("Para llevar, Sin cebolla")).toBe("para llevar, sin cebolla");
    expect(normalizeNote("Sin cebolla, Para llevar")).toBe("para llevar, sin cebolla");
  });

  it("handles single token", () => {
    expect(normalizeNote("Para llevar")).toBe("para llevar");
  });

  it("handles empty string", () => {
    expect(normalizeNote("")).toBe("");
  });

  it("trims whitespace around tokens", () => {
    expect(normalizeNote("  Para llevar ,  Sin cebolla  ")).toBe("para llevar, sin cebolla");
  });

  it("drops empty tokens", () => {
    expect(normalizeNote("Para llevar, , Sin cebolla")).toBe("para llevar, sin cebolla");
  });
});

describe("allNotesSame", () => {
  it("returns true when all notes are identical", () => {
    expect(allNotesSame(["Sin cebolla", "Sin cebolla", "Sin cebolla"])).toBe(true);
  });

  it("returns true when notes have same tokens in different order", () => {
    expect(allNotesSame(["Para llevar, Sin cebolla", "Sin cebolla, Para llevar"])).toBe(true);
  });

  it("returns true when all non-empty are same, ignoring empty units", () => {
    expect(allNotesSame(["Para llevar", "Para llevar", ""])).toBe(true);
  });

  it("returns true for all empty", () => {
    expect(allNotesSame(["", "", ""])).toBe(true);
  });

  it("returns false when notes are genuinely different", () => {
    expect(allNotesSame(["Sin cebolla", "Para llevar"])).toBe(false);
  });

  it("returns false when one note has extra token", () => {
    expect(allNotesSame(["Para llevar", "Para llevar, Sin cebolla"])).toBe(false);
  });

  it("returns true for single unit", () => {
    expect(allNotesSame(["Para llevar"])).toBe(true);
  });
});

describe("removeParaLlevar", () => {
  it("removes 'Para llevar' from a comma-separated note", () => {
    expect(removeParaLlevar("Sin cebolla, Para llevar")).toBe("Sin cebolla");
  });

  it("removes 'Para llevar' when it's the only note", () => {
    expect(removeParaLlevar("Para llevar")).toBe("");
  });

  it("is case-insensitive", () => {
    expect(removeParaLlevar("Sin cebolla, para llevar")).toBe("Sin cebolla");
    expect(removeParaLlevar("Sin cebolla, PARA LLEVAR")).toBe("Sin cebolla");
  });

  it("leaves other notes unchanged", () => {
    expect(removeParaLlevar("Sin cebolla")).toBe("Sin cebolla");
  });

  it("leaves empty string unchanged", () => {
    expect(removeParaLlevar("")).toBe("");
  });

  it("removes only 'Para llevar', keeps multiple other notes", () => {
    expect(removeParaLlevar("Sin cebolla, Sin salsas, Para llevar")).toBe("Sin cebolla, Sin salsas");
  });
});

describe("addParaLlevar", () => {
  it("adds 'Para llevar' to an empty note", () => {
    expect(addParaLlevar("")).toBe("Para llevar");
  });

  it("adds 'Para llevar' to an existing note", () => {
    expect(addParaLlevar("Sin cebolla")).toBe("Sin cebolla, Para llevar");
  });

  it("does not duplicate 'Para llevar' if already present", () => {
    expect(addParaLlevar("Para llevar")).toBe("Para llevar");
    expect(addParaLlevar("Sin cebolla, Para llevar")).toBe("Sin cebolla, Para llevar");
  });
});

describe("syncNotesForTableChange", () => {
  // === Switching TO delivery ===
  it("adds 'Para llevar' to empty notes when switching to delivery", () => {
    const result = syncNotesForTableChange(["", ""], true, false);
    expect(result).toEqual(["Para llevar", "Para llevar"]);
  });

  it("adds 'Para llevar' to non-empty notes when switching to delivery", () => {
    const result = syncNotesForTableChange(["Sin cebolla", ""], true, false);
    expect(result).toEqual(["Sin cebolla, Para llevar", "Para llevar"]);
  });

  it("does not change notes that already have 'Para llevar' when switching to delivery", () => {
    const notes = ["Para llevar", "Sin cebolla, Para llevar"];
    const result = syncNotesForTableChange(notes, true, false);
    expect(result).toBe(notes); // same reference, no change
  });

  it("adds to all units when switching to delivery with mixed notes", () => {
    const result = syncNotesForTableChange(["Sin cebolla", "", "Para llevar"], true, false);
    expect(result).toEqual(["Sin cebolla, Para llevar", "Para llevar", "Para llevar"]);
  });

  // === Switching FROM delivery to a regular table ===
  it("removes 'Para llevar' when switching from delivery to a regular table", () => {
    const result = syncNotesForTableChange(["Para llevar", "Sin cebolla, Para llevar"], false, true);
    expect(result).toEqual(["", "Sin cebolla"]);
  });

  it("removes 'Para llevar' leaving empty when it was the only note", () => {
    const result = syncNotesForTableChange(["Para llevar", "Para llevar"], false, true);
    expect(result).toEqual(["", ""]);
  });

  it("does not change notes without 'Para llevar' when switching from delivery", () => {
    const notes = ["Sin cebolla", ""];
    const result = syncNotesForTableChange(notes, false, true);
    expect(result).toBe(notes); // same reference, no change
  });

  // === Switching between regular tables ===
  it("does not change notes when switching between regular tables", () => {
    const notes = ["Sin cebolla", "Para llevar"];
    const result = syncNotesForTableChange(notes, false, false);
    expect(result).toBe(notes); // same reference, no change
  });

  it("does not strip 'Para llevar' when switching table 5 to table 3", () => {
    const notes = ["Para llevar", "Sin cebolla, Para llevar"];
    const result = syncNotesForTableChange(notes, false, false);
    expect(result).toBe(notes); // same reference — "Para llevar" stays
  });

  // === Edge cases ===
  it("handles empty notes array", () => {
    expect(syncNotesForTableChange([], true, false)).toEqual([]);
    expect(syncNotesForTableChange([], false, true)).toEqual([]);
    expect(syncNotesForTableChange([], false, false)).toEqual([]);
  });

  it("handles delivery to delivery (no change needed)", () => {
    const notes = ["Para llevar", "Para llevar"];
    const result = syncNotesForTableChange(notes, true, true);
    expect(result).toBe(notes); // same reference
  });
});
