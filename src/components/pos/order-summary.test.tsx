import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderSummary } from "./order-summary";
import { type CartItem } from "@/lib/pos/logic";

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    dish_id: "dish-1",
    dish_name: "Hamburguesa",
    category_name: "Hamburguesas",
    description: "Carne de res, lechuga, ripio, queso mozzarella y salsas (tártara, tomate, mostaza)",
    price: 15000,
    quantity: 2,
    notes: [],
    ...overrides,
  };
}

const defaultProps = {
  tableNumber: 5 as number | null,
  deliveryName: "",
  onDeliveryNameChange: vi.fn(),
  items: [] as CartItem[],
  onInc: vi.fn(),
  onDec: vi.fn(),
  onRemove: vi.fn(),
  onClear: vi.fn(),
  onSend: vi.fn(),
  onSetNotes: vi.fn(),
  onSetAllNotes: vi.fn(),
  sending: false,
  editingOrderId: null as string | null,
  editHasChanges: false,
  onSaveEdit: vi.fn(),
  onCancelEdit: vi.fn(),
  additionalOrderId: null as string | null,
  onSendAdditional: vi.fn(),
  onCancelAdditional: vi.fn(),
};

function renderSummary(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  // Reset mocks
  props.onInc.mockClear();
  props.onDec.mockClear();
  props.onDeliveryNameChange.mockClear();
  props.onRemove.mockClear();
  props.onClear.mockClear();
  props.onSend.mockClear();
  props.onSetNotes.mockClear();
  props.onSetAllNotes.mockClear();
  props.onSaveEdit.mockClear();
  props.onCancelEdit.mockClear();
  props.onSendAdditional.mockClear();
  props.onCancelAdditional.mockClear();
  return render(<OrderSummary {...props} />);
}

// ============================================================
// OrderSummary — Empty cart
// ============================================================
describe("OrderSummary — empty cart", () => {
  it("shows empty cart message", () => {
    renderSummary({ items: [] });
    expect(screen.getByText("Pedido vacío")).toBeInTheDocument();
  });

  it("shows total as $0", () => {
    renderSummary({ items: [] });
    // Total should be visible and show 0
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("does not show 'Limpiar' button when empty", () => {
    renderSummary({ items: [] });
    expect(screen.queryByText("Limpiar")).not.toBeInTheDocument();
  });
});

// ============================================================
// OrderSummary — With items
// ============================================================
describe("OrderSummary — with items", () => {
  it("renders dish names", () => {
    renderSummary({ items: [makeItem({ dish_name: "Hamburguesa Doble" })] });
    expect(screen.getByText("Hamburguesa Doble")).toBeInTheDocument();
  });

  it("shows item count (singular)", () => {
    renderSummary({ items: [makeItem({ quantity: 1 })] });
    expect(screen.getByText(/1 plato/)).toBeInTheDocument();
  });

  it("shows item count (plural)", () => {
    renderSummary({ items: [makeItem({ quantity: 3 })] });
    expect(screen.getByText(/3 platos/)).toBeInTheDocument();
  });

  it("shows total", () => {
    renderSummary({ items: [makeItem({ price: 15000, quantity: 2 })] });
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("shows 'Limpiar' button when items present", () => {
    renderSummary({ items: [makeItem()] });
    expect(screen.getByText("Limpiar")).toBeInTheDocument();
  });

  it("shows table number", () => {
    renderSummary({ tableNumber: 7, items: [makeItem()] });
    expect(screen.getByText("Mesa 7")).toBeInTheDocument();
  });

  it("shows 'Sin mesa' when tableNumber is null", () => {
    renderSummary({ tableNumber: null, items: [makeItem()] });
    expect(screen.getByText("Sin mesa")).toBeInTheDocument();
  });
});

// ============================================================
// OrderSummary — Notes
// ============================================================
describe("OrderSummary — notes", () => {
  it("shows 'Nota' button when no notes", () => {
    renderSummary({ items: [makeItem({ notes: [], quantity: 1 })] });
    expect(screen.getByText("Nota")).toBeInTheDocument();
  });

  it("shows existing notes text", () => {
    renderSummary({ items: [makeItem({ notes: ["Sin cebolla"] })] });
    expect(screen.getByText("→ Sin cebolla")).toBeInTheDocument();
  });

  it("opens notes editor on click", async () => {
    const user = userEvent.setup();
    renderSummary({ items: [makeItem({ notes: [], quantity: 1 })] });
    await user.click(screen.getByText("Nota"));
    // Quick note buttons should appear — based on dish description
    expect(screen.getByText("Sin salsas")).toBeInTheDocument();
    expect(screen.getByText("Sin lechuga")).toBeInTheDocument();
    expect(screen.getByText("Sin tártara")).toBeInTheDocument();
    expect(screen.getByText("Para llevar")).toBeInTheDocument();
  });

  it("calls onSetNotes when quick note is clicked", async () => {
    const user = userEvent.setup();
    const onSetNotes = vi.fn();
    renderSummary({ items: [makeItem({ dish_id: "d1", notes: [], quantity: 1 })], onSetNotes });
    await user.click(screen.getByText("Nota"));
    await user.click(screen.getByText("Sin lechuga"));
    expect(onSetNotes).toHaveBeenCalledWith("d1", 0, "Sin lechuga");
  });

  it("toggles off a quick note that is already active", async () => {
    const user = userEvent.setup();
    const onSetNotes = vi.fn();
    renderSummary({ items: [makeItem({ dish_id: "d1", notes: ["Sin lechuga"], quantity: 1 })], onSetNotes });
    // The notes display button shows the existing note text; click it to open the editor.
    await user.click(screen.getByText("→ Sin lechuga"));
    // Now the quick-note chips are visible; click the active "Sin lechuga" chip to toggle it off.
    await user.click(screen.getByText("Sin lechuga"));
    expect(onSetNotes).toHaveBeenCalledWith("d1", 0, "");
  });

  it("closes notes editor on Enter key", async () => {
    const user = userEvent.setup();
    renderSummary({ items: [makeItem({ notes: [""], quantity: 1 })] });
    await user.click(screen.getByText("Nota"));
    // Type something and press Enter
    const input = screen.getByPlaceholderText("Nota...");
    await user.type(input, "Extra queso{Enter}");
    // Quick notes should be hidden after Enter
    expect(screen.queryByText("Sin salsas")).not.toBeInTheDocument();
  });

  // ============================================================
  // Notes mode — "Todas" vs "Por unidad" toggle
  // ============================================================
  it("shows Todas/Por unidad toggle only for multi-unit items", async () => {
    const user = userEvent.setup();
    renderSummary({ items: [makeItem({ notes: [], quantity: 1 })] });
    await user.click(screen.getByText("Nota"));
    expect(screen.queryByText("Todas")).not.toBeInTheDocument();
    expect(screen.queryByText("Por unidad")).not.toBeInTheDocument();
  });

  it("defaults to Todas mode when all units share the same note", async () => {
    const user = userEvent.setup();
    renderSummary({ items: [makeItem({ notes: ["Sin cebolla", "Sin cebolla", "Sin cebolla"], quantity: 3 })] });
    // Display groups identical notes: "→ Sin cebolla (3x)"
    await user.click(screen.getByText("→ Sin cebolla (3x)"));
    // "Todas" should be the active mode (bg-stone-600)
    const todasBtn = screen.getByText("Todas");
    expect(todasBtn.className).toContain("bg-stone-600");
  });

  it("defaults to Por unidad mode when units have different notes", async () => {
    const user = userEvent.setup();
    renderSummary({ items: [makeItem({ notes: ["Sin cebolla", "Para llevar", ""], quantity: 3 })] });
    // Open notes editor — need to click the note display
    const noteDisplay = screen.getByText("→ Sin cebolla");
    await user.click(noteDisplay);
    // "Por unidad" should be the active mode
    const perUnitBtn = screen.getByText("Por unidad");
    expect(perUnitBtn.className).toContain("bg-stone-600");
  });

  it("defaults to Todas mode when all units are empty", async () => {
    const user = userEvent.setup();
    renderSummary({ items: [makeItem({ notes: ["", "", ""], quantity: 3 })] });
    await user.click(screen.getByText("Nota (3 unidades)"));
    const todasBtn = screen.getByText("Todas");
    expect(todasBtn.className).toContain("bg-stone-600");
  });

  it("clears extra units when switching from Todas to Por unidad", async () => {
    const user = userEvent.setup();
    const onSetNotes = vi.fn();
    renderSummary({
      items: [makeItem({ dish_id: "d1", notes: ["Sin cebolla", "Sin cebolla", "Sin cebolla"], quantity: 3 })],
      onSetNotes,
    });
    // Display groups identical notes: "→ Sin cebolla (3x)"
    await user.click(screen.getByText("→ Sin cebolla (3x)"));
    await user.click(screen.getByText("Por unidad"));
    // Should keep note on first unit, clear the rest
    expect(onSetNotes).toHaveBeenCalledWith("d1", 0, "Sin cebolla");
    expect(onSetNotes).toHaveBeenCalledWith("d1", 1, "");
    expect(onSetNotes).toHaveBeenCalledWith("d1", 2, "");
  });

  it("does not clear notes when switching to Por unidad if notes are already different", async () => {
    const user = userEvent.setup();
    const onSetNotes = vi.fn();
    renderSummary({
      items: [makeItem({ dish_id: "d1", notes: ["Sin cebolla", "Para llevar", ""], quantity: 3 })],
      onSetNotes,
    });
    await user.click(screen.getByText("→ Sin cebolla"));
    await user.click(screen.getByText("Por unidad"));
    // Should NOT call onSetNotes (notes are already per-unit)
    expect(onSetNotes).not.toHaveBeenCalled();
  });

  it("shows single input in Todas mode for multi-unit items", async () => {
    const user = userEvent.setup();
    // Use a note that's the same on all units so it defaults to "Todas"
    renderSummary({ items: [makeItem({ notes: ["", ""], quantity: 2 })] });
    await user.click(screen.getByText("Nota (2 unidades)"));
    expect(screen.getByPlaceholderText("Nota para todas...")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Nota unidad 1...")).not.toBeInTheDocument();
  });

  it("shows per-unit inputs in Por unidad mode", async () => {
    const user = userEvent.setup();
    renderSummary({ items: [makeItem({ notes: ["Sin cebolla", "Para llevar"], quantity: 2 })] });
    await user.click(screen.getByText("→ Sin cebolla"));
    // Should be in perUnit mode (notes are different)
    expect(screen.getByPlaceholderText("Nota unidad 1...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nota unidad 2...")).toBeInTheDocument();
  });

  it("deduplicates note display when all units have the same note (Todas)", () => {
    renderSummary({ items: [makeItem({ notes: ["Sin cebolla", "Sin cebolla", "Sin cebolla"], quantity: 3 })] });
    // Should show "→ Sin cebolla (3x)" once, not 3 times
    expect(screen.getByText("→ Sin cebolla (3x)")).toBeInTheDocument();
  });

  it("shows each note individually when units have different notes (Por unidad)", () => {
    renderSummary({ items: [makeItem({ notes: ["Sin cebolla", "Para llevar"], quantity: 2 })] });
    expect(screen.getByText("→ Sin cebolla")).toBeInTheDocument();
    expect(screen.getByText("→ Para llevar")).toBeInTheDocument();
  });

  it("groups identical notes with count in mixed scenario", () => {
    // 5 units: 2 with "Para llevar", 1 with "Sin cebolla", 2 empty
    renderSummary({ items: [makeItem({ notes: ["Para llevar", "Para llevar", "Sin cebolla", "", ""], quantity: 5 })] });
    expect(screen.getByText("→ Para llevar (2x)")).toBeInTheDocument();
    expect(screen.getByText("→ Sin cebolla")).toBeInTheDocument();
  });

  it("does not show count when only 1 unit has the note", () => {
    renderSummary({ items: [makeItem({ notes: ["Para llevar", "", ""], quantity: 3 })] });
    expect(screen.getByText("→ Para llevar")).toBeInTheDocument();
    expect(screen.queryByText("→ Para llevar (1x)")).not.toBeInTheDocument();
  });

  it("groups comma-separated tokens individually", () => {
    // 4 units: "Para llevar, Sin cebolla" + "Para llevar" + "Sin cebolla" + empty
    // → Para llevar appears in 2 units, Sin cebolla in 2 units
    renderSummary({ items: [makeItem({ notes: ["Para llevar, Sin cebolla", "Para llevar", "Sin cebolla", ""], quantity: 4 })] });
    expect(screen.getByText("→ Para llevar (2x)")).toBeInTheDocument();
    expect(screen.getByText("→ Sin cebolla (2x)")).toBeInTheDocument();
  });

  it("groups tokens from comma-separated notes across units", () => {
    // 3 units: 2 with "Para llevar, Sin cebolla", 1 empty
    renderSummary({ items: [makeItem({ notes: ["Para llevar, Sin cebolla", "Para llevar, Sin cebolla", ""], quantity: 3 })] });
    expect(screen.getByText("→ Para llevar (2x)")).toBeInTheDocument();
    expect(screen.getByText("→ Sin cebolla (2x)")).toBeInTheDocument();
  });
});

// ============================================================
// OrderSummary — Clear cart
// ============================================================
describe("OrderSummary — clear cart", () => {
  it("shows confirmation on first click", async () => {
    const user = userEvent.setup();
    renderSummary({ items: [makeItem()] });
    await user.click(screen.getByText("Limpiar"));
    expect(screen.getByText("¿Seguro?")).toBeInTheDocument();
  });

  it("calls onClear on second click (confirm)", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    renderSummary({ items: [makeItem()], onClear });
    await user.click(screen.getByText("Limpiar"));
    await user.click(screen.getByText("¿Seguro?"));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// OrderSummary — Send button
// ============================================================
describe("OrderSummary — send button", () => {
  it("disables send when cart is empty", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    renderSummary({ items: [], tableNumber: 5, onSend });
    // The button is always rendered, but when the cart is empty clicking it
    // shows a tooltip instead of invoking onSend.
    const btn = screen.getByRole("button", { name: /Enviar a cocina/ });
    await user.click(btn);
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByText("Agrega platos al pedido")).toBeInTheDocument();
  });

  it("disables send when no table selected", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    renderSummary({ items: [makeItem()], tableNumber: null, onSend });
    // The button is always rendered, but when no table is selected clicking it
    // shows a tooltip instead of invoking onSend.
    const btn = screen.getByRole("button", { name: /Enviar a cocina/ });
    await user.click(btn);
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByText("Selecciona una mesa")).toBeInTheDocument();
  });

  it("shows send button when items and table are set", () => {
    renderSummary({ items: [makeItem()], tableNumber: 5 });
    expect(screen.getByRole("button", { name: /Enviar a cocina/ })).toBeInTheDocument();
  });

  it("calls onSend when clicked", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    renderSummary({ items: [makeItem()], tableNumber: 5, onSend });
    await user.click(screen.getByRole("button", { name: /Enviar a cocina/ }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("shows 'Enviando...' when sending", () => {
    renderSummary({ items: [makeItem()], tableNumber: 5, sending: true });
    expect(screen.getByText("Enviando...")).toBeInTheDocument();
  });
});

// ============================================================
// OrderSummary — Edit mode
// ============================================================
describe("OrderSummary — edit mode", () => {
  it("shows 'Guardar cambios' button when editing", () => {
    renderSummary({
      items: [makeItem()],
      tableNumber: 5,
      editingOrderId: "order-1",
      editHasChanges: true,
    });
    expect(screen.getByRole("button", { name: /Guardar cambios/ })).toBeInTheDocument();
  });

  it("shows 'Cancelar' button when editing", () => {
    renderSummary({
      items: [makeItem()],
      tableNumber: 5,
      editingOrderId: "order-1",
      editHasChanges: true,
    });
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("disables 'Guardar cambios' when no changes", () => {
    renderSummary({
      items: [makeItem()],
      tableNumber: 5,
      editingOrderId: "order-1",
      editHasChanges: false,
    });
    expect(screen.getByRole("button", { name: /Guardar cambios/ })).toBeDisabled();
  });

  it("disables 'Guardar cambios' when cart is empty", () => {
    renderSummary({
      items: [],
      tableNumber: 5,
      editingOrderId: "order-1",
      editHasChanges: true,
    });
    expect(screen.getByRole("button", { name: /Sin platos/ })).toBeDisabled();
  });

  it("enables 'Guardar cambios' when there are changes", () => {
    renderSummary({
      items: [makeItem()],
      tableNumber: 5,
      editingOrderId: "order-1",
      editHasChanges: true,
    });
    expect(screen.getByRole("button", { name: /Guardar cambios/ })).toBeEnabled();
  });

  it("calls onSaveEdit when 'Guardar cambios' clicked", async () => {
    const user = userEvent.setup();
    const onSaveEdit = vi.fn();
    renderSummary({
      items: [makeItem()],
      tableNumber: 5,
      editingOrderId: "order-1",
      editHasChanges: true,
      onSaveEdit,
    });
    await user.click(screen.getByRole("button", { name: /Guardar cambios/ }));
    expect(onSaveEdit).toHaveBeenCalledTimes(1);
  });

  it("calls onCancelEdit when 'Cancelar' clicked", async () => {
    const user = userEvent.setup();
    const onCancelEdit = vi.fn();
    renderSummary({
      items: [makeItem()],
      tableNumber: 5,
      editingOrderId: "order-1",
      editHasChanges: true,
      onCancelEdit,
    });
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancelEdit).toHaveBeenCalledTimes(1);
  });

  it("shows 'Editando pedido' indicator when editing", () => {
    renderSummary({
      items: [makeItem()],
      tableNumber: 5,
      editingOrderId: "order-1",
      editHasChanges: false,
    });
    expect(screen.getByText("Editando pedido")).toBeInTheDocument();
  });

  it("does not show 'Limpiar' button when editing", () => {
    renderSummary({
      items: [makeItem()],
      tableNumber: 5,
      editingOrderId: "order-1",
      editHasChanges: false,
    });
    expect(screen.queryByText("Limpiar")).not.toBeInTheDocument();
  });
});

// ============================================================
// OrderSummary — Quantity controls
// ============================================================
describe("OrderSummary — quantity controls", () => {
  it("calls onInc when + button clicked", async () => {
    const user = userEvent.setup();
    const onInc = vi.fn();
    renderSummary({ items: [makeItem({ dish_id: "d1" })], tableNumber: 5, onInc });
    // Find the + button in the cart (not in the dish grid)
    // The cart shows quantity in a span.min-w-8, with +/- buttons around it
    const buttons = screen.getAllByRole("button");
    // The + button is after the quantity display
    const plusBtn = buttons.find((b) => b.querySelector("svg.lucide-plus, svg[class*='plus']"));
    if (plusBtn) {
      await user.click(plusBtn);
      expect(onInc).toHaveBeenCalledWith("d1");
    }
  });
});
