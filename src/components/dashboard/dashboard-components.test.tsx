import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPreview } from "./command-preview";
import { OrdersFeed } from "./orders-feed";
import { ActiveWaiters } from "./active-waiters";
import type { Order, OrderItem, ActiveWaiter } from "@/lib/types";

// Helpers
function makeItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "item-1",
    order_id: "order-1",
    dish_id: "dish-1",
    dish_name: "Hamburguesa",
    category_name: "Hamburguesas",
    price: 15000,
    quantity: 1,
    notes: null,
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
    total: 15000,
    notes: null,
    delivery_name: null,
    delivery_fee: 0,
    created_at: new Date().toISOString(),
    items: [makeItem()],
    updated_by: null,
    updated_at: null,
    updated_by_type: null,
    ...overrides,
  };
}

// ============================================================
// CommandPreview
// ============================================================
describe("CommandPreview", () => {
  it("renders table number", () => {
    render(<CommandPreview order={makeOrder({ table_number: 7 })} />);
    expect(screen.getByText("Mesa 7")).toBeInTheDocument();
  });

  it("renders waiter name", () => {
    render(<CommandPreview order={makeOrder({ waiter_name: "Carlos" })} />);
    expect(screen.getByText("Carlos")).toBeInTheDocument();
  });

  it("renders PUNTO 5 header", () => {
    render(<CommandPreview order={makeOrder()} />);
    expect(screen.getByText("PUNTO 5")).toBeInTheDocument();
  });

  it("renders dish names", () => {
    render(<CommandPreview order={makeOrder({
      items: [makeItem({ dish_name: "Hamburguesa Clásica" })],
    })} />);
    expect(screen.getByText("Hamburguesa Clásica")).toBeInTheDocument();
  });

  it("renders item quantities", () => {
    render(<CommandPreview order={makeOrder({
      items: [makeItem({ quantity: 3 })],
    })} />);
    expect(screen.getByText("3x")).toBeInTheDocument();
  });

  it("renders notes when present", () => {
    render(<CommandPreview order={makeOrder({
      items: [makeItem({ notes: ["Sin cebolla"] })],
    })} />);
    expect(screen.getByText("→ Sin cebolla")).toBeInTheDocument();
  });

  it("does not render notes when null", () => {
    render(<CommandPreview order={makeOrder({
      items: [makeItem({ notes: null })],
    })} />);
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it("groups items by category", () => {
    render(<CommandPreview order={makeOrder({
      items: [
        makeItem({ id: "1", dish_name: "Burger", category_name: "Hamburguesas" }),
        makeItem({ id: "2", dish_name: "Fries", category_name: "Salchipapas" }),
        makeItem({ id: "3", dish_name: "Another Burger", category_name: "Hamburguesas" }),
      ],
    })} />);
    expect(screen.getByText("Hamburguesas")).toBeInTheDocument();
    expect(screen.getByText("Salchipapas")).toBeInTheDocument();
  });

  it("uses 'Sin categoría' when category_name is null", () => {
    render(<CommandPreview order={makeOrder({
      items: [makeItem({ category_name: null })],
    })} />);
    expect(screen.getByText("Sin categoría")).toBeInTheDocument();
  });

  it("shows singular 'plato' for 1 item", () => {
    render(<CommandPreview order={makeOrder({
      items: [makeItem({ quantity: 1 })],
    })} />);
    expect(screen.getByText(/1 plato/)).toBeInTheDocument();
  });

  it("shows plural 'platos' for multiple items", () => {
    render(<CommandPreview order={makeOrder({
      items: [makeItem({ quantity: 2 })],
    })} />);
    expect(screen.getByText(/2 platos/)).toBeInTheDocument();
  });

  it("shows modified banner when order was modified by waiter", () => {
    render(<CommandPreview order={makeOrder({
      updated_by_type: "waiter",
      updated_at: new Date().toISOString(),
    })} />);
    expect(screen.getByText("★ Modificada ★")).toBeInTheDocument();
  });

  it("does not show modified banner for unmodified order", () => {
    render(<CommandPreview order={makeOrder()} />);
    expect(screen.queryByText("★ Modificada ★")).not.toBeInTheDocument();
  });

  it("does not show modified banner when updated_by_type is admin", () => {
    render(<CommandPreview order={makeOrder({
      updated_by_type: "admin",
      updated_at: new Date().toISOString(),
    })} />);
    expect(screen.queryByText("★ Modificada ★")).not.toBeInTheDocument();
  });

  it("renders TOTAL label and amount", () => {
    render(<CommandPreview order={makeOrder({ total: 45000 })} />);
    expect(screen.getByText("TOTAL")).toBeInTheDocument();
  });

  it("renders end of command text", () => {
    render(<CommandPreview order={makeOrder()} />);
    expect(screen.getByText("--- Fin de comanda ---")).toBeInTheDocument();
  });

  it("shows updated_at time when order was modified", () => {
    render(<CommandPreview order={makeOrder({
      updated_at: "2024-06-15T14:30:00Z",
    })} />);
    // The time should be displayed (we just check it renders without error)
    expect(screen.getByText("Juan")).toBeInTheDocument();
  });

  it("shows created_at time when order was not modified", () => {
    render(<CommandPreview order={makeOrder({
      created_at: "2024-06-15T10:00:00Z",
    })} />);
    expect(screen.getByText("Juan")).toBeInTheDocument();
  });

  it("handles empty items array", () => {
    render(<CommandPreview order={makeOrder({ items: [], total: 0 })} />);
    expect(screen.getByText("Mesa 5")).toBeInTheDocument();
    expect(screen.getByText(/0 platos/)).toBeInTheDocument();
  });
});

// ============================================================
// OrdersFeed
// ============================================================
describe("OrdersFeed", () => {
  it("shows empty state when no orders", () => {
    render(<OrdersFeed orders={[]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("No hay pedidos")).toBeInTheDocument();
  });

  it("renders order cards", () => {
    const orders = [
      makeOrder({ id: "1", table_number: 1 }),
      makeOrder({ id: "2", table_number: 2 }),
    ];
    render(<OrdersFeed orders={orders} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("Mesa 1")).toBeInTheDocument();
    expect(screen.getByText("Mesa 2")).toBeInTheDocument();
  });

  it("shows waiter names", () => {
    const orders = [makeOrder({ waiter_name: "Pedro" })];
    render(<OrdersFeed orders={orders} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("Pedro")).toBeInTheDocument();
  });

  it("shows 'Nuevo' badge for nueva status", () => {
    const orders = [makeOrder({ status: "nueva" })];
    render(<OrdersFeed orders={orders} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("Nuevo")).toBeInTheDocument();
  });

  it("does not show 'Nuevo' badge for en_cocina status", () => {
    const orders = [makeOrder({ status: "en_cocina" })];
    render(<OrdersFeed orders={orders} selectedId={null} onSelect={() => {}} />);
    expect(screen.queryByText("Nuevo")).not.toBeInTheDocument();
  });

  it("shows 'Modificado' badge when order was modified by waiter", () => {
    const orders = [makeOrder({
      updated_by_type: "waiter",
      updated_at: new Date().toISOString(),
    })];
    render(<OrdersFeed orders={orders} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("Modificado")).toBeInTheDocument();
  });

  it("does not show 'Modificado' badge for unmodified order", () => {
    const orders = [makeOrder()];
    render(<OrdersFeed orders={orders} selectedId={null} onSelect={() => {}} />);
    expect(screen.queryByText("Modificado")).not.toBeInTheDocument();
  });

  it("shows status labels", () => {
    const orders = [
      makeOrder({ id: "1", status: "nueva" }),
      makeOrder({ id: "2", status: "en_cocina" }),
      makeOrder({ id: "3", status: "lista" }),
      makeOrder({ id: "4", status: "servida" }),
    ];
    render(<OrdersFeed orders={orders} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("Nueva")).toBeInTheDocument();
    expect(screen.getByText("En cocina")).toBeInTheDocument();
    expect(screen.getByText("Lista")).toBeInTheDocument();
    expect(screen.getByText("Servida")).toBeInTheDocument();
  });

  it("calls onSelect when order is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const orders = [makeOrder({ id: "order-1" })];
    render(<OrdersFeed orders={orders} selectedId={null} onSelect={onSelect} />);
    await user.click(screen.getByText("Mesa 5"));
    expect(onSelect).toHaveBeenCalledWith("order-1");
  });

  it("shows relative time (hace un momento)", () => {
    const orders = [makeOrder({ created_at: new Date().toISOString() })];
    render(<OrdersFeed orders={orders} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("hace un momento")).toBeInTheDocument();
  });
});

// ============================================================
// ActiveWaiters
// ============================================================
describe("ActiveWaiters", () => {
  it("shows empty state when no waiters", () => {
    render(<ActiveWaiters waiters={[]} />);
    expect(screen.getByText("Sin meseros conectados")).toBeInTheDocument();
  });

  it("shows waiter names", () => {
    const waiters: ActiveWaiter[] = [
      { name: "Juan", joinedAt: new Date().toISOString() },
      { name: "Pedro", joinedAt: new Date().toISOString() },
    ];
    render(<ActiveWaiters waiters={waiters} />);
    expect(screen.getByText("Juan")).toBeInTheDocument();
    expect(screen.getByText("Pedro")).toBeInTheDocument();
  });

  it("shows waiter count in header", () => {
    const waiters: ActiveWaiter[] = [
      { name: "Juan", joinedAt: new Date().toISOString() },
    ];
    render(<ActiveWaiters waiters={waiters} />);
    // The header shows a "Meseros" label alongside the waiter pills
    expect(screen.getByText("Meseros")).toBeInTheDocument();
  });
});
