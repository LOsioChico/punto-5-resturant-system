"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { NotificationBell } from "@/components/ui/notification-bell";
import { usePushSubscription } from "@/lib/hooks/use-push-subscription";
import type { Category, Dish, Order, OrderStatus } from "@/lib/types";
import { WaiterStart } from "./waiter-start";
import { TableSelector } from "./table-selector";
import { CategoryList } from "./category-list";
import { DishGrid } from "./dish-grid";
import { OrderSummary } from "./order-summary";
import { type CartItem, hasCartChanged } from "@/lib/pos/logic";
import { WaiterOrders } from "./waiter-orders";
import { PosTabs, type PosTab } from "./pos-tabs";
import { Bell, BellOff, ChevronDown, LogOut } from "lucide-react";

const WAITER_KEY = "punto5:waiter-name";

export function PosClient() {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const { toast } = useToast();
  const configError = !supabase
    ? "Faltan las variables de entorno de Supabase. Copia .env.example a .env.local y complétalas."
    : null;

  const [waiterName, setWaiterName] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Read localStorage after hydration to avoid SSR mismatch
  useEffect(() => {
    setHydrated(true);
    const stored = localStorage.getItem(WAITER_KEY);
    if (stored) setWaiterName(stored);
  }, []);
  const { permission, subscribed, subscribe, unsubscribe } = usePushSubscription(waiterName);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<PosTab>("new");
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sending, setSending] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editInitialCart, setEditInitialCart] = useState<CartItem[] | null>(null);

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
            const statusMessages: Record<OrderStatus, { msg: string; variant: "status-nueva" | "status-en_cocina" | "status-lista" | "status-servida" }> = {
              nueva: { msg: `Mesa ${updated.table_number}: pedido recibido`, variant: "status-nueva" },
              en_cocina: { msg: `Mesa ${updated.table_number}: pedido en cocina`, variant: "status-en_cocina" },
              lista: { msg: `Mesa ${updated.table_number}: pedido listo para servir`, variant: "status-lista" },
              servida: { msg: `Mesa ${updated.table_number}: pedido servido`, variant: "status-servida" },
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
    };
  }, [supabase, waiterName]);

  const handleStart = useCallback((name: string) => {
    localStorage.setItem(WAITER_KEY, name);
    setWaiterName(name);
  }, []);

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

  const addToCart = useCallback((dish: Dish) => {
    // Look up category name for this dish
    const category = categories.find((c) => c.id === dish.category_id);
    const categoryName = category?.name ?? "";

    setCart((prev) => {
      const existing = prev.find((i) => i.dish_id === dish.id);
      if (existing) {
        return prev.map((i) =>
          i.dish_id === dish.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          dish_id: dish.id,
          dish_name: dish.name,
          category_name: categoryName,
          price: dish.price,
          quantity: 1,
          notes: "",
        },
      ];
    });
  }, [categories]);

  const incItem = useCallback((dishId: string) => {
    setCart((prev) =>
      prev.map((i) =>
        i.dish_id === dishId ? { ...i, quantity: i.quantity + 1 } : i,
      ),
    );
  }, []);

  const decItem = useCallback((dishId: string) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.dish_id === dishId ? { ...i, quantity: i.quantity - 1 } : i,
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
      const initialCart: CartItem[] = order.items.map((i) => ({
        dish_id: i.dish_id,
        dish_name: i.dish_name,
        category_name: i.category_name ?? "",
        price: i.price,
        quantity: i.quantity,
        notes: i.notes ?? "",
      }));
      setEditingOrderId(order.id);
      setSelectedTable(order.table_number);
      setEditInitialCart(initialCart);
      setCart(initialCart);
      setActiveTab("new");
    },
    [],
  );

  // Cancel editing — go back to history without saving
  const cancelEdit = useCallback(() => {
    setEditingOrderId(null);
    setEditInitialCart(null);
    setCart([]);
    setSelectedTable(null);
    setActiveTab("history");
  }, []);

  const setNotes = useCallback((dishId: string, notes: string) => {
    setCart((prev) =>
      prev.map((i) => (i.dish_id === dishId ? { ...i, notes } : i)),
    );
  }, []);

  const sendOrder = useCallback(async () => {
    if (!waiterName || !supabase || selectedTable === null || cart.length === 0)
      return;
    setSending(true);
    const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        table_number: selectedTable,
        waiter_name: waiterName,
        status: "nueva",
        total,
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
        notes: item.notes || null,
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
      to_status: "nueva",
      metadata: { table_number: selectedTable, item_count: cart.length, total },
    });

    toast(`Pedido enviado a cocina — Mesa ${selectedTable}`, "success");
    setCart([]);
    setSending(false);
  }, [supabase, waiterName, selectedTable, cart, toast]);

  // Save edits to an existing order — diff items instead of delete+reinsert
  const saveEditedOrder = useCallback(async () => {
    if (!waiterName || !supabase || !editingOrderId || cart.length === 0) return;
    setSending(true);
    const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const original = orders.find((o) => o.id === editingOrderId);
    const oldItems = original?.items ?? [];

    // Build maps by dish_id for diffing
    const oldByDish = new Map(oldItems.map((i) => [i.dish_id, i]));
    const newByDish = new Map(cart.map((i) => [i.dish_id, i]));

    const toInsert: CartItem[] = [];
    const toUpdate: { id: string; quantity: number; notes: string | null }[] = [];
    const toDelete: string[] = [];

    for (const newItem of cart) {
      const old = oldByDish.get(newItem.dish_id);
      if (!old) {
        // New item — insert
        toInsert.push(newItem);
      } else if (old.quantity !== newItem.quantity || (old.notes ?? "") !== newItem.notes) {
        // Changed item — update
        toUpdate.push({
          id: old.id,
          quantity: newItem.quantity,
          notes: newItem.notes || null,
        });
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
          notes: item.notes || null,
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

    toast(`Pedido actualizado — Mesa ${selectedTable}`, "success");
    setCart([]);
    setEditingOrderId(null);
    setEditInitialCart(null);
    setSelectedTable(null);
    setSending(false);
    setActiveTab("history");
  }, [supabase, waiterName, editingOrderId, cart, orders, selectedTable, toast]);

  // --- Render ---

  // When editing, check if the cart actually differs from the initial state
  const editHasChanges = useMemo(() => {
    if (!editInitialCart || !editingOrderId) return false;
    return hasCartChanged(editInitialCart, cart);
  }, [editInitialCart, cart, editingOrderId]);

  const displayError = configError ?? error;

  // Don't render anything until hydrated — avoids SSR/client mismatch
  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-stone-950 text-stone-500">
        Cargando...
      </div>
    );
  }

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

  if (!waiterName) {
    return <WaiterStart onStart={handleStart} />;
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
          <div className="flex size-9 items-center justify-center rounded-lg bg-yellow-500 text-base font-bold text-stone-950">
            P5
          </div>
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
                        subscribed ? unsubscribe() : subscribe();
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
                      localStorage.removeItem(WAITER_KEY);
                      setWaiterName(null);
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

      {/* Tabs */}
      <PosTabs
        active={activeTab}
        onChange={setActiveTab}
        historyCount={myActiveOrders.length}
      />

      {activeTab === "new" ? (
        <>
          {/* Table selector */}
          <TableSelector
            selected={selectedTable}
            onSelect={setSelectedTable}
            tableStatuses={tableStatuses}
          />

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
              items={cart}
              onInc={incItem}
              onDec={decItem}
              onRemove={removeItem}
              onClear={clearCart}
              onSend={sendOrder}
              onSetNotes={setNotes}
              sending={sending}
              editingOrderId={editingOrderId}
              editHasChanges={editHasChanges}
              onSaveEdit={saveEditedOrder}
              onCancelEdit={cancelEdit}
            />
          </div>
        </>
      ) : (
        <WaiterOrders
          orders={orders}
          waiterName={waiterName}
          onEdit={editOrder}
        />
      )}
    </div>
  );
}
