/**
 * Centralized database mutations for orders.
 *
 * All order-related DB writes go through this module. This enforces a
 * consistent order of operations so Supabase realtime works reliably:
 *
 *   1. Write order_items (insert/update/delete)
 *   2. Write order_events (audit trail)
 *   3. Update orders LAST — this fires the realtime UPDATE event,
 *      and by this point all items and events are already committed
 *      so the realtime handler can reload everything.
 *
 * Components call these functions and handle UI state (optimistic
 * updates, toasts, cart clearing) — the mutation layer only does
 * DB writes and returns the result.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isDeliveryTable, DESECHABLES_PER_DISH } from "./utils";
import { countParaLlevar, type CartItem } from "./pos/logic";
import { nextStatus } from "./dashboard/logic";
import type { Order, OrderStatus, ActorType, EventType } from "./types";

// ─── Types ───────────────────────────────────────────────────

type Result<T> = { data: T } | { error: string };

interface Actor {
  type: ActorType;
  name: string;
  id: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────

/** Calculate desechables for a set of cart items on a given table. */
function calcDesechables(tableNumber: number, items: CartItem[]): number {
  const isDelivery = isDeliveryTable(tableNumber);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const paraLlevarCount = isDelivery ? 0 : items.reduce((s, i) => s + countParaLlevar(i.notes), 0);
  return (isDelivery ? itemCount : paraLlevarCount) * DESECHABLES_PER_DISH;
}

/** Insert an audit event. Logs to console on failure but does not throw. */
async function logEvent(
  supabase: SupabaseClient,
  orderId: string,
  eventType: EventType,
  actor: Actor,
  fields: { from_status?: OrderStatus | null; to_status?: OrderStatus | null; metadata?: Record<string, unknown> },
): Promise<void> {
  const { error } = await supabase.from("order_events").insert({
    order_id: orderId,
    event_type: eventType,
    actor_type: actor.type,
    actor_name: actor.name,
    actor_id: actor.id,
    from_status: fields.from_status ?? null,
    to_status: fields.to_status ?? null,
    metadata: fields.metadata ?? {},
  });
  if (error) {
    console.error(`Failed to log ${eventType} event:`, error);
  }
}

/** Fetch order_items with category names for a single order. */
export async function fetchOrderItems(supabase: SupabaseClient, orderId: string) {
  const { data, error } = await supabase
    .from("order_items")
    .select("*, dishes(categories(name))")
    .eq("order_id", orderId);
  if (error) return [];
  return data.map((i) => ({
    ...i,
    category_name: i.dishes?.categories?.name ?? null,
  }));
}

// ─── 1. Create Order ─────────────────────────────────────────

export async function createOrder(
  supabase: SupabaseClient,
  params: {
    tableNumber: number;
    waiterName: string;
    waiterId: string;
    deliveryName: string;
    cart: CartItem[];
    actor: Actor;
  },
): Promise<Result<{ orderId: string; total: number }>> {
  const { tableNumber, waiterName, waiterId, deliveryName, cart, actor } = params;

  const desechables = calcDesechables(tableNumber, cart);
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0) + desechables;
  const isDelivery = isDeliveryTable(tableNumber);

  // 1. Insert order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      table_number: tableNumber,
      waiter_name: waiterName,
      waiter_id: waiterId,
      status: "nueva",
      total,
      delivery_name: isDelivery ? deliveryName.trim() : null,
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    return { error: "Error al crear el pedido" };
  }

  // 2. Insert order_items
  const { error: itemsErr } = await supabase.from("order_items").insert(
    cart.map((item) => ({
      order_id: order.id,
      dish_id: item.dish_id,
      dish_name: item.dish_name,
      price: item.price,
      quantity: item.quantity,
      notes: item.notes.some((n) => n.trim()) ? item.notes : null,
    })),
  );

  if (itemsErr) {
    return { error: "Error al guardar los items del pedido" };
  }

  // 3. Log audit event
  await logEvent(supabase, order.id, "created", actor, {
    to_status: "nueva",
    metadata: {
      table_number: tableNumber,
      item_count: cart.reduce((s, i) => s + i.quantity, 0),
      total,
    },
  });

  return { data: { orderId: order.id, total } };
}

// ─── 2. Add Additional Items ─────────────────────────────────

export async function addAdditional(
  supabase: SupabaseClient,
  params: {
    order: Order;
    cart: CartItem[];
    actor: Actor;
  },
): Promise<Result<{ round: number; newTotal: number; additionalTotal: number }>> {
  const { order, cart, actor } = params;

  // Next additional round number
  const nextRound =
    order.items.reduce((max, i) => {
      return i.additional_number && i.additional_number > max ? i.additional_number : max;
    }, 0) + 1;

  // 1. Insert additional items
  const { error: itemsErr } = await supabase.from("order_items").insert(
    cart.map((item) => ({
      order_id: order.id,
      dish_id: item.dish_id,
      dish_name: item.dish_name,
      price: item.price,
      quantity: item.quantity,
      notes: item.notes.some((n) => n.trim()) ? item.notes : null,
      is_additional: true,
      additional_number: nextRound,
    })),
  );

  if (itemsErr) {
    return { error: "Error al guardar el adicional" };
  }

  // Calculate totals
  const isDelivery = isDeliveryTable(order.table_number);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);
  const paraLlevarCount = isDelivery ? 0 : cart.reduce((s, i) => s + countParaLlevar(i.notes), 0);
  const additionalDesechables = (isDelivery ? itemCount : paraLlevarCount) * DESECHABLES_PER_DISH;
  const additionalTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0) + additionalDesechables;
  const newTotal = order.total + additionalTotal;

  // 2. Log audit event BEFORE updating the order
  await logEvent(supabase, order.id, "additional_added", actor, {
    from_status: order.status,
    to_status: "adicional",
    metadata: {
      additional_number: nextRound,
      item_count: itemCount,
      additional_total: additionalTotal,
      additional_desechables: additionalDesechables,
      new_total: newTotal,
      added_items: cart.map((i) => ({ name: i.dish_name, qty: i.quantity, notes: i.notes })),
    },
  });

  // 3. Update order LAST — fires realtime UPDATE
  const now = new Date().toISOString();
  const { error: orderErr } = await supabase
    .from("orders")
    .update({
      status: "adicional",
      total: newTotal,
      updated_by: actor.name,
      updated_at: now,
      updated_by_type: actor.type,
    })
    .eq("id", order.id);

  if (orderErr) {
    return { error: "Error al actualizar el pedido" };
  }

  return { data: { round: nextRound, newTotal, additionalTotal } };
}

// ─── 3. Edit Order (saveEditedOrder) ─────────────────────────

export async function editOrder(
  supabase: SupabaseClient,
  params: {
    orderId: string;
    cart: CartItem[];
    originalOrder: Order;
    tableNumber: number;
    deliveryName: string;
    actor: Actor;
  },
): Promise<Result<{ total: number }>> {
  const { orderId, cart, originalOrder, tableNumber, deliveryName, actor } = params;

  const desechables = calcDesechables(tableNumber, cart);
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0) + desechables;
  const oldItems = originalOrder.items ?? [];

  // Build maps by dish_id for diffing
  const oldByDish = new Map(oldItems.map((i) => [i.dish_id, i]));
  const newByDish = new Map(cart.map((i) => [i.dish_id, i]));

  const toInsert: CartItem[] = [];
  const toUpdate: { id: string; quantity: number; notes: string[] | null }[] = [];
  const toDelete: string[] = [];

  for (const newItem of cart) {
    const old = oldByDish.get(newItem.dish_id);
    if (!old) {
      toInsert.push(newItem);
    } else {
      const oldNotes = (old.notes ?? []).map((n: string) => n.trim());
      const newNotes = newItem.notes.map((n) => n.trim());
      while (oldNotes.length > 0 && oldNotes[oldNotes.length - 1] === "") oldNotes.pop();
      while (newNotes.length > 0 && newNotes[newNotes.length - 1] === "") newNotes.pop();
      const notesChanged = oldNotes.length !== newNotes.length || oldNotes.some((v, i) => v !== newNotes[i]);

      if (old.quantity !== newItem.quantity || notesChanged) {
        toUpdate.push({
          id: old.id,
          quantity: newItem.quantity,
          notes: newItem.notes.some((n) => n.trim()) ? newItem.notes : null,
        });
      }
    }
  }

  for (const oldItem of oldItems) {
    if (!newByDish.has(oldItem.dish_id)) {
      toDelete.push(oldItem.id);
    }
  }

  // 1. Apply item changes (delete / update / insert)
  if (toDelete.length > 0) {
    const { error } = await supabase.from("order_items").delete().in("id", toDelete);
    if (error) return { error: "Error al eliminar items" };
  }

  if (toUpdate.length > 0) {
    for (const item of toUpdate) {
      const { error } = await supabase
        .from("order_items")
        .update({ quantity: item.quantity, notes: item.notes })
        .eq("id", item.id);
      if (error) return { error: "Error al actualizar items" };
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("order_items").insert(
      toInsert.map((item) => ({
        order_id: orderId,
        dish_id: item.dish_id,
        dish_name: item.dish_name,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes.some((n) => n.trim()) ? item.notes : null,
      })),
    );
    if (error) return { error: "Error al agregar items" };
  }

  // 2. Log audit event
  await logEvent(supabase, orderId, "updated", actor, {
    to_status: originalOrder.status,
    metadata: {
      table_number: tableNumber,
      item_count: cart.reduce((s, i) => s + i.quantity, 0),
      total,
      added: toInsert.length,
      updated: toUpdate.length,
      removed: toDelete.length,
      added_items: toInsert.map((i) => ({ name: i.dish_name, qty: i.quantity })),
      updated_items: toUpdate.map((u) => {
        const old = oldItems.find((o) => o.id === u.id);
        const newItem = cart.find((c) => c.dish_id === old?.dish_id);
        return {
          name: newItem?.dish_name ?? old?.dish_name ?? "",
          qty: u.quantity,
          old_qty: old?.quantity ?? 0,
          notes: u.notes,
          old_notes: old?.notes ?? null,
        };
      }),
      removed_items: toDelete.map((id) => {
        const old = oldItems.find((o) => o.id === id);
        return { name: old?.dish_name ?? "", qty: old?.quantity ?? 0 };
      }),
    },
  });

  // 3. Update order LAST — fires realtime UPDATE
  const now = new Date().toISOString();
  const { error: orderErr } = await supabase
    .from("orders")
    .update({
      total,
      delivery_name: isDeliveryTable(tableNumber) ? deliveryName.trim() : null,
      updated_by: actor.name,
      updated_at: now,
      updated_by_type: actor.type,
    })
    .eq("id", orderId);

  if (orderErr) return { error: "Error al actualizar el pedido" };

  return { data: { total } };
}

// ─── 4. Advance Status ───────────────────────────────────────

export async function advanceOrderStatus(
  supabase: SupabaseClient,
  params: {
    orderId: string;
    currentStatus: OrderStatus;
    actor: Actor;
  },
): Promise<Result<{ fromStatus: OrderStatus; toStatus: OrderStatus; now: string }>> {
  const { orderId, currentStatus, actor } = params;
  const toStatus = nextStatus(currentStatus);
  if (!toStatus) return { error: "No hay siguiente estado" };

  const now = new Date().toISOString();

  // 1. Log event BEFORE updating the order
  await logEvent(supabase, orderId, "status_changed", actor, {
    from_status: currentStatus,
    to_status: toStatus,
  });

  // 2. Update order LAST — fires realtime UPDATE
  const { error } = await supabase
    .from("orders")
    .update({
      status: toStatus,
      updated_by: actor.name,
      updated_at: now,
      updated_by_type: actor.type,
    })
    .eq("id", orderId);

  if (error) return { error: "Error al cambiar el estado" };

  return { data: { fromStatus: currentStatus, toStatus, now } };
}

// ─── 5. Undo Status ──────────────────────────────────────────

export async function undoOrderStatus(
  supabase: SupabaseClient,
  params: {
    orderId: string;
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
    actor: Actor;
  },
): Promise<Result<{ now: string }>> {
  const { orderId, fromStatus, toStatus, actor } = params;
  const now = new Date().toISOString();

  // 1. Log event BEFORE updating the order
  await logEvent(supabase, orderId, "status_changed", actor, {
    from_status: toStatus,
    to_status: fromStatus,
  });

  // 2. Update order LAST — fires realtime UPDATE
  const { error } = await supabase
    .from("orders")
    .update({
      status: fromStatus,
      updated_by: actor.name,
      updated_at: now,
      updated_by_type: actor.type,
    })
    .eq("id", orderId);

  if (error) return { error: "Error al deshacer el cambio" };

  return { data: { now } };
}

// ─── 6. Set Delivery Fee ─────────────────────────────────────

export async function setOrderDeliveryFee(
  supabase: SupabaseClient,
  params: {
    orderId: string;
    fee: number;
    order: Order;
  },
): Promise<Result<{ total: number }>> {
  const { orderId, fee, order } = params;

  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
  const desechables = isDeliveryTable(order.table_number) ? itemCount * DESECHABLES_PER_DISH : 0;
  const subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const newTotal = subtotal + desechables + fee;

  const { error } = await supabase
    .from("orders")
    .update({ delivery_fee: fee, total: newTotal })
    .eq("id", orderId);

  if (error) return { error: "Error al actualizar el domicilio" };

  return { data: { total: newTotal } };
}

// ─── 7. Log Print Event ──────────────────────────────────────

export async function logPrintEvent(
  supabase: SupabaseClient,
  params: {
    orderId: string;
    version?: { type: "full" | "additional"; round?: number };
    actor: Actor;
  },
): Promise<Result<void>> {
  const { orderId, version, actor } = params;

  const { error } = await supabase.from("order_events").insert({
    order_id: orderId,
    event_type: "printed",
    actor_type: actor.type,
    actor_name: actor.name,
    actor_id: actor.id,
    metadata: {
      printed_at: new Date().toISOString(),
      version: version?.type ?? "full",
      ...(version?.round !== undefined ? { additional_round: version.round } : {}),
    },
  });

  if (error) return { error: "Error al registrar la impresión" };

  return { data: undefined };
}
