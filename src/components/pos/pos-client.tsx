"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { NotificationBell } from "@/components/ui/notification-bell";
import { usePushSubscription } from "@/lib/hooks/use-push-subscription";
import { useAuth } from "@/lib/hooks/use-auth";
import { signOut } from "@/lib/auth";
import { tableLabel, isDeliveryTable, DESECHABLES_PER_DISH } from "@/lib/utils";
import { countParaLlevar, isParaLlevar, syncNotesForTableChange, addParaLlevar } from "@/lib/pos/logic";
import type { Category, Dish, Order, OrderStatus } from "@/lib/types";
import { TableSelector } from "./table-selector";
import { CategoryList } from "./category-list";
import { DishGrid } from "./dish-grid";
import { OrderSummary } from "./order-summary";
import { type CartItem, hasCartChanged } from "@/lib/pos/logic";
import { WaiterOrders } from "./waiter-orders";
import { PosTabs, type PosTab } from "./pos-tabs";
import { Bell, BellOff, ChevronDown, LogOut } from "lucide-react";

export function PosClient() {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const router = useRouter();
  const { toast } = useToast();
  const { waiter, user, loading: authLoading } = useAuth();
  const waiterName = waiter?.name ?? null;
  const waiterId = waiter?.id ?? null;
  const authId = user?.id ?? null;
  const configError = !supabase
    ? "Faltan las variables de entorno de Supabase. Copia .env.example a .env.local y complétalas."
    : null;

  const presenceChannelRef = useRef<ReturnType<NonNullable<ReturnType<typeof createSupabaseClient>>["channel"]> | null>(null);
  const { permission, subscribed, subscribe, unsubscribe } = usePushSubscription(waiterName);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const [activeTab, setActiveTab] = useState<PosTab>("new");
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [deliveryName, setDeliveryName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sending, setSending] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editInitialCart, setEditInitialCart] = useState<CartItem[] | null>(null);
  const [additionalOrderId, setAdditionalOrderId] = useState<string | null>(null);

  // Sync notes when table changes:
  // - Switching TO delivery: add "Para llevar" to all notes that don't have it
  // - Switching FROM delivery to a regular table: remove "Para llevar" from all notes
  // - Switching between regular tables: no change
  const prevTableRef = useRef<number | null>(null);
  useEffect(() => {
    const prevTable = prevTableRef.current;
    prevTableRef.current = selectedTable;
    if (selectedTable === null) return;
    const isDelivery = isDeliveryTable(selectedTable);
    const wasDelivery = prevTable !== null && isDeliveryTable(prevTable);
    setCart((prev) => {
      const needsChange = prev.some((i) =>
        JSON.stringify(i.notes) !== JSON.stringify(syncNotesForTableChange(i.notes, isDelivery, wasDelivery)),
      );
      if (!needsChange) return prev;
      return prev.map((i) => ({
        ...i,
        notes: syncNotesForTableChange(i.notes, isDelivery, wasDelivery),
      }));
    });
  }, [selectedTable]);

  // Adicional orders: always add "Para llevar" to all notes that don't have it
  useEffect(() => {
    if (additionalOrderId === null) return;
    setCart((prev) => {
      const needsUpdate = prev.some((i) => i.notes.some((n) => !isParaLlevar(n)));
      if (!needsUpdate) return prev;
      return prev.map((i) => ({
        ...i,
        notes: i.notes.map((n) => (isParaLlevar(n) ? n : addParaLlevar(n))),
      }));
    });
  }, [additionalOrderId]);

  // All orders (for table status + waiter history) — updated in realtime
  const [orders, setOrders] = useState<Order[]>([]);

  // Load menu data from Supabase.
  useEffect(() => {
    if (!waiterName || !supabase) return;
    (async () => {
      const [catRes, dishRes] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("dishes").select("*").order("sort_order"),
      ]);

      if (catRes.error || dishRes.error) {
        setError(
          catRes.error?.message ?? dishRes.error?.message ?? "Error al cargar el menú",
        );
      } else {
        setCategories(catRes.data as Category[]);
        setDishes(dishRes.data as Dish[]);
        if (catRes.data.length > 0) setSelectedCategory(catRes.data[0].id);
      }
      setLoading(false);
    })();
  }, [supabase, waiterName]);

  // Load existing orders + subscribe to realtime changes (for table statuses + history).
  useEffect(() => {
    if (!waiterName || !supabase) return;

    const loadOrders = async () => {
      const { data: orderRows } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!orderRows || orderRows.length === 0) return;

      const { data: itemRows } = await supabase
        .from("order_items")
        .select("*, dishes(categories(name))")
        .in("order_id", orderRows.map((o) => o.id));

      const ordersWithItems: Order[] = orderRows.map((o) => ({
        ...o,
        items: (itemRows ?? [])
          .filter((i) => i.order_id === o.id)
          .map((i) => ({
            ...i,
            category_name: i.dishes?.categories?.name ?? null,
          })),
      }));
      setOrders(ordersWithItems);
    };

    loadOrders();

    // Subscribe to order inserts + updates (status changes by admin)
    const channel = supabase
      .channel("pos-orders-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        async (payload) => {
          const newOrder = payload.new as Order;
          setTimeout(async () => {
            const { data: items } = await supabase
              .from("order_items")
              .select("*, dishes(categories(name))")
              .eq("order_id", newOrder.id);
            setOrders((prev) => [
              {
                ...newOrder,
                items: (items ?? []).map((i) => ({
                  ...i,
                  category_name: i.dishes?.categories?.name ?? null,
                })),
              },
              ...prev,
            ]);
          }, 500);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        async (payload) => {
          const updated = payload.new as Order;

          // Reload items if the order was modified by a waiter (items may have changed)
          if (updated.updated_by_type === "waiter" && updated.updated_at) {
            // Small delay to ensure replication has caught up
            await new Promise((r) => setTimeout(r, 300));
            const { data: items } = await supabase
              .from("order_items")
              .select("*, dishes(categories(name))")
              .eq("order_id", updated.id);
            setOrders((prev) =>
              prev.map((o) =>
                o.id === updated.id
                  ? {
                      ...o,
                      ...updated,
                      items: (items ?? []).map((i) => ({
                        ...i,
                        category_name: i.dishes?.categories?.name ?? null,
                      })),
                    }
                  : o,
              ),
            );
          } else {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === updated.id ? { ...o, ...updated, items: o.items } : o,
              ),
            );
          }

          // Toast the waiter when their order's status changes
          if (updated.waiter_name === waiterName) {
            const statusMessages: Record<OrderStatus, { msg: string; variant: "status-nueva" | "status-en_cocina" | "status-lista" | "status-servida" | "status-adicional" }> = {
              nueva: { msg: `${tableLabel(updated.table_number)}: pedido recibido`, variant: "status-nueva" },
              en_cocina: { msg: `${tableLabel(updated.table_number)}: pedido en cocina`, variant: "status-en_cocina" },
              lista: { msg: `${tableLabel(updated.table_number)}: pedido listo para servir`, variant: "status-lista" },
              servida: { msg: `${tableLabel(updated.table_number)}: pedido servido`, variant: "status-servida" },
              adicional: { msg: `${tableLabel(updated.table_number)}: adicional agregado`, variant: "status-adicional" },
            };
            const { msg, variant } = statusMessages[updated.status];
            toast(msg, variant, updated.table_number);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, waiterName, toast]);

  // Join presence channel so the dashboard sees this waiter as active.
  // The heartbeat keeps the WebSocket alive (iOS may close idle connections)
  // and refreshes the joinedAt timestamp. Supabase presence automatically
  // fires a "leave" event when the WebSocket disconnects (page closed),
  // so the waiter is only removed when the page is actually closed.
  useEffect(() => {
    if (!waiterName || !supabase) return;
    const channel = supabase.channel("waiters", {
      config: { presence: { key: waiterName } },
    });
    presenceChannelRef.current = channel;

    const track = () =>
      channel.track({
        name: waiterName,
        joinedAt: new Date().toISOString(),
      });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await track();
      }
    });

    // Heartbeat — re-track every 15s to keep the WebSocket alive
    // and refresh the timestamp. No need for aggressive timing since
    // we rely on Supabase's native presence leave detection.
    const heartbeat = setInterval(track, 15_000);

    // Re-track when tab becomes visible again (in case the WebSocket
    // was dropped while backgrounded)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        track();
      }
    };

    // Untrack on actual page close — pagehide fires reliably on iOS/iPadOS
    const handleUnload = () => {
      channel.untrack();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
      channel.untrack();
      supabase.removeChannel(channel);
      presenceChannelRef.current = null;
    };
  }, [supabase, waiterName]);

  // Logout — explicitly untrack from presence before signing out
  // so the dashboard removes the waiter immediately.
  const handleLogout = useCallback(async () => {
    const channel = presenceChannelRef.current;
    if (channel) {
      await channel.untrack();
    }
    await signOut();
    router.replace("/login/waiter");
  }, [router]);

  const filteredDishes = useMemo(
    () => dishes.filter((d) => d.category_id === selectedCategory),
    [dishes, selectedCategory],
  );

  // Map of table number → latest order status (for color-coded table selector)
  const tableStatuses = useMemo(() => {
    const map = new Map<number, OrderStatus>();
    for (const order of orders) {
      if (order.status === "servida") continue; // don't show served tables as busy
      // Keep the latest status per table (orders are sorted desc by created_at)
      if (!map.has(order.table_number)) {
        map.set(order.table_number, order.status);
      }
    }
    return map;
  }, [orders]);

  // This waiter's active orders (for the history tab badge count)
  const myActiveOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.waiter_name === waiterName && o.status !== "servida",
      ),
    [orders, waiterName],
  );

  // Both delivery and adicional force "Para llevar" on all items
  const forceParaLlevar = (selectedTable !== null && isDeliveryTable(selectedTable)) || additionalOrderId !== null;

  const addToCart = useCallback((dish: Dish) => {
    // Look up category name for this dish
    const category = categories.find((c) => c.id === dish.category_id);
    const categoryName = category?.name ?? "";
    // Delivery and adicional default to "Para llevar" on every unit
    const defaultNote = forceParaLlevar ? "Para llevar" : "";

    setCart((prev) => {
      const existing = prev.find((i) => i.dish_id === dish.id);
      if (existing) {
        return prev.map((i) =>
          i.dish_id === dish.id
            ? { ...i, quantity: i.quantity + 1, notes: [...i.notes, defaultNote] }
            : i,
        );
      }
      return [
        ...prev,
        {
          dish_id: dish.id,
          dish_name: dish.name,
          category_name: categoryName,
          description: dish.description,
          price: dish.price,
          quantity: 1,
          notes: [defaultNote],
        },
      ];
    });
  }, [categories, forceParaLlevar]);

  const incItem = useCallback((dishId: string) => {
    const defaultNote = forceParaLlevar ? "Para llevar" : "";
    setCart((prev) =>
      prev.map((i) =>
        i.dish_id === dishId
          ? { ...i, quantity: i.quantity + 1, notes: [...i.notes, defaultNote] }
          : i,
      ),
    );
  }, [forceParaLlevar]);

  const decItem = useCallback((dishId: string) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.dish_id === dishId
            ? { ...i, quantity: i.quantity - 1, notes: i.notes.slice(0, -1) }
            : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const removeItem = useCallback((dishId: string) => {
    setCart((prev) => prev.filter((i) => i.dish_id !== dishId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setEditingOrderId(null);
  }, []);

  // Load an existing order into the cart for editing
  const editOrder = useCallback(
    (order: Order) => {
      const initialCart: CartItem[] = order.items.map((i) => {
        const notes = i.notes ?? [];
        // Ensure notes array length matches quantity
        const syncedNotes = Array.from({ length: i.quantity }, (_, idx) => notes[idx] ?? "");
        // Find the dish description from the dishes list
        const dish = dishes.find((d) => d.id === i.dish_id);
        return {
          dish_id: i.dish_id,
          dish_name: i.dish_name,
          category_name: i.category_name ?? "",
          description: dish?.description ?? "",
          price: i.price,
          quantity: i.quantity,
          notes: syncedNotes,
        };
      });
      setEditingOrderId(order.id);
      setSelectedTable(order.table_number);
      setDeliveryName(order.delivery_name ?? "");
      setEditInitialCart(initialCart);
      setCart(initialCart);
      setActiveTab("new");
    },
    [dishes],
  );

  // Cancel editing — go back to history without saving
  const cancelEdit = useCallback(() => {
    setEditingOrderId(null);
    setEditInitialCart(null);
    setCart([]);
    setSelectedTable(null);
    setDeliveryName("");
    setActiveTab("history");
  }, []);

  // Start adding an additional to a served order
  const startAdditional = useCallback((order: Order) => {
    setAdditionalOrderId(order.id);
    setSelectedTable(order.table_number);
    setDeliveryName(order.delivery_name ?? "");
    setCart([]);
    setActiveTab("new");
  }, []);

  // Cancel additional — go back to history
  const cancelAdditional = useCallback(() => {
    setAdditionalOrderId(null);
    setCart([]);
    setSelectedTable(null);
    setDeliveryName("");
    setActiveTab("history");
  }, []);

  // For delivery and adicional orders, ensure "Para llevar" is always present in notes
  const ensureParaLlevar = useCallback((value: string): string => {
    if (!forceParaLlevar) return value;
    if (isParaLlevar(value)) return value;
    const parts = value.split(",").map((p) => p.trim()).filter(Boolean);
    return [...parts, "Para llevar"].join(", ");
  }, [forceParaLlevar]);

  const setNotes = useCallback((dishId: string, unitIndex: number, value: string) => {
    const finalValue = ensureParaLlevar(value);
    setCart((prev) =>
      prev.map((i) =>
        i.dish_id === dishId
          ? { ...i, notes: i.notes.map((n, idx) => (idx === unitIndex ? finalValue : n)) }
          : i,
      ),
    );
  }, [ensureParaLlevar]);

  const setAllNotes = useCallback((dishId: string, value: string) => {
    const finalValue = ensureParaLlevar(value);
    setCart((prev) =>
      prev.map((i) =>
        i.dish_id === dishId
          ? { ...i, notes: Array.from({ length: i.quantity }, () => finalValue) }
          : i,
      ),
    );
  }, [ensureParaLlevar]);

  const sendOrder = useCallback(async () => {
    if (!waiterName || !waiterId || !supabase || selectedTable === null || cart.length === 0)
      return;
    // Delivery orders require a customer name
    if (isDeliveryTable(selectedTable) && !deliveryName.trim()) {
      toast("Identifica al cliente para el domicilio", "error");
      return;
    }
    setSending(true);
    const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);
    const isDelivery = isDeliveryTable(selectedTable);
    const paraLlevarCount = isDelivery ? 0 : cart.reduce((sum, i) => sum + countParaLlevar(i.notes), 0);
    const desechables = (isDelivery ? itemCount : paraLlevarCount) * DESECHABLES_PER_DISH;
    const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0) + desechables;

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        table_number: selectedTable,
        waiter_name: waiterName,
        waiter_id: waiterId,
        status: "nueva",
        total,
        delivery_name: isDeliveryTable(selectedTable) ? deliveryName.trim() : null,
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      toast("Error al crear el pedido", "error");
      setSending(false);
      return;
    }

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
      toast("Error al guardar los items del pedido", "error");
      setSending(false);
      return;
    }

    // Log audit event: order created by this waiter
    await supabase.from("order_events").insert({
      order_id: order.id,
      event_type: "created",
      actor_type: "waiter",
      actor_name: waiterName,
      actor_id: authId,
      to_status: "nueva",
      metadata: { table_number: selectedTable, item_count: cart.length, total },
    });

    toast(`Pedido enviado a cocina — ${tableLabel(selectedTable)}`, "success");
    setCart([]);
    setDeliveryName("");
    setSending(false);
  }, [supabase, waiterName, waiterId, authId, selectedTable, cart, deliveryName, toast]);

  // Send additional items to a served order
  const sendAdditional = useCallback(async () => {
    if (!waiterName || !waiterId || !supabase || !additionalOrderId || cart.length === 0) return;
    setSending(true);

    const original = orders.find((o) => o.id === additionalOrderId);
    if (!original) {
      toast("No se encontró el pedido original", "error");
      setSending(false);
      return;
    }

    // Next additional round number
    const nextRound = original.items.reduce((max, i) => {
      return i.additional_number && i.additional_number > max ? i.additional_number : max;
    }, 0) + 1;

    // Insert additional items
    const { error: itemsErr } = await supabase.from("order_items").insert(
      cart.map((item) => ({
        order_id: additionalOrderId,
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
      toast("Error al guardar el adicional", "error");
      setSending(false);
      return;
    }

    // Recalculate total (original items + new additional items + desechables)
    // Adicional always charges desechables per dish (like delivery)
    const paraLlevarCount = cart.reduce((s, i) => s + i.quantity, 0);
    const additionalDesechables = paraLlevarCount * DESECHABLES_PER_DISH;
    const additionalTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0) + additionalDesechables;
    const newTotal = original.total + additionalTotal;

    // Move order to "adicional" so kitchen knows there's pending work
    const { error: orderErr } = await supabase
      .from("orders")
      .update({ status: "adicional", total: newTotal })
      .eq("id", additionalOrderId);

    if (orderErr) {
      toast("Error al actualizar el pedido", "error");
      setSending(false);
      return;
    }

    // Log audit event
    await supabase.from("order_events").insert({
      order_id: additionalOrderId,
      event_type: "additional_added",
      actor_type: "waiter",
      actor_name: waiterName,
      actor_id: authId,
      from_status: original.status,
      to_status: "adicional",
      metadata: {
        additional_number: nextRound,
        item_count: cart.length,
        additional_total: additionalTotal,
        additional_desechables: additionalDesechables,
        new_total: newTotal,
        added_items: cart.map((i) => ({ name: i.dish_name, qty: i.quantity, notes: i.notes })),
      },
    });

    toast(`Adicional #${nextRound} enviado a cocina — ${tableLabel(original.table_number)}`, "success");
    setCart([]);
    setAdditionalOrderId(null);
    setSelectedTable(null);
    setSending(false);
    setActiveTab("history");
  }, [supabase, waiterName, waiterId, authId, additionalOrderId, cart, orders, toast]);

  // Save edits to an existing order — diff items instead of delete+reinsert
  const saveEditedOrder = useCallback(async () => {
    if (!waiterName || !supabase || !editingOrderId || cart.length === 0) return;
    setSending(true);
    const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);
    const isDelivery = isDeliveryTable(selectedTable!);
    const paraLlevarCount = isDelivery ? 0 : cart.reduce((sum, i) => sum + countParaLlevar(i.notes), 0);
    const desechables = (isDelivery ? itemCount : paraLlevarCount) * DESECHABLES_PER_DISH;
    const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0) + desechables;

    const original = orders.find((o) => o.id === editingOrderId);
    const oldItems = original?.items ?? [];

    // Build maps by dish_id for diffing
    const oldByDish = new Map(oldItems.map((i) => [i.dish_id, i]));
    const newByDish = new Map(cart.map((i) => [i.dish_id, i]));

    const toInsert: CartItem[] = [];
    const toUpdate: { id: string; quantity: number; notes: string[] | null }[] = [];
    const toDelete: string[] = [];

    for (const newItem of cart) {
      const old = oldByDish.get(newItem.dish_id);
      if (!old) {
        // New item — insert
        toInsert.push(newItem);
      } else {
        // Compare notes arrays (normalize for trailing empty strings)
        const oldNotes = (old.notes ?? []).map((n: string) => n.trim());
        const newNotes = newItem.notes.map((n) => n.trim());
        while (oldNotes.length > 0 && oldNotes[oldNotes.length - 1] === "") oldNotes.pop();
        while (newNotes.length > 0 && newNotes[newNotes.length - 1] === "") newNotes.pop();
        const notesChanged = oldNotes.length !== newNotes.length || oldNotes.some((v, i) => v !== newNotes[i]);

        if (old.quantity !== newItem.quantity || notesChanged) {
          // Changed item — update
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
        // Removed item — delete
        toDelete.push(oldItem.id);
      }
    }

    // 1. Apply item changes (insert / update / delete) before the order UPDATE
    //    so realtime sees the final state when the UPDATE event fires

    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from("order_items")
        .delete()
        .in("id", toDelete);
      if (delErr) {
        toast("Error al eliminar items", "error");
        setSending(false);
        return;
      }
    }

    if (toUpdate.length > 0) {
      for (const item of toUpdate) {
        const { error: updErr } = await supabase
          .from("order_items")
          .update({ quantity: item.quantity, notes: item.notes })
          .eq("id", item.id);
        if (updErr) {
          toast("Error al actualizar items", "error");
          setSending(false);
          return;
        }
      }
    }

    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from("order_items").insert(
        toInsert.map((item) => ({
          order_id: editingOrderId,
          dish_id: item.dish_id,
          dish_name: item.dish_name,
          price: item.price,
          quantity: item.quantity,
          notes: item.notes.some((n) => n.trim()) ? item.notes : null,
        })),
      );
      if (insErr) {
        toast("Error al agregar items", "error");
        setSending(false);
        return;
      }
    }

    // 2. Log the update event with detailed change info
    await supabase.from("order_events").insert({
      order_id: editingOrderId,
      event_type: "updated",
      actor_type: "waiter",
      actor_name: waiterName,
      actor_id: authId,
      to_status: original?.status ?? null,
      metadata: {
        table_number: selectedTable,
        item_count: cart.length,
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

    // 3. Update order LAST — fires the realtime UPDATE event
    const { error: orderErr } = await supabase
      .from("orders")
      .update({
        total,
        delivery_name: isDeliveryTable(selectedTable!) ? deliveryName.trim() : null,
        updated_by: waiterName,
        updated_at: new Date().toISOString(),
        updated_by_type: "waiter",
      })
      .eq("id", editingOrderId);

    if (orderErr) {
      toast("Error al actualizar el pedido", "error");
      setSending(false);
      return;
    }

    toast(`Pedido actualizado — ${tableLabel(selectedTable!)}`, "success");
    setCart([]);
    setEditingOrderId(null);
    setEditInitialCart(null);
    setSelectedTable(null);
    setDeliveryName("");
    setSending(false);
    setActiveTab("history");
  }, [supabase, waiterName, authId, editingOrderId, cart, orders, selectedTable, deliveryName, toast]);

  // --- Render ---

  // When editing, check if the cart actually differs from the initial state
  const editHasChanges = useMemo(() => {
    if (!editInitialCart || !editingOrderId) return false;
    return hasCartChanged(editInitialCart, cart);
  }, [editInitialCart, cart, editingOrderId]);

  const displayError = configError ?? error;

  if (displayError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg font-semibold text-red-400">{displayError}</p>
        <p className="text-sm text-stone-600">
          Verifica que las variables de entorno de Supabase estén configuradas y
          que el esquema SQL haya sido ejecutado.
        </p>
      </div>
    );
  }

  // AuthGuard handles redirect, but show loading while auth resolves
  if (authLoading || !waiterName) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-stone-500">
        Cargando...
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-stone-500">
        Cargando menú...
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-stone-950">
      {/* Top bar */}
      <div
        className="flex items-center justify-between border-b border-white/5 bg-stone-950 px-6 py-3.5"
        style={{ paddingTop: "max(0.875rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-3">
          <Image
            src="/icon-192.png"
            alt="Punto 5"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <div>
            <span className="text-base font-bold text-stone-100">Punto 5</span>
            <span className="ml-2 text-sm text-stone-600">POS</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          {/* Waiter menu dropdown */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-base text-stone-600 transition-colors hover:bg-stone-900 hover:text-stone-300"
            >
              {waiterName}
              <ChevronDown className={`size-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-lg border border-white/10 bg-stone-950 shadow-xl">
                  {/* Notifications toggle */}
                  {permission !== "unsupported" && permission !== "denied" && (
                    <button
                      onClick={() => {
                        if (subscribed) unsubscribe();
                        else subscribe();
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-stone-900"
                    >
                      <div className={`flex size-10 items-center justify-center rounded-lg ${
                        subscribed ? "bg-green-500/10 text-green-400" : "bg-stone-800 text-stone-500"
                      }`}>
                        {subscribed ? <Bell className="size-5" /> : <BellOff className="size-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-base text-stone-200">Notificaciones</p>
                        <p className="text-sm text-stone-500">
                          {subscribed ? "Activadas" : "Desactivadas"}
                        </p>
                      </div>
                    </button>
                  )}
                  {permission === "denied" && (
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-stone-800 text-stone-600">
                        <BellOff className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base text-stone-400">Notificaciones bloqueadas</p>
                        <p className="text-sm text-stone-600">Actívalas en el navegador</p>
                      </div>
                    </div>
                  )}
                  {/* Divider */}
                  <div className="h-px bg-white/5" />
                  {/* Logout */}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmSignOut(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-stone-900"
                  >
                    <div className="flex size-10 items-center justify-center rounded-lg bg-stone-800 text-stone-500">
                      <LogOut className="size-5" />
                    </div>
                    <p className="text-base text-stone-300">Salir</p>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sign out confirmation modal */}
      {confirmSignOut && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-stone-800 bg-stone-950 p-6 shadow-2xl">
            <div className="mb-4 flex flex-col items-center gap-3 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-red-500/10">
                <LogOut className="size-6 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-stone-100">¿Cerrar sesión?</h3>
              <p className="text-sm text-stone-500">
                Los pedidos enviados a cocina no se verán afectados.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmSignOut(false)}
                className="flex-1 rounded-lg border border-stone-800 px-4 py-2.5 text-sm font-medium text-stone-300 transition-colors hover:bg-stone-900"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setConfirmSignOut(false);
                  await handleLogout();
                }}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-400"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <PosTabs
        active={activeTab}
        onChange={(tab) => {
          // Don't allow switching tabs while adding an additional
          if (additionalOrderId && tab !== "new") return;
          setActiveTab(tab);
        }}
        historyCount={myActiveOrders.length}
      />

      {activeTab === "new" ? (
        <>
          {/* Table selector — hidden when adding an additional (table is locked) */}
          {!additionalOrderId && (
            <TableSelector
              selected={selectedTable}
              onSelect={setSelectedTable}
              tableStatuses={tableStatuses}
            />
          )}

          {/* Category pills — horizontal */}
          <CategoryList
            categories={categories}
            dishes={dishes}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />

          {/* Main 2-column: dishes + cart */}
          <div className="flex flex-1 overflow-hidden">
            <DishGrid
              dishes={filteredDishes}
              categories={categories}
              cart={cart}
              onAdd={addToCart}
              onInc={incItem}
              onDec={decItem}
            />
            <OrderSummary
              tableNumber={selectedTable}
              deliveryName={deliveryName}
              onDeliveryNameChange={setDeliveryName}
              items={cart}
              onInc={incItem}
              onDec={decItem}
              onRemove={removeItem}
              onClear={clearCart}
              onSend={sendOrder}
              onSetNotes={setNotes}
              onSetAllNotes={setAllNotes}
              sending={sending}
              editingOrderId={editingOrderId}
              editHasChanges={editHasChanges}
              onSaveEdit={saveEditedOrder}
              onCancelEdit={cancelEdit}
              additionalOrderId={additionalOrderId}
              onSendAdditional={sendAdditional}
              onCancelAdditional={cancelAdditional}
            />
          </div>
        </>
      ) : (
        <WaiterOrders
          orders={orders}
          waiterName={waiterName}
          onEdit={editOrder}
          onAddAdditional={startAdditional}
        />
      )}
    </div>
  );
}
