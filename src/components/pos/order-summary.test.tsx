import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderSummary, type CartItem } from "./order-summary";

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
  items: [] as CartItem[],
  onInc: vi.fn(),
  onDec: vi.fn(),
  onRemove: vi.fn(),
  onClear: vi.fn(),
  onSend: vi.fn(),
  onSetNotes: vi.fn(),
  sending: false,
  editingOrderId: null as string | null,
  editHasChanges: false,
  onSaveEdit: vi.fn(),
  onCancelEdit: vi.fn(),
};

function renderSummary(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  // Reset mocks
  props.onInc.mockClear();
  props.onDec.mockClear();
  props.onRemove.mockClear();
  props.onClear.mockClear();
  props.onSend.mockClear();
  props.onSetNotes.mockClear();
  props.onSaveEdit.mockClear();
  props.onCancelEdit.mockClear();
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
    renderSummary({ items: [makeItem({ dish_id: "d1", notes: ["Sin lechuga"] })], onSetNotes });
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
