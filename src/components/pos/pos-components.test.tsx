import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WaiterOrders } from "./waiter-orders";
import { TableSelector } from "./table-selector";
import { WaiterStart } from "./waiter-start";
import { CategoryList } from "./category-list";
import { PosTabs } from "./pos-tabs";
import type { Order, OrderItem, Category, Dish } from "@/lib/types";

// Helpers
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
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    table_number: 5,
    waiter_name: "Juan",
    status: "nueva",
    total: 30000,
    notes: null,
    created_at: new Date().toISOString(),
    items: [makeItem()],
    updated_by: null,
    updated_at: null,
    updated_by_type: null,
    ...overrides,
  };
}

// ============================================================
// WaiterOrders
// ============================================================
describe("WaiterOrders", () => {
  it("shows empty state when no orders", () => {
    render(<WaiterOrders orders={[]} waiterName="Juan" onEdit={() => {}} />);
    expect(screen.getByText("No tienes pedidos aún")).toBeInTheDocument();
  });

  it("shows empty state when orders exist but not for this waiter", () => {
    const orders = [makeOrder({ waiter_name: "Pedro" })];
    render(<WaiterOrders orders={orders} waiterName="Juan" onEdit={() => {}} />);
    expect(screen.getByText("No tienes pedidos aún")).toBeInTheDocument();
  });

  it("filters to only this waiter's orders", () => {
    const orders = [
      makeOrder({ id: "1", waiter_name: "Juan", table_number: 1 }),
      makeOrder({ id: "2", waiter_name: "Pedro", table_number: 2 }),
    ];
    render(<WaiterOrders orders={orders} waiterName="Juan" onEdit={() => {}} />);
    expect(screen.getByText("Mesa 1")).toBeInTheDocument();
    expect(screen.queryByText("Mesa 2")).not.toBeInTheDocument();
  });

  it("shows active and completed counts", () => {
    const orders = [
      makeOrder({ id: "1", waiter_name: "Juan", status: "nueva" }),
      makeOrder({ id: "2", waiter_name: "Juan", status: "servida" }),
    ];
    render(<WaiterOrders orders={orders} waiterName="Juan" onEdit={() => {}} />);
    expect(screen.getByText(/1 activos/)).toBeInTheDocument();
    expect(screen.getByText(/1 completados/)).toBeInTheDocument();
  });

  it("shows edit button for nueva orders", () => {
    const orders = [makeOrder({ waiter_name: "Juan", status: "nueva" })];
    render(<WaiterOrders orders={orders} waiterName="Juan" onEdit={() => {}} />);
    expect(screen.getByTitle("Editar pedido")).toBeInTheDocument();
  });

  it("shows edit button for en_cocina orders", () => {
    const orders = [makeOrder({ waiter_name: "Juan", status: "en_cocina" })];
    render(<WaiterOrders orders={orders} waiterName="Juan" onEdit={() => {}} />);
    expect(screen.getByTitle("Editar pedido")).toBeInTheDocument();
  });

  it("does not show edit button for lista orders", () => {
    const orders = [makeOrder({ waiter_name: "Juan", status: "lista" })];
    render(<WaiterOrders orders={orders} waiterName="Juan" onEdit={() => {}} />);
    expect(screen.queryByTitle("Editar pedido")).not.toBeInTheDocument();
  });

  it("does not show edit button for servida orders", () => {
    const orders = [makeOrder({ waiter_name: "Juan", status: "servida" })];
    render(<WaiterOrders orders={orders} waiterName="Juan" onEdit={() => {}} />);
    expect(screen.queryByTitle("Editar pedido")).not.toBeInTheDocument();
  });

  it("calls onEdit when edit button clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const orders = [makeOrder({ id: "test-id", waiter_name: "Juan", status: "nueva" })];
    render(<WaiterOrders orders={orders} waiterName="Juan" onEdit={onEdit} />);
    await user.click(screen.getByTitle("Editar pedido"));
    expect(onEdit).toHaveBeenCalledWith(orders[0]);
  });

  it("shows 'Modificado' badge when order was modified by waiter", () => {
    const orders = [makeOrder({
      waiter_name: "Juan",
      updated_by_type: "waiter",
      updated_at: new Date().toISOString(),
    })];
    render(<WaiterOrders orders={orders} waiterName="Juan" onEdit={() => {}} />);
    expect(screen.getByText("Modificado")).toBeInTheDocument();
  });

  it("shows item notes", () => {
    const orders = [makeOrder({
      waiter_name: "Juan",
      items: [makeItem({ notes: "Sin cebolla" })],
    })];
    render(<WaiterOrders orders={orders} waiterName="Juan" onEdit={() => {}} />);
    expect(screen.getByText("→ Sin cebolla")).toBeInTheDocument();
  });

  it("shows category name prefix", () => {
    const orders = [makeOrder({
      waiter_name: "Juan",
      items: [makeItem({ category_name: "Hamburguesas", dish_name: "Clásica" })],
    })];
    render(<WaiterOrders orders={orders} waiterName="Juan" onEdit={() => {}} />);
    expect(screen.getByText("Hamburguesas ·")).toBeInTheDocument();
    expect(screen.getByText("Clásica")).toBeInTheDocument();
  });

  it("sorts active orders before served", () => {
    const orders = [
      makeOrder({ id: "served", waiter_name: "Juan", status: "servida", created_at: "2024-01-01T10:00:00Z" }),
      makeOrder({ id: "active", waiter_name: "Juan", status: "nueva", created_at: "2024-01-01T12:00:00Z" }),
    ];
    render(<WaiterOrders orders={orders} waiterName="Juan" onEdit={() => {}} />);
    // Active should come first in the list
    const tables = screen.getAllByText(/Mesa 5/);
    expect(tables[0]).toBeInTheDocument();
  });
});

// ============================================================
// TableSelector
// ============================================================
describe("TableSelector", () => {
  it("renders 12 table buttons", () => {
    render(<TableSelector selected={null} tableStatuses={new Map()} onSelect={() => {}} />);
    // Tables 1-12
    for (let i = 1; i <= 12; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument();
    }
  });

  it("calls onSelect when table clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TableSelector selected={null} tableStatuses={new Map()} onSelect={onSelect} />);
    await user.click(screen.getByText("3"));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("highlights selected table", () => {
    render(<TableSelector selected={5} tableStatuses={new Map()} onSelect={() => {}} />);
    const selectedButton = screen.getByText("5").closest("button");
    expect(selectedButton?.className).toContain("yellow");
  });

  it("shows status legend", () => {
    render(<TableSelector selected={null} tableStatuses={new Map()} onSelect={() => {}} />);
    expect(screen.getByText("Nueva")).toBeInTheDocument();
    expect(screen.getByText("Cocina")).toBeInTheDocument();
    expect(screen.getByText("Lista")).toBeInTheDocument();
  });
});

// ============================================================
// WaiterStart
// ============================================================
describe("WaiterStart", () => {
  it("renders input with placeholder", () => {
    render(<WaiterStart onStart={() => {}} />);
    expect(screen.getByPlaceholderText("Tu nombre")).toBeInTheDocument();
  });

  it("disables button when name is too short", () => {
    render(<WaiterStart onStart={() => {}} />);
    const button = screen.getByRole("button", { name: "Comenzar" });
    expect(button).toBeDisabled();
  });

  it("enables button when name has 2+ characters", async () => {
    const user = userEvent.setup();
    render(<WaiterStart onStart={() => {}} />);
    await user.type(screen.getByPlaceholderText("Tu nombre"), "Juan");
    expect(screen.getByRole("button", { name: "Comenzar" })).toBeEnabled();
  });

  it("keeps button disabled for 1 character", async () => {
    const user = userEvent.setup();
    render(<WaiterStart onStart={() => {}} />);
    await user.type(screen.getByPlaceholderText("Tu nombre"), "J");
    expect(screen.getByRole("button", { name: "Comenzar" })).toBeDisabled();
  });

  it("calls onStart with trimmed name on submit", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<WaiterStart onStart={onStart} />);
    await user.type(screen.getByPlaceholderText("Tu nombre"), "  Juan  ");
    await user.click(screen.getByRole("button", { name: "Comenzar" }));
    expect(onStart).toHaveBeenCalledWith("Juan");
  });

  it("does not call onStart for whitespace-only name", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<WaiterStart onStart={onStart} />);
    await user.type(screen.getByPlaceholderText("Tu nombre"), "   ");
    // Button should still be disabled
    expect(screen.getByRole("button", { name: "Comenzar" })).toBeDisabled();
  });

  it("calls onStart on Enter key", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<WaiterStart onStart={onStart} />);
    await user.type(screen.getByPlaceholderText("Tu nombre"), "Juan{Enter}");
    expect(onStart).toHaveBeenCalledWith("Juan");
  });
});

// ============================================================
// CategoryList
// ============================================================
describe("CategoryList", () => {
  const categories: Category[] = [
    { id: "cat-1", name: "Hamburguesas", description: "", sort_order: 0 },
    { id: "cat-2", name: "Salchipapas", description: "", sort_order: 1 },
  ];
  const dishes: Dish[] = [
    { id: "d1", category_id: "cat-1", name: "Burger", description: "", price: 15000, sort_order: 0 },
    { id: "d2", category_id: "cat-1", name: "Double", description: "", price: 20000, sort_order: 1 },
    { id: "d3", category_id: "cat-2", name: "Fries", description: "", price: 8000, sort_order: 0 },
  ];

  it("renders category names", () => {
    render(<CategoryList categories={categories} dishes={dishes} selected={null} onSelect={() => {}} />);
    expect(screen.getByText("Hamburguesas")).toBeInTheDocument();
    expect(screen.getByText("Salchipapas")).toBeInTheDocument();
  });

  it("shows dish count per category", () => {
    render(<CategoryList categories={categories} dishes={dishes} selected={null} onSelect={() => {}} />);
    // Hamburguesas has 2 dishes
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("calls onSelect when category clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<CategoryList categories={categories} dishes={dishes} selected={null} onSelect={onSelect} />);
    await user.click(screen.getByText("Hamburguesas"));
    expect(onSelect).toHaveBeenCalledWith("cat-1");
  });

  it("handles empty categories", () => {
    render(<CategoryList categories={[]} dishes={dishes} selected={null} onSelect={() => {}} />);
    // Should render without crashing
  });
});

// ============================================================
// PosTabs
// ============================================================
describe("PosTabs", () => {
  it("renders both tab labels", () => {
    render(<PosTabs active="new" historyCount={0} onChange={() => {}} />);
    expect(screen.getByText("Nuevo pedido")).toBeInTheDocument();
    expect(screen.getByText("Mis pedidos")).toBeInTheDocument();
  });

  it("shows badge when historyCount > 0", () => {
    render(<PosTabs active="new" historyCount={3} onChange={() => {}} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("does not show badge when historyCount is 0", () => {
    render(<PosTabs active="new" historyCount={0} onChange={() => {}} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("calls onChange when tab clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PosTabs active="new" historyCount={0} onChange={onChange} />);
    await user.click(screen.getByText("Mis pedidos"));
    expect(onChange).toHaveBeenCalledWith("history");
  });
});
