import { describe, it, expect } from "vitest";
import {
  STATUS_FLOW,
  nextStatus,
  advanceActionLabel,
  statusLabel,
  statusLabelPlural,
  wasModified,
  canEditOrder,
  isOrderActive,
  filterByDate,
  filterByStatus,
  filterByWaiter,
  filterByTable,
  searchOrders,
  getVisibleWaiters,
  getVisibleTables,
  countByStatus,
  calculateRevenue,
  getTableStatuses,
  sortOrders,
  countPrints,
  parseEventMetadata,
  hasAdditionals,
  maxAdditionalNumber,
  getAdditionalItems,
  getOriginalItems,
  additionalSubtotal,
} from "./logic";
import type { Order, OrderEvent, OrderItem } from "@/lib/types";

// Helpers
function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    table_number: 1,
    waiter_name: "Juan",
    waiter_id: "waiter-1",
    status: "nueva",
    total: 25000,
    notes: null,
    delivery_name: null,
    delivery_fee: 0,
    created_at: new Date().toISOString(),
    items: [],
    updated_by: null,
    updated_at: null,
    updated_by_type: null,
    deleted_at: null,
    ...overrides,
  };
}

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
    is_additional: false,
    additional_number: null,
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

// ============================================================
// STATUS_FLOW
// ============================================================
describe("STATUS_FLOW", () => {
  it("has 4 statuses in correct order", () => {
    expect(STATUS_FLOW).toEqual(["nueva", "en_cocina", "servida", "finalizada"]);
  });
});

// ============================================================
// nextStatus
// ============================================================
describe("nextStatus", () => {
  it("returns en_cocina for nueva", () => {
    expect(nextStatus("nueva")).toBe("en_cocina");
  });

  it("returns servida for en_cocina", () => {
    expect(nextStatus("en_cocina")).toBe("servida");
  });

  it("returns finalizada for servida", () => {
    expect(nextStatus("servida")).toBe("finalizada");
  });

  it("returns null for finalizada (terminal status)", () => {
    expect(nextStatus("finalizada")).toBeNull();
  });

  it("returns finalizada for adicional (order was already served)", () => {
    expect(nextStatus("adicional")).toBe("finalizada");
  });
});

// ============================================================
// advanceActionLabel
// ============================================================
describe("advanceActionLabel", () => {
  it("returns 'Enviar a cocina' for nueva", () => {
    expect(advanceActionLabel("nueva")).toBe("Enviar a cocina");
  });

  it("returns 'Marcar como servida' for en_cocina", () => {
    expect(advanceActionLabel("en_cocina")).toBe("Marcar como servida");
  });

  it("returns 'Finalizar pedido' for servida", () => {
    expect(advanceActionLabel("servida")).toBe("Finalizar pedido");
  });

  it("returns empty string for finalizada", () => {
    expect(advanceActionLabel("finalizada")).toBe("");
  });

  it("returns 'Finalizar pedido' for adicional", () => {
    expect(advanceActionLabel("adicional")).toBe("Finalizar pedido");
  });

  it("returns 'Marcar en camino' for en_cocina delivery", () => {
    expect(advanceActionLabel("en_cocina", true)).toBe("Marcar en camino");
  });
});

// ============================================================
// statusLabel
// ============================================================
describe("statusLabel", () => {
  it("returns 'Servida' for servida (dine-in)", () => {
    expect(statusLabel("servida", false)).toBe("Servida");
  });

  it("returns 'En camino' for servida delivery", () => {
    expect(statusLabel("servida", true)).toBe("En camino");
  });

  it("returns 'Nueva' for nueva regardless of delivery", () => {
    expect(statusLabel("nueva", true)).toBe("Nueva");
  });
});

// ============================================================
// statusLabelPlural
// ============================================================
describe("statusLabelPlural", () => {
  it("returns 'Servidas' for servida (dine-in)", () => {
    expect(statusLabelPlural("servida", false)).toBe("Servidas");
  });

  it("returns 'En camino' for servida delivery", () => {
    expect(statusLabelPlural("servida", true)).toBe("En camino");
  });
});

// ============================================================
// wasModified
// ============================================================
describe("wasModified", () => {
  it("returns false for unmodified order", () => {
    expect(wasModified(makeOrder())).toBe(false);
  });

  it("returns true when updated_by_type is waiter and updated_at is set", () => {
    expect(wasModified(makeOrder({
      updated_by_type: "waiter",
      updated_at: new Date().toISOString(),
    }))).toBe(true);
  });

  it("returns false when updated_by_type is admin", () => {
    expect(wasModified(makeOrder({
      updated_by_type: "admin",
      updated_at: new Date().toISOString(),
    }))).toBe(false);
  });

  it("returns false when updated_at is null", () => {
    expect(wasModified(makeOrder({
      updated_by_type: "waiter",
      updated_at: null,
    }))).toBe(false);
  });
});

// ============================================================
// canEditOrder
// ============================================================
describe("canEditOrder", () => {
  it("allows editing nueva orders", () => {
    expect(canEditOrder("nueva")).toBe(true);
  });

  it("allows editing en_cocina orders", () => {
    expect(canEditOrder("en_cocina")).toBe(true);
  });

  it("does not allow editing servida orders", () => {
    expect(canEditOrder("servida")).toBe(false);
  });

  it("does not allow editing finalizada orders", () => {
    expect(canEditOrder("finalizada")).toBe(false);
  });
});

// ============================================================
// isOrderActive
// ============================================================
describe("isOrderActive", () => {
  it("returns true for nueva", () => {
    expect(isOrderActive("nueva")).toBe(true);
  });

  it("returns true for en_cocina", () => {
    expect(isOrderActive("en_cocina")).toBe(true);
  });

  it("returns true for servida", () => {
    expect(isOrderActive("servida")).toBe(true);
  });

  it("returns false for finalizada", () => {
    expect(isOrderActive("finalizada")).toBe(false);
  });
});

// ============================================================
// filterByDate
// ============================================================
describe("filterByDate", () => {
  // Use explicit UTC times so tests are timezone-independent.
  // June 15, 2024 19:30 UTC = 14:30 Colombia (UTC-5)
  const now = new Date("2024-06-15T19:30:00Z");

  // 10:00 Colombia = 15:00 UTC on June 15
  const todayOrder = makeOrder({
    id: "today",
    created_at: "2024-06-15T15:00:00Z",
  });
  // 13:00 Colombia = 18:00 UTC on June 14
  const yesterdayOrder = makeOrder({
    id: "yesterday",
    created_at: "2024-06-14T18:00:00Z",
  });
  // 07:00 Colombia = 12:00 UTC on June 13
  const twoDaysAgoOrder = makeOrder({
    id: "two-days-ago",
    created_at: "2024-06-13T12:00:00Z",
  });
  const orders = [todayOrder, yesterdayOrder, twoDaysAgoOrder];

  it("returns all orders when filter is 'all'", () => {
    expect(filterByDate(orders, "all", now)).toHaveLength(3);
  });

  it("filters to today only", () => {
    const result = filterByDate(orders, "today", now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("today");
  });

  it("filters to yesterday only", () => {
    const result = filterByDate(orders, "yesterday", now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("yesterday");
  });

  it("excludes orders from other days", () => {
    const result = filterByDate(orders, "today", now);
    expect(result.find((o) => o.id === "yesterday")).toBeUndefined();
    expect(result.find((o) => o.id === "two-days-ago")).toBeUndefined();
  });

  it("handles order at exactly midnight Colombia (05:00 UTC)", () => {
    // 00:00 Colombia June 15 = 05:00 UTC June 15
    const midnightOrder = makeOrder({
      id: "midnight",
      created_at: "2024-06-15T05:00:00Z",
    });
    const result = filterByDate([midnightOrder], "today", now);
    expect(result).toHaveLength(1);
  });

  it("handles order at 23:59 Colombia (04:59 UTC next day)", () => {
    // 23:59 Colombia June 15 = 04:59 UTC June 16
    const lateOrder = makeOrder({
      id: "late",
      created_at: "2024-06-16T04:59:00Z",
    });
    const result = filterByDate([lateOrder], "today", now);
    expect(result).toHaveLength(1);
  });

  it("excludes order at exactly midnight of next day Colombia", () => {
    // 00:00 Colombia June 16 = 05:00 UTC June 16
    const nextDayMidnight = makeOrder({
      id: "next-midnight",
      created_at: "2024-06-16T05:00:00Z",
    });
    const result = filterByDate([nextDayMidnight], "today", now);
    expect(result).toHaveLength(0);
  });

  it("handles empty orders array", () => {
    expect(filterByDate([], "today", now)).toHaveLength(0);
  });
});

// ============================================================
// filterByStatus
// ============================================================
describe("filterByStatus", () => {
  const orders = [
    makeOrder({ id: "1", status: "nueva" }),
    makeOrder({ id: "2", status: "en_cocina" }),
    makeOrder({ id: "3", status: "servida" }),
    makeOrder({ id: "4", status: "finalizada" }),
    makeOrder({ id: "5", status: "nueva" }),
  ];

  it("returns all when status is null", () => {
    expect(filterByStatus(orders, null)).toHaveLength(5);
  });

  it("filters by nueva", () => {
    const result = filterByStatus(orders, "nueva");
    expect(result).toHaveLength(2);
    expect(result.every((o) => o.status === "nueva")).toBe(true);
  });

  it("filters by finalizada", () => {
    const result = filterByStatus(orders, "finalizada");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("4");
  });

  it("handles empty array", () => {
    expect(filterByStatus([], "nueva")).toHaveLength(0);
  });
});

// ============================================================
// filterByWaiter
// ============================================================
describe("filterByWaiter", () => {
  const orders = [
    makeOrder({ id: "1", waiter_name: "Juan" }),
    makeOrder({ id: "2", waiter_name: "Pedro" }),
    makeOrder({ id: "3", waiter_name: "Juan" }),
  ];

  it("returns all when waiterName is null", () => {
    expect(filterByWaiter(orders, null)).toHaveLength(3);
  });

  it("filters by waiter name", () => {
    const result = filterByWaiter(orders, "Juan");
    expect(result).toHaveLength(2);
    expect(result.every((o) => o.waiter_name === "Juan")).toBe(true);
  });

  it("returns empty when waiter has no orders", () => {
    expect(filterByWaiter(orders, "Maria")).toHaveLength(0);
  });

  it("handles empty array", () => {
    expect(filterByWaiter([], "Juan")).toHaveLength(0);
  });
});

// ============================================================
// getVisibleWaiters
// ============================================================
describe("getVisibleWaiters", () => {
  it("returns unique sorted waiter names", () => {
    const orders = [
      makeOrder({ waiter_name: "Carlos" }),
      makeOrder({ waiter_name: "Ana" }),
      makeOrder({ waiter_name: "Carlos" }),
      makeOrder({ waiter_name: "Beto" }),
    ];
    expect(getVisibleWaiters(orders)).toEqual(["Ana", "Beto", "Carlos"]);
  });

  it("returns empty for empty orders", () => {
    expect(getVisibleWaiters([])).toEqual([]);
  });

  it("handles single waiter", () => {
    const orders = [makeOrder({ waiter_name: "Juan" }), makeOrder({ waiter_name: "Juan" })];
    expect(getVisibleWaiters(orders)).toEqual(["Juan"]);
  });
});

// ============================================================
// filterByTable
// ============================================================
describe("filterByTable", () => {
  const orders = [
    makeOrder({ id: "1", table_number: 5 }),
    makeOrder({ id: "2", table_number: 18 }),
    makeOrder({ id: "3", table_number: 5 }),
  ];

  it("returns all when table is null", () => {
    expect(filterByTable(orders, null)).toHaveLength(3);
  });

  it("filters by table number", () => {
    const result = filterByTable(orders, 5);
    expect(result).toHaveLength(2);
    expect(result.every((o) => o.table_number === 5)).toBe(true);
  });

  it("filters delivery table (18)", () => {
    const result = filterByTable(orders, 18);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("returns empty when table has no orders", () => {
    expect(filterByTable(orders, 99)).toHaveLength(0);
  });
});

// ============================================================
// searchOrders
// ============================================================
describe("searchOrders", () => {
  const orders = [
    makeOrder({
      id: "1",
      table_number: 5,
      waiter_name: "Juan",
      items: [makeItem({ dish_name: "Hamburguesa" })],
    }),
    makeOrder({
      id: "2",
      table_number: 18,
      waiter_name: "Pedro",
      delivery_name: "Carlos",
      items: [makeItem({ dish_name: "Pizza" })],
    }),
  ];

  it("returns all when query is empty", () => {
    expect(searchOrders(orders, "")).toHaveLength(2);
  });

  it("returns all when query is whitespace", () => {
    expect(searchOrders(orders, "   ")).toHaveLength(2);
  });

  it("searches by dish name", () => {
    const result = searchOrders(orders, "hamburguesa");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("searches by table number", () => {
    const result = searchOrders(orders, "18");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("searches by waiter name", () => {
    const result = searchOrders(orders, "juan");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("searches by delivery name", () => {
    const result = searchOrders(orders, "carlos");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("search is case-insensitive", () => {
    expect(searchOrders(orders, "HAMBURGUESA")).toHaveLength(1);
    expect(searchOrders(orders, "PIZZA")).toHaveLength(1);
  });

  it("returns empty for no matches", () => {
    expect(searchOrders(orders, "sushi")).toHaveLength(0);
  });
});

// ============================================================
// getVisibleTables
// ============================================================
describe("getVisibleTables", () => {
  it("returns unique sorted table numbers", () => {
    const orders = [
      makeOrder({ table_number: 5 }),
      makeOrder({ table_number: 18 }),
      makeOrder({ table_number: 5 }),
      makeOrder({ table_number: 3 }),
    ];
    expect(getVisibleTables(orders)).toEqual([3, 5, 18]);
  });

  it("returns empty for empty orders", () => {
    expect(getVisibleTables([])).toEqual([]);
  });

  it("handles single table", () => {
    const orders = [makeOrder({ table_number: 5 }), makeOrder({ table_number: 5 })];
    expect(getVisibleTables(orders)).toEqual([5]);
  });
});

// ============================================================
// filterByDate — specific date
// ============================================================
describe("filterByDate — specific date", () => {
  const now = new Date("2024-06-15T19:30:00Z");

  it("filters to a specific date", () => {
    // 10:00 Colombia June 15 = 15:00 UTC June 15
    const june15 = makeOrder({ id: "j15", created_at: "2024-06-15T15:00:00Z" });
    // 10:00 Colombia June 14 = 15:00 UTC June 14
    const june14 = makeOrder({ id: "j14", created_at: "2024-06-14T15:00:00Z" });
    const result = filterByDate([june15, june14], { specific: "2024-06-15" }, now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("j15");
  });

  it("handles order at midnight Colombia on specific date", () => {
    const midnight = makeOrder({ id: "mid", created_at: "2024-06-15T05:00:00Z" });
    const result = filterByDate([midnight], { specific: "2024-06-15" }, now);
    expect(result).toHaveLength(1);
  });

  it("excludes order from different date", () => {
    const other = makeOrder({ id: "other", created_at: "2024-06-16T05:00:00Z" });
    const result = filterByDate([other], { specific: "2024-06-15" }, now);
    expect(result).toHaveLength(0);
  });
});

// ============================================================
// countByStatus
// ============================================================
describe("countByStatus", () => {
  it("counts orders by status correctly", () => {
    const orders = [
      makeOrder({ status: "nueva" }),
      makeOrder({ status: "nueva" }),
      makeOrder({ status: "en_cocina" }),
      makeOrder({ status: "servida" }),
      makeOrder({ status: "finalizada" }),
      makeOrder({ status: "finalizada" }),
      makeOrder({ status: "finalizada" }),
    ];
    const counts = countByStatus(orders);
    expect(counts.nueva).toBe(2);
    expect(counts.en_cocina).toBe(1);
    expect(counts.servida).toBe(1);
    expect(counts.finalizada).toBe(3);
  });

  it("returns all zeros for empty array", () => {
    const counts = countByStatus([]);
    expect(counts.nueva).toBe(0);
    expect(counts.en_cocina).toBe(0);
    expect(counts.servida).toBe(0);
    expect(counts.finalizada).toBe(0);
  });
});

// ============================================================
// calculateRevenue
// ============================================================
describe("calculateRevenue", () => {
  it("sums totals of finalized orders only", () => {
    const orders = [
      makeOrder({ status: "nueva", total: 10000 }),
      makeOrder({ status: "finalizada", total: 25000 }),
      makeOrder({ status: "finalizada", total: 15000 }),
      makeOrder({ status: "servida", total: 5000 }),
    ];
    expect(calculateRevenue(orders)).toBe(40000);
  });

  it("returns 0 when no finalized orders", () => {
    const orders = [
      makeOrder({ status: "nueva", total: 10000 }),
      makeOrder({ status: "servida", total: 5000 }),
    ];
    expect(calculateRevenue(orders)).toBe(0);
  });

  it("returns 0 for empty array", () => {
    expect(calculateRevenue([])).toBe(0);
  });
});

// ============================================================
// getTableStatuses
// ============================================================
describe("getTableStatuses", () => {
  it("maps table numbers to their latest status", () => {
    const orders = [
      makeOrder({ table_number: 1, status: "nueva" }),
      makeOrder({ table_number: 2, status: "en_cocina" }),
      makeOrder({ table_number: 3, status: "servida" }),
    ];
    const statuses = getTableStatuses(orders);
    expect(statuses.get(1)).toBe("nueva");
    expect(statuses.get(2)).toBe("en_cocina");
    expect(statuses.get(3)).toBe("servida");
  });

  it("excludes finalized orders", () => {
    const orders = [
      makeOrder({ table_number: 1, status: "finalizada" }),
      makeOrder({ table_number: 2, status: "nueva" }),
    ];
    const statuses = getTableStatuses(orders);
    expect(statuses.has(1)).toBe(false);
    expect(statuses.get(2)).toBe("nueva");
  });

  it("returns empty map for empty orders", () => {
    expect(getTableStatuses([]).size).toBe(0);
  });
});

// ============================================================
// sortOrders
// ============================================================
describe("sortOrders", () => {
  it("puts active orders before served", () => {
    const orders = [
      makeOrder({ id: "1", status: "finalizada", created_at: "2024-01-01T10:00:00Z" }),
      makeOrder({ id: "2", status: "nueva", created_at: "2024-01-01T12:00:00Z" }),
    ];
    const sorted = sortOrders(orders);
    expect(sorted[0].id).toBe("2"); // active first
    expect(sorted[1].id).toBe("1"); // served last
  });

  it("sorts active orders by created_at descending", () => {
    const orders = [
      makeOrder({ id: "old", status: "nueva", created_at: "2024-01-01T10:00:00Z" }),
      makeOrder({ id: "new", status: "nueva", created_at: "2024-01-01T14:00:00Z" }),
    ];
    const sorted = sortOrders(orders);
    expect(sorted[0].id).toBe("new");
    expect(sorted[1].id).toBe("old");
  });

  it("sorts served orders by created_at descending", () => {
    const orders = [
      makeOrder({ id: "old-served", status: "finalizada", created_at: "2024-01-01T10:00:00Z" }),
      makeOrder({ id: "new-served", status: "finalizada", created_at: "2024-01-01T14:00:00Z" }),
    ];
    const sorted = sortOrders(orders);
    expect(sorted[0].id).toBe("new-served");
    expect(sorted[1].id).toBe("old-served");
  });

  it("does not mutate original array", () => {
    const orders = [
      makeOrder({ id: "1", status: "finalizada", created_at: "2024-01-01T10:00:00Z" }),
      makeOrder({ id: "2", status: "nueva", created_at: "2024-01-01T12:00:00Z" }),
    ];
    const sorted = sortOrders(orders);
    expect(orders[0].id).toBe("1"); // Original unchanged
    expect(sorted).not.toBe(orders);
  });
});

// ============================================================
// countPrints
// ============================================================
describe("countPrints", () => {
  it("counts printed events", () => {
    const events = [
      makeEvent({ event_type: "printed" }),
      makeEvent({ event_type: "printed" }),
      makeEvent({ event_type: "status_changed" }),
      makeEvent({ event_type: "printed" }),
    ];
    expect(countPrints(events)).toBe(3);
  });

  it("returns 0 when no printed events", () => {
    const events = [
      makeEvent({ event_type: "created" }),
      makeEvent({ event_type: "status_changed" }),
    ];
    expect(countPrints(events)).toBe(0);
  });

  it("returns 0 for empty array", () => {
    expect(countPrints([])).toBe(0);
  });
});

// ============================================================
// parseEventMetadata
// ============================================================
describe("parseEventMetadata", () => {
  it("parses added items count", () => {
    const result = parseEventMetadata({ added: 2 });
    expect(result.changes).toContain("+2 agregados");
  });

  it("uses singular for 1 added item", () => {
    const result = parseEventMetadata({ added: 1 });
    expect(result.changes).toContain("+1 agregado");
    expect(result.changes).not.toContain("+1 agregados");
  });

  it("parses updated items count", () => {
    const result = parseEventMetadata({ updated: 3 });
    expect(result.changes).toContain("3 modificados");
  });

  it("uses singular for 1 updated item", () => {
    const result = parseEventMetadata({ updated: 1 });
    expect(result.changes).toContain("1 modificado");
  });

  it("parses removed items count", () => {
    const result = parseEventMetadata({ removed: 2 });
    expect(result.changes).toContain("-2 eliminados");
  });

  it("uses singular for 1 removed item", () => {
    const result = parseEventMetadata({ removed: 1 });
    expect(result.changes).toContain("-1 eliminado");
  });

  it("parses added_items detail lines", () => {
    const result = parseEventMetadata({
      added: 1,
      added_items: [{ name: "Hamburguesa", qty: 2 }],
    });
    expect(result.detailLines).toHaveLength(1);
    expect(result.detailLines[0]).toEqual({ text: "Hamburguesa (2x)", type: "add" });
  });

  it("parses updated_items with quantity change", () => {
    const result = parseEventMetadata({
      updated: 1,
      updated_items: [{ name: "Papas", qty: 3, old_qty: 1, notes: null, old_notes: null }],
    });
    expect(result.detailLines[0].type).toBe("mod");
    expect(result.detailLines[0].text).toContain("Papas");
    expect(result.detailLines[0].text).toContain("1x → 3x");
  });

  it("parses updated_items with notes change", () => {
    const result = parseEventMetadata({
      updated: 1,
      updated_items: [{ name: "Burger", qty: 2, old_qty: 2, notes: "Sin cebolla", old_notes: null }],
    });
    expect(result.detailLines[0].text).toContain('nota: "Sin cebolla"');
    expect(result.detailLines[0].text).not.toContain("x →");
  });

  it("parses updated_items with notes removed", () => {
    const result = parseEventMetadata({
      updated: 1,
      updated_items: [{ name: "Burger", qty: 2, old_qty: 2, notes: null, old_notes: "Sin cebolla" }],
    });
    expect(result.detailLines[0].text).toContain("sin nota");
  });

  it("parses removed_items detail lines", () => {
    const result = parseEventMetadata({
      removed: 1,
      removed_items: [{ name: "Refresco", qty: 1 }],
    });
    expect(result.detailLines[0]).toEqual({ text: "Refresco (1x)", type: "del" });
  });

  it("handles empty metadata", () => {
    const result = parseEventMetadata({});
    expect(result.changes).toHaveLength(0);
    expect(result.detailLines).toHaveLength(0);
  });

  it("handles combination of all changes", () => {
    const result = parseEventMetadata({
      added: 1,
      updated: 1,
      removed: 1,
      added_items: [{ name: "Ensalada", qty: 1 }],
      updated_items: [{ name: "Burger", qty: 3, old_qty: 2, notes: null, old_notes: null }],
      removed_items: [{ name: "Soda", qty: 1 }],
    });
    expect(result.changes).toHaveLength(3);
    expect(result.detailLines).toHaveLength(3);
    expect(result.detailLines[0].type).toBe("add");
    expect(result.detailLines[1].type).toBe("mod");
    expect(result.detailLines[2].type).toBe("del");
  });
});

// ============================================================
// Additional helpers
// ============================================================
describe("hasAdditionals", () => {
  it("returns false when no items are additional", () => {
    const order = makeOrder({
      items: [makeItem(), makeItem({ id: "item-2", is_additional: false })],
    });
    expect(hasAdditionals(order)).toBe(false);
  });

  it("returns true when at least one item is additional", () => {
    const order = makeOrder({
      items: [makeItem(), makeItem({ id: "item-2", is_additional: true, additional_number: 1 })],
    });
    expect(hasAdditionals(order)).toBe(true);
  });

  it("returns false for empty items", () => {
    expect(hasAdditionals(makeOrder())).toBe(false);
  });
});

describe("maxAdditionalNumber", () => {
  it("returns 0 when no adicionals", () => {
    const order = makeOrder({
      items: [makeItem(), makeItem({ id: "item-2" })],
    });
    expect(maxAdditionalNumber(order)).toBe(0);
  });

  it("returns the highest additional_number", () => {
    const order = makeOrder({
      items: [
        makeItem(),
        makeItem({ id: "item-2", is_additional: true, additional_number: 1 }),
        makeItem({ id: "item-3", is_additional: true, additional_number: 3 }),
        makeItem({ id: "item-4", is_additional: true, additional_number: 2 }),
      ],
    });
    expect(maxAdditionalNumber(order)).toBe(3);
  });
});

describe("getAdditionalItems", () => {
  it("returns only additional items when no round specified", () => {
    const order = makeOrder({
      items: [
        makeItem(),
        makeItem({ id: "item-2", is_additional: true, additional_number: 1 }),
        makeItem({ id: "item-3", is_additional: true, additional_number: 2 }),
      ],
    });
    const result = getAdditionalItems(order);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("item-2");
    expect(result[1].id).toBe("item-3");
  });

  it("returns only items for the specified round", () => {
    const order = makeOrder({
      items: [
        makeItem(),
        makeItem({ id: "item-2", is_additional: true, additional_number: 1 }),
        makeItem({ id: "item-3", is_additional: true, additional_number: 2 }),
        makeItem({ id: "item-4", is_additional: true, additional_number: 1 }),
      ],
    });
    const result = getAdditionalItems(order, 1);
    expect(result).toHaveLength(2);
    expect(result.every((i) => i.additional_number === 1)).toBe(true);
  });
});

describe("getOriginalItems", () => {
  it("returns only non-additional items", () => {
    const order = makeOrder({
      items: [
        makeItem(),
        makeItem({ id: "item-2", is_additional: true, additional_number: 1 }),
        makeItem({ id: "item-3" }),
      ],
    });
    const result = getOriginalItems(order);
    expect(result).toHaveLength(2);
    expect(result.every((i) => !i.is_additional)).toBe(true);
  });
});

describe("additionalSubtotal", () => {
  it("calculates subtotal of all additional items", () => {
    const order = makeOrder({
      items: [
        makeItem({ price: 15000, quantity: 2 }),
        makeItem({ id: "item-2", price: 8000, quantity: 1, is_additional: true, additional_number: 1 }),
        makeItem({ id: "item-3", price: 5000, quantity: 2, is_additional: true, additional_number: 2 }),
      ],
    });
    // 8000*1 + 5000*2 = 18000
    expect(additionalSubtotal(order)).toBe(18000);
  });

  it("calculates subtotal for a specific round", () => {
    const order = makeOrder({
      items: [
        makeItem({ id: "item-2", price: 8000, quantity: 1, is_additional: true, additional_number: 1 }),
        makeItem({ id: "item-3", price: 5000, quantity: 2, is_additional: true, additional_number: 2 }),
      ],
    });
    expect(additionalSubtotal(order, 2)).toBe(10000);
  });

  it("returns 0 when no adicionals", () => {
    const order = makeOrder({
      items: [makeItem({ price: 15000, quantity: 2 })],
    });
    expect(additionalSubtotal(order)).toBe(0);
  });
});

describe("sortOrders with adicionals", () => {
  it("prioritizes active orders with adicionals over active orders without", () => {
    const normal = makeOrder({ id: "normal", status: "servida", created_at: "2026-01-01T10:00:00Z" });
    const withAdd = makeOrder({
      id: "with-add",
      status: "servida",
      created_at: "2026-01-01T09:00:00Z", // earlier than normal
      items: [makeItem({ is_additional: true, additional_number: 1 })],
    });
    const sorted = sortOrders([normal, withAdd]);
    expect(sorted[0].id).toBe("with-add");
  });

  it("does not prioritize finalized orders with adicionals", () => {
    const served = makeOrder({
      id: "served",
      status: "finalizada",
      created_at: "2026-01-01T10:00:00Z",
      items: [makeItem({ is_additional: true, additional_number: 1 })],
    });
    const active = makeOrder({ id: "active", status: "servida", created_at: "2026-01-01T09:00:00Z" });
    const sorted = sortOrders([served, active]);
    expect(sorted[0].id).toBe("active");
  });
});
