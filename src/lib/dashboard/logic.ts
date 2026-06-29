/**
 * Pure functions extracted from dashboard components for testability.
 */

import type { Order, OrderItem, OrderStatus } from "@/lib/types";
import { compareDesc } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { startOfTodayColombia, startOfYesterdayColombia, isOnColombiaDate, COLOMBIA_TZ } from "@/lib/timezone";

export const STATUS_FLOW: OrderStatus[] = ["nueva", "en_cocina", "servida", "finalizada"];

// Statuses shown in KPI cards and filters (excludes 'adicional')
export const FILTERABLE_STATUSES: OrderStatus[] = ["nueva", "en_cocina", "servida", "finalizada"];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  nueva: "Nueva",
  en_cocina: "En cocina",
  servida: "Servida",
  finalizada: "Finalizada",
  adicional: "Adicional",
};

export const STATUS_LABELS_PLURAL: Record<OrderStatus, string> = {
  nueva: "Nuevas",
  en_cocina: "En cocina",
  servida: "Servidas",
  finalizada: "Finalizadas",
  adicional: "Adicionales",
};

/**
 * Get the display label for a status. For delivery orders, "servida"
 * is shown as "En camino" (the food is on its way to the customer).
 */
export function statusLabel(status: OrderStatus, isDelivery = false): string {
  if (status === "servida" && isDelivery) return "En camino";
  return STATUS_LABELS[status];
}

/**
 * Get the plural display label for a status (for filters/KPIs).
 * For delivery orders, "servida" is shown as "En camino".
 */
export function statusLabelPlural(status: OrderStatus, isDelivery = false): string {
  if (status === "servida" && isDelivery) return "En camino";
  return STATUS_LABELS_PLURAL[status];
}

/** Get the next status in the flow, or null if at the end. */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  // 'adicional' is not in STATUS_FLOW — it advances directly to 'finalizada'
  // (the order was already served, additional items are now served too)
  if (status === "adicional") return "finalizada";
  const idx = STATUS_FLOW.indexOf(status);
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

/**
 * Get the action label for advancing an order, or empty string if none.
 * For delivery orders, "Marcar como servida" becomes "Marcar en camino".
 */
export function advanceActionLabel(status: OrderStatus, isDelivery = false): string {
  if (status === "en_cocina" && isDelivery) return "Marcar en camino";
  const labels: Record<OrderStatus, string> = {
    nueva: "Enviar a cocina",
    en_cocina: "Marcar como servida",
    servida: "Finalizar pedido",
    finalizada: "",
    adicional: "Finalizar pedido",
  };
  return labels[status];
}

/** Check if an order was modified by a waiter. */
export function wasModified(order: Order): boolean {
  return order.updated_by_type === "waiter" && order.updated_at !== null;
}

/** Check if a waiter can edit an order (only nueva or en_cocina). */
export function canEditOrder(status: OrderStatus): boolean {
  return status === "nueva" || status === "en_cocina";
}

/** Check if an order is active (not finalized). */
export function isOrderActive(status: OrderStatus): boolean {
  return status !== "finalizada";
}

/** Check if an order is in the 'adicional' status. */
export function isAdicional(status: OrderStatus): boolean {
  return status === "adicional";
}

/** Filter orders by date (today, yesterday, specific date, or all) in Colombia timezone. */
export function filterByDate(
  orders: Order[],
  filter: "today" | "yesterday" | "all" | { specific: string },
  now: Date = new Date(),
): Order[] {
  if (filter === "all") return orders;
  if (typeof filter === "object") {
    // Specific date — parse as Colombia midnight
    const [y, m, d] = filter.specific.split("-").map(Number);
    const target = fromZonedTime(new Date(y, m - 1, d), COLOMBIA_TZ);
    return orders.filter((o) => isOnColombiaDate(o.created_at, target));
  }
  const target = filter === "today"
    ? startOfTodayColombia(now)
    : startOfYesterdayColombia(now);
  return orders.filter((o) => isOnColombiaDate(o.created_at, target));
}

/** Filter orders by status. */
export function filterByStatus(orders: Order[], status: OrderStatus | null): Order[] {
  if (!status) return orders;
  return orders.filter((o) => o.status === status);
}

/** Filter orders by waiter name. */
export function filterByWaiter(orders: Order[], waiterName: string | null): Order[] {
  if (!waiterName) return orders;
  return orders.filter((o) => o.waiter_name === waiterName);
}

/** Filter orders by table number. */
export function filterByTable(orders: Order[], table: number | null): Order[] {
  if (table === null) return orders;
  return orders.filter((o) => o.table_number === table);
}

/** Search orders by dish name, table number, or waiter name. */
export function searchOrders(orders: Order[], query: string): Order[] {
  const q = query.trim().toLowerCase();
  if (!q) return orders;
  return orders.filter((o) => {
    if (o.waiter_name.toLowerCase().includes(q)) return true;
    if (String(o.table_number).includes(q)) return true;
    if (o.delivery_name?.toLowerCase().includes(q)) return true;
    return o.items.some((i) => i.dish_name.toLowerCase().includes(q));
  });
}

/** Get unique waiter names from orders, sorted alphabetically. */
export function getVisibleWaiters(orders: Order[]): string[] {
  const names = new Set(orders.map((o) => o.waiter_name));
  return Array.from(names).sort();
}

/** Get unique table numbers from orders, sorted ascending. */
export function getVisibleTables(orders: Order[]): number[] {
  const tables = new Set(orders.map((o) => o.table_number));
  return Array.from(tables).sort((a, b) => a - b);
}

/** Count orders by status. */
export function countByStatus(orders: Order[]): Record<OrderStatus, number> {
  return {
    nueva: orders.filter((o) => o.status === "nueva").length,
    en_cocina: orders.filter((o) => o.status === "en_cocina").length,
    servida: orders.filter((o) => o.status === "servida").length,
    finalizada: orders.filter((o) => o.status === "finalizada").length,
    adicional: orders.filter((o) => o.status === "adicional").length,
  };
}

/** Calculate total revenue from finalized orders. */
export function calculateRevenue(orders: Order[]): number {
  return orders
    .filter((o) => o.status === "finalizada")
    .reduce((sum, o) => sum + o.total, 0);
}

/** Build a map of table_number → latest order status (excluding finalized). */
export function getTableStatuses(orders: Order[]): Map<number, OrderStatus> {
  const map = new Map<number, OrderStatus>();
  for (const order of orders) {
    if (order.status === "finalizada") continue;
    // Only set if this order is newer than what's already there
    const existing = map.get(order.table_number);
    if (!existing) {
      map.set(order.table_number, order.status);
    }
    // In a real app we'd compare created_at, but for the POC the first match is fine
    // since orders are loaded sorted by created_at desc
  }
  return map;
}

/** Check if an order has additional items. */
export function hasAdditionals(order: Order): boolean {
  return order.items.some((i) => i.is_additional);
}

/** Get the highest additional_number on an order (0 if none). */
export function maxAdditionalNumber(order: Order): number {
  return order.items.reduce((max, i) => {
    if (i.additional_number && i.additional_number > max) return i.additional_number;
    return max;
  }, 0);
}

/** Get only the additional items for a specific round number. */
export function getAdditionalItems(order: Order, round?: number): OrderItem[] {
  return order.items.filter((i) => {
    if (!i.is_additional) return false;
    if (round !== undefined && i.additional_number !== round) return false;
    return true;
  });
}

/** Get the original (non-additional) items. */
export function getOriginalItems(order: Order): OrderItem[] {
  return order.items.filter((i) => !i.is_additional);
}

/** Calculate the subtotal for additional items only. */
export function additionalSubtotal(order: Order, round?: number): number {
  return getAdditionalItems(order, round).reduce((sum, i) => sum + i.price * i.quantity, 0);
}

/** Sort orders: 'adicional' status first, then active with adicionals, then active, then finalized. */
export function sortOrders(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    // 'adicional' status always on top
    const aAdicional = a.status === "adicional" ? 0 : 1;
    const bAdicional = b.status === "adicional" ? 0 : 1;
    if (aAdicional !== bAdicional) return aAdicional - bAdicional;

    const aActive = a.status !== "finalizada" ? 0 : 1;
    const bActive = b.status !== "finalizada" ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    // Among active orders, prioritize those with adicionals
    if (aActive === 0) {
      const aAdd = hasAdditionals(a) ? 0 : 1;
      const bAdd = hasAdditionals(b) ? 0 : 1;
      if (aAdd !== bAdd) return aAdd - bAdd;
    }
    return compareDesc(new Date(a.created_at), new Date(b.created_at));
  });
}

/** Count print events. */
export function countPrints(events: { event_type: string }[]): number {
  return events.filter((e) => e.event_type === "printed").length;
}

/** Parse event metadata for change details. */
export function parseEventMetadata(metadata: Record<string, unknown>): {
  changes: string[];
  detailLines: { text: string; type: "add" | "mod" | "del" }[];
} {
  const meta = metadata as {
    added?: number;
    updated?: number;
    removed?: number;
    added_items?: { name: string; qty: number }[];
    updated_items?: { name: string; qty: number; old_qty: number; notes: string | null; old_notes: string | null }[];
    removed_items?: { name: string; qty: number }[];
  };

  const changes: string[] = [];
  if (meta.added) changes.push(`+${meta.added} agregado${meta.added > 1 ? "s" : ""}`);
  if (meta.updated) changes.push(`${meta.updated} modificado${meta.updated > 1 ? "s" : ""}`);
  if (meta.removed) changes.push(`-${meta.removed} eliminado${meta.removed > 1 ? "s" : ""}`);

  const detailLines: { text: string; type: "add" | "mod" | "del" }[] = [];
  for (const item of meta.added_items ?? []) {
    detailLines.push({ text: `${item.name} (${item.qty}x)`, type: "add" });
  }
  for (const item of meta.updated_items ?? []) {
    const parts: string[] = [];
    if (item.qty !== item.old_qty) parts.push(`${item.old_qty}x → ${item.qty}x`);
    // Compare notes arrays — normalize to strings for comparison
    const newNotesStr = Array.isArray(item.notes) ? item.notes.join("; ") : (item.notes ?? "");
    const oldNotesStr = Array.isArray(item.old_notes) ? item.old_notes.join("; ") : (item.old_notes ?? "");
    if (newNotesStr !== oldNotesStr) {
      parts.push(newNotesStr ? `nota: "${newNotesStr}"` : "sin nota");
    }
    detailLines.push({
      text: `${item.name}${parts.length > 0 ? ` — ${parts.join(", ")}` : ""}`,
      type: "mod",
    });
  }
  for (const item of meta.removed_items ?? []) {
    detailLines.push({ text: `${item.name} (${item.qty}x)`, type: "del" });
  }

  return { changes, detailLines };
}
