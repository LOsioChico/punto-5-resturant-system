import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderDetail } from "./order-detail";
import type { Order, OrderEvent, OrderItem } from "@/lib/types";

function makeItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "item-1",
    order_id: "order-1",
    dish_id: "dish-1",
    dish_name: "Hamburguesa",
    category_name: "Hamburguesas",
    price: 15000,
    quantity: 2,
    notes: null,
    is_additional: false,
    additional_number: null,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    table_number: 5,
    waiter_name: "Juan",
    waiter_id: "waiter-1",
    status: "nueva",
    total: 30000,
    notes: null,
    delivery_name: null,
    delivery_fee: 0,
    created_at: new Date().toISOString(),
    items: [makeItem()],
    updated_by: null,
    updated_at: null,
    updated_by_type: null,
    deleted_at: null,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<OrderEvent> = {}): OrderEvent {
  return {
    id: "event-1",
    order_id: "order-1",
    event_type: "created",
    actor_type: "waiter",
    actor_name: "Juan",
    actor_id: null,
    from_status: null,
    to_status: null,
    metadata: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const noop = () => {};

// ============================================================
// OrderDetail — Empty state
// ============================================================
describe("OrderDetail — empty state", () => {
  it("shows empty state when no order selected", () => {
    render(<OrderDetail order={null} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByText("Selecciona un pedido")).toBeInTheDocument();
  });
});

// ============================================================
// OrderDetail — Header
// ============================================================
describe("OrderDetail — header", () => {
  it("shows table number", () => {
    render(<OrderDetail order={makeOrder({ table_number: 7 })} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    // "Mesa 7" appears in both the header <h2> and the CommandPreview;
    // target the header heading specifically.
    expect(screen.getByRole("heading", { name: "Mesa 7" })).toBeInTheDocument();
  });

  it("shows waiter name", () => {
    render(<OrderDetail order={makeOrder({ waiter_name: "Carlos" })} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    // "Carlos" appears in the header and in the CommandPreview.
    expect(screen.getAllByText("Carlos").length).toBeGreaterThan(0);
  });

  it("shows status label", () => {
    render(<OrderDetail order={makeOrder({ status: "en_cocina" })} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    // "En cocina" appears in the header badge and in the progress steps.
    expect(screen.getAllByText("En cocina").length).toBeGreaterThan(0);
  });

  it("shows 'Modificado por' badge when order has 'updated' event", () => {
    const events = [makeEvent({ event_type: "updated", actor_name: "Juan" })];
    render(<OrderDetail order={makeOrder({
      updated_by: "Juan",
      updated_at: new Date().toISOString(),
      updated_by_type: "waiter",
    })} events={events} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByText(/Modificado por Juan/)).toBeInTheDocument();
  });

  it("does not show 'Modificado por' badge when updated event exists but updated_at is null", () => {
    const events = [makeEvent({ event_type: "updated", actor_name: "Juan" })];
    render(<OrderDetail order={makeOrder({
      updated_by: "Juan",
      updated_at: null,
      updated_by_type: "waiter",
    })} events={events} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.queryByText(/Modificado por/)).not.toBeInTheDocument();
  });

  it("does not show 'Modificado por' badge when not modified", () => {
    render(<OrderDetail order={makeOrder()} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.queryByText(/Modificado por/)).not.toBeInTheDocument();
  });

  it("does not show 'Modificado por' badge for additional_added event", () => {
    const events = [makeEvent({ event_type: "additional_added", actor_name: "Juan" })];
    render(<OrderDetail order={makeOrder({
      updated_by: "Juan",
      updated_at: new Date().toISOString(),
      updated_by_type: "waiter",
      status: "adicional",
    })} events={events} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.queryByText(/Modificado por/)).not.toBeInTheDocument();
  });

  it("does not show 'Modificado por' badge when modified by admin", () => {
    render(<OrderDetail order={makeOrder({
      updated_by: "admin",
      updated_at: new Date().toISOString(),
      updated_by_type: "admin",
    })} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.queryByText(/Modificado por/)).not.toBeInTheDocument();
  });
});

// ============================================================
// OrderDetail — Progress steps
// ============================================================
describe("OrderDetail — progress steps", () => {
  it("shows all 4 status labels in progress", () => {
    render(<OrderDetail order={makeOrder({ status: "nueva" })} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getAllByText("Nueva").length).toBeGreaterThan(0);
    expect(screen.getAllByText("En cocina").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Servida").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Finalizada").length).toBeGreaterThan(0);
  });
});

// ============================================================
// OrderDetail — Action button
// ============================================================
describe("OrderDetail — action button", () => {
  it("shows 'Enviar a cocina' for nueva status", () => {
    render(<OrderDetail order={makeOrder({ status: "nueva" })} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByRole("button", { name: /Enviar a cocina/ })).toBeInTheDocument();
  });

  it("shows 'Marcar como servida' for en_cocina status", () => {
    render(<OrderDetail order={makeOrder({ status: "en_cocina" })} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByRole("button", { name: /Marcar como servida/ })).toBeInTheDocument();
  });

  it("shows 'Finalizar pedido' for servida status", () => {
    render(<OrderDetail order={makeOrder({ status: "servida" })} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByRole("button", { name: /Finalizar pedido/ })).toBeInTheDocument();
  });

  it("does not show action button for finalizada status", () => {
    render(<OrderDetail order={makeOrder({ status: "finalizada" })} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.queryByRole("button", { name: /Enviar|Marcar|Finalizar/ })).not.toBeInTheDocument();
  });

  it("calls onAdvanceStatus when action button clicked", async () => {
    const user = userEvent.setup();
    const onAdvanceStatus = vi.fn();
    render(<OrderDetail order={makeOrder({ id: "test-id", status: "nueva" })} events={[]} onAdvanceStatus={onAdvanceStatus} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    await user.click(screen.getByRole("button", { name: /Enviar a cocina/ }));
    expect(onAdvanceStatus).toHaveBeenCalledWith("test-id");
  });

  it("disables action button when disabled prop is true", () => {
    render(<OrderDetail order={makeOrder({ status: "nueva" })} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} disabled />);
    expect(screen.getByRole("button", { name: /Enviar a cocina/ })).toBeDisabled();
  });
});

// ============================================================
// OrderDetail — Print
// ============================================================
describe("OrderDetail — print", () => {
  it("shows print button", () => {
    render(<OrderDetail order={makeOrder()} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByRole("button", { name: /Imprimir/ })).toBeInTheDocument();
  });

  it("calls onPrint when print button clicked", async () => {
    const user = userEvent.setup();
    const onPrint = vi.fn();
    render(<OrderDetail order={makeOrder({ id: "print-id" })} events={[]} onAdvanceStatus={noop} onPrint={onPrint} onSetDeliveryFee={noop} onDelete={noop} />);
    await user.click(screen.getByRole("button", { name: /Imprimir/ }));
    expect(onPrint).toHaveBeenCalledWith("print-id", { type: "full" });
  });

  it("disables print button when disabled prop is true", () => {
    render(<OrderDetail order={makeOrder()} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} disabled />);
    expect(screen.getByRole("button", { name: /Imprimir/ })).toBeDisabled();
  });

  it("shows print count when there are print events", () => {
    const events = [
      makeEvent({ id: "e1", event_type: "printed" }),
      makeEvent({ id: "e2", event_type: "printed" }),
    ];
    render(<OrderDetail order={makeOrder()} events={events} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByText(/2 impresiones/)).toBeInTheDocument();
  });

  it("shows singular 'impresión' for 1 print event", () => {
    const events = [makeEvent({ event_type: "printed" })];
    render(<OrderDetail order={makeOrder()} events={events} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByText(/1 impresión/)).toBeInTheDocument();
  });

  it("does not show print count when no print events", () => {
    render(<OrderDetail order={makeOrder()} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.queryByText(/impresión/)).not.toBeInTheDocument();
  });
});

// ============================================================
// OrderDetail — Items
// ============================================================
describe("OrderDetail — items", () => {
  it("renders item names", () => {
    render(<OrderDetail order={makeOrder({
      items: [makeItem({ dish_name: "Hamburguesa Doble" })],
    })} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    // The dish name appears in both the items list and the CommandPreview.
    expect(screen.getAllByText("Hamburguesa Doble").length).toBeGreaterThan(0);
  });

  it("renders item quantities", () => {
    render(<OrderDetail order={makeOrder({
      items: [makeItem({ quantity: 3 })],
    })} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows notes with arrow prefix", () => {
    render(<OrderDetail order={makeOrder({
      items: [makeItem({ notes: ["Sin cebolla"] })],
    })} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    // Notes with arrow prefix appear in both the items list and the CommandPreview.
    expect(screen.getAllByText("→ Sin cebolla (1x)").length).toBeGreaterThan(0);
  });

  it("does not show notes when null", () => {
    render(<OrderDetail order={makeOrder({
      items: [makeItem({ notes: null })],
    })} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it("groups identical notes with count", () => {
    render(<OrderDetail order={makeOrder({
      items: [makeItem({ quantity: 3, notes: ["Sin cebolla", "Sin cebolla", "Sin cebolla"] })],
    })} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getAllByText("→ Sin cebolla (3x)").length).toBeGreaterThan(0);
  });

  it("shows per-unit notes when they differ", () => {
    render(<OrderDetail order={makeOrder({
      items: [makeItem({ quantity: 2, notes: ["Sin cebolla", "Para llevar"] })],
    })} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getAllByText("U1: Sin cebolla").length).toBeGreaterThan(0);
    expect(screen.getAllByText("U2: Para llevar").length).toBeGreaterThan(0);
  });

  it("groups notes with same tokens in different order", () => {
    render(<OrderDetail order={makeOrder({
      items: [makeItem({ quantity: 2, notes: ["Para llevar, Sin cebolla", "Sin cebolla, Para llevar"] })],
    })} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getAllByText("→ Para llevar, Sin cebolla (2x)").length).toBeGreaterThan(0);
  });

  it("shows total", () => {
    render(<OrderDetail order={makeOrder({ total: 45000 })} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByText("Total")).toBeInTheDocument();
  });
});

// ============================================================
// OrderDetail — History / Audit trail
// ============================================================
describe("OrderDetail — history", () => {
  it("shows 'Sin eventos registrados' when no events", () => {
    render(<OrderDetail order={makeOrder()} events={[]} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByText("Sin eventos registrados")).toBeInTheDocument();
  });

  it("shows event count in header", () => {
    const events = [
      makeEvent({ id: "e1" }),
      makeEvent({ id: "e2" }),
    ];
    render(<OrderDetail order={makeOrder()} events={events} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByText(/Historial \(2\)/)).toBeInTheDocument();
  });

  it("shows 'Pedido creado' for created event", () => {
    const events = [makeEvent({ event_type: "created" })];
    render(<OrderDetail order={makeOrder()} events={events} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByText("Pedido creado")).toBeInTheDocument();
  });

  it("shows 'Cambio de estado' for status_changed event", () => {
    const events = [makeEvent({ event_type: "status_changed" })];
    render(<OrderDetail order={makeOrder()} events={events} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByText("Cambio de estado")).toBeInTheDocument();
  });

  it("shows 'Impresión de comanda' for printed event", () => {
    const events = [makeEvent({ event_type: "printed" })];
    render(<OrderDetail order={makeOrder()} events={events} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByText("Impresión de comanda")).toBeInTheDocument();
  });

  it("shows 'Actualización' for updated event", () => {
    const events = [makeEvent({ event_type: "updated" })];
    render(<OrderDetail order={makeOrder()} events={events} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByText("Actualización")).toBeInTheDocument();
  });

  it("shows actor name", () => {
    const events = [makeEvent({ actor_name: "Maria" })];
    render(<OrderDetail order={makeOrder()} events={events} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByText("Maria")).toBeInTheDocument();
  });

  it("shows status transition (from → to)", () => {
    const events = [makeEvent({
      event_type: "status_changed",
      from_status: "nueva",
      to_status: "en_cocina",
    })];
    render(<OrderDetail order={makeOrder()} events={events} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    // Status labels appear in the header, progress steps, and the transition line.
    expect(screen.getAllByText(/Nueva/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/En cocina/).length).toBeGreaterThan(0);
  });

  it("shows change badges (+added, -removed, modified)", () => {
    const events = [makeEvent({
      event_type: "updated",
      metadata: { added: 2, updated: 1, removed: 1 },
    })];
    render(<OrderDetail order={makeOrder()} events={events} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByText("+2 agregados")).toBeInTheDocument();
    expect(screen.getByText("1 modificado")).toBeInTheDocument();
    expect(screen.getByText("-1 eliminado")).toBeInTheDocument();
  });

  it("shows detail lines for added items", () => {
    const events = [makeEvent({
      event_type: "updated",
      metadata: {
        added: 1,
        added_items: [{ name: "Papas Fritas", qty: 2 }],
      },
    })];
    render(<OrderDetail order={makeOrder()} events={events} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByText(/Papas Fritas \(2x\)/)).toBeInTheDocument();
  });

  it("shows detail lines for updated items with quantity change", () => {
    const events = [makeEvent({
      event_type: "updated",
      metadata: {
        updated: 1,
        updated_items: [{ name: "Burger", qty: 3, old_qty: 1, notes: null, old_notes: null }],
      },
    })];
    render(<OrderDetail order={makeOrder()} events={events} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByText(/Burger/)).toBeInTheDocument();
    expect(screen.getByText(/1x → 3x/)).toBeInTheDocument();
  });

  it("shows detail lines for removed items", () => {
    const events = [makeEvent({
      event_type: "updated",
      metadata: {
        removed: 1,
        removed_items: [{ name: "Refresco", qty: 1 }],
      },
    })];
    render(<OrderDetail order={makeOrder()} events={events} onAdvanceStatus={noop} onPrint={noop} onSetDeliveryFee={noop} onDelete={noop} />);
    expect(screen.getByText(/Refresco \(1x\)/)).toBeInTheDocument();
  });
});
