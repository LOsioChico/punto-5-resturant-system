import { describe, it, expect } from "vitest";
import {
  STATUS_FLOW,
  nextStatus,
  advanceActionLabel,
  wasModified,
  canEditOrder,
  isOrderActive,
  filterByDate,
  filterByStatus,
  filterByWaiter,
  getVisibleWaiters,
  countByStatus,
  calculateRevenue,
  getTableStatuses,
  sortOrders,
  countPrints,
  parseEventMetadata,
} from "./logic";
import type { Order, OrderEvent } from "@/lib/types";

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
    expect(STATUS_FLOW).toEqual(["nueva", "en_cocina", "lista", "servida"]);
  });
});

// ============================================================
// nextStatus
// ============================================================
describe("nextStatus", () => {
  it("returns en_cocina for nueva", () => {
    expect(nextStatus("nueva")).toBe("en_cocina");
  });

  it("returns lista for en_cocina", () => {
    expect(nextStatus("en_cocina")).toBe("lista");
  });

  it("returns servida for lista", () => {
    expect(nextStatus("lista")).toBe("servida");
  });

  it("returns null for servida (terminal status)", () => {
    expect(nextStatus("servida")).toBeNull();
  });
});

// ============================================================
// advanceActionLabel
// ============================================================
describe("advanceActionLabel", () => {
  it("returns 'Enviar a cocina' for nueva", () => {
    expect(advanceActionLabel("nueva")).toBe("Enviar a cocina");
  });

  it("returns 'Marcar como lista' for en_cocina", () => {
    expect(advanceActionLabel("en_cocina")).toBe("Marcar como lista");
  });

  it("returns 'Marcar como servida' for lista", () => {
    expect(advanceActionLabel("lista")).toBe("Marcar como servida");
  });

  it("returns empty string for servida", () => {
    expect(advanceActionLabel("servida")).toBe("");
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

  it("does not allow editing lista orders", () => {
    expect(canEditOrder("lista")).toBe(false);
  });

  it("does not allow editing servida orders", () => {
    expect(canEditOrder("servida")).toBe(false);
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

  it("returns true for lista", () => {
    expect(isOrderActive("lista")).toBe(true);
  });

  it("returns false for servida", () => {
    expect(isOrderActive("servida")).toBe(false);
  });
});

// ============================================================
// filterByDate
// ============================================================
describe("filterByDate", () => {
  const now = new Date(2024, 5, 15, 14, 30); // June 15, 2024, 2:30 PM

  const todayOrder = makeOrder({
    id: "today",
    created_at: new Date(2024, 5, 15, 10, 0).toISOString(),
  });
  const yesterdayOrder = makeOrder({
    id: "yesterday",
    created_at: new Date(2024, 5, 14, 18, 0).toISOString(),
  });
  const twoDaysAgoOrder = makeOrder({
    id: "two-days-ago",
    created_at: new Date(2024, 5, 13, 12, 0).toISOString(),
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

  it("handles order at exactly midnight today", () => {
    const midnightOrder = makeOrder({
      id: "midnight",
      created_at: new Date(2024, 5, 15, 0, 0).toISOString(),
    });
    const result = filterByDate([midnightOrder], "today", now);
    expect(result).toHaveLength(1);
  });

  it("handles order at 23:59 today", () => {
    const lateOrder = makeOrder({
      id: "late",
      created_at: new Date(2024, 5, 15, 23, 59).toISOString(),
    });
    const result = filterByDate([lateOrder], "today", now);
    expect(result).toHaveLength(1);
  });

  it("excludes order at exactly midnight of next day", () => {
    const nextDayMidnight = makeOrder({
      id: "next-midnight",
      created_at: new Date(2024, 5, 16, 0, 0).toISOString(),
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
    makeOrder({ id: "3", status: "lista" }),
    makeOrder({ id: "4", status: "servida" }),
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

  it("filters by servida", () => {
    const result = filterByStatus(orders, "servida");
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
// countByStatus
// ============================================================
describe("countByStatus", () => {
  it("counts orders by status correctly", () => {
    const orders = [
      makeOrder({ status: "nueva" }),
      makeOrder({ status: "nueva" }),
      makeOrder({ status: "en_cocina" }),
      makeOrder({ status: "lista" }),
      makeOrder({ status: "servida" }),
      makeOrder({ status: "servida" }),
      makeOrder({ status: "servida" }),
    ];
    const counts = countByStatus(orders);
    expect(counts.nueva).toBe(2);
    expect(counts.en_cocina).toBe(1);
    expect(counts.lista).toBe(1);
    expect(counts.servida).toBe(3);
  });

  it("returns all zeros for empty array", () => {
    const counts = countByStatus([]);
    expect(counts.nueva).toBe(0);
    expect(counts.en_cocina).toBe(0);
    expect(counts.lista).toBe(0);
    expect(counts.servida).toBe(0);
  });
});

// ============================================================
// calculateRevenue
// ============================================================
describe("calculateRevenue", () => {
  it("sums totals of served orders only", () => {
    const orders = [
      makeOrder({ status: "nueva", total: 10000 }),
      makeOrder({ status: "servida", total: 25000 }),
      makeOrder({ status: "servida", total: 15000 }),
      makeOrder({ status: "lista", total: 5000 }),
    ];
    expect(calculateRevenue(orders)).toBe(40000);
  });

  it("returns 0 when no served orders", () => {
    const orders = [
      makeOrder({ status: "nueva", total: 10000 }),
      makeOrder({ status: "lista", total: 5000 }),
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
      makeOrder({ table_number: 3, status: "lista" }),
    ];
    const statuses = getTableStatuses(orders);
    expect(statuses.get(1)).toBe("nueva");
    expect(statuses.get(2)).toBe("en_cocina");
    expect(statuses.get(3)).toBe("lista");
  });

  it("excludes served orders", () => {
    const orders = [
      makeOrder({ table_number: 1, status: "servida" }),
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
      makeOrder({ id: "1", status: "servida", created_at: "2024-01-01T10:00:00Z" }),
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
      makeOrder({ id: "old-served", status: "servida", created_at: "2024-01-01T10:00:00Z" }),
      makeOrder({ id: "new-served", status: "servida", created_at: "2024-01-01T14:00:00Z" }),
    ];
    const sorted = sortOrders(orders);
    expect(sorted[0].id).toBe("new-served");
    expect(sorted[1].id).toBe("old-served");
  });

  it("does not mutate original array", () => {
    const orders = [
      makeOrder({ id: "1", status: "servida", created_at: "2024-01-01T10:00:00Z" }),
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
