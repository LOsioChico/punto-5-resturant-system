// Domain types for the restaurant POC.
// UI strings are Spanish; code/comments are English.

export interface Category {
  id: string;
  name: string;
  description: string;
  sort_order: number;
}

export interface Dish {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  sort_order: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  dish_id: string;
  dish_name: string;
  category_name: string | null;
  price: number;
  quantity: number;
  notes: string[] | null;
  is_additional: boolean;
  additional_number: number | null;
}

export type OrderStatus = "nueva" | "en_cocina" | "servida" | "finalizada" | "adicional";

export type ActorType = "waiter" | "admin" | "system";

export type EventType =
  | "created"
  | "status_changed"
  | "printed"
  | "updated"
  | "cancelled"
  | "additional_added"
  | "delivery_fee_set";

export interface Order {
  id: string;
  order_number: number;
  table_number: number;
  waiter_name: string;
  waiter_id: string;
  status: OrderStatus;
  total: number;
  notes: string | null;
  delivery_name: string | null;
  delivery_fee: number;
  created_at: string;
  items: OrderItem[];
  // Audit tracking (nullable — set on first update)
  updated_by: string | null;
  updated_at: string | null;
  updated_by_type: ActorType | null;
  // Soft delete (nullable — set when admin deletes the order)
  deleted_at: string | null;
}

/** A single audit event for an order (who did what, when, what changed). */
export interface OrderEvent {
  id: string;
  order_id: string;
  event_type: EventType;
  actor_type: ActorType;
  actor_name: string;
  actor_id: string | null;
  from_status: OrderStatus | null;
  to_status: OrderStatus | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** A waiter currently active on the POS (presence channel). */
export interface ActiveWaiter {
  name: string;
  joinedAt: string;
}

/** A waiter account (linked to Supabase Auth). */
export interface Waiter {
  id: string;
  auth_id: string;
  cedula: string;
  name: string;
  is_active: boolean;
  pin_changed: boolean;
  created_at: string;
  created_by: string | null;
  // Soft delete (nullable — set when admin deletes the waiter)
  deleted_at: string | null;
}

/** Auth user role. */
export type AuthRole = "admin" | "waiter";
