"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { signOut } from "@/lib/auth";
import type { ActiveWaiter, Order, OrderEvent, OrderStatus } from "@/lib/types";
import { isDeliveryTable, DESECHABLES_PER_DISH } from "@/lib/utils";
import { OrdersFeed } from "./orders-feed";
import { ActiveWaiters } from "./active-waiters";
import { OrderDetail } from "./order-detail";
import { Clock, ChefHat, CheckCircle2, Utensils, Calendar, X, Users, WifiOff, LogOut, UserCog } from "lucide-react";
import { cacheOrders, loadCachedOrders } from "@/lib/offline/db";

const STATUS_FLOW: OrderStatus[] = ["nueva", "en_cocina", "lista", "servida"];

const STATUS_LABELS: Record<OrderStatus, string> = {
  nueva: "Nuevas",
  en_cocina: "En cocina",
  lista: "Listas",
  servida: "Servidas",
};

export function DashboardClient() {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const adminName = user?.email ?? "admin";
  const adminId = user?.id ?? null;
  const configError = !supabase
    ? "Faltan las variables de entorno de Supabase. Copia .env.example a .env.local y complétalas."
    : null;

  const [orders, setOrders] = useState<Order[]>([]);
  const [waiters, setWaiters] = useState<ActiveWaiter[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | null>(null);
  const [waiterFilter, setWaiterFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "all">("today");
  const [isOnline, setIsOnline] = useState(true);
  const [undoData, setUndoData] = useState<{
    orderId: string;
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
  } | null>(null);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      // If offline, load from cache
      if (!navigator.onLine) {
        const cached = await loadCachedOrders<Order>();
        if (cached && cached.length > 0) {
          setOrders(cached);
        }
        setLoading(false);
        return;
      }

      const { data: orderRows, error: orderErr } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (orderErr) {
        // Network error — try cache
        if (orderErr.message.includes("Failed to fetch") || orderErr.message.includes("network")) {
          const cached = await loadCachedOrders<Order>();
          if (cached) setOrders(cached);
        } else {
          setError(orderErr.message);
        }
        setLoading(false);
        return;
      }

      if (!orderRows || orderRows.length === 0) {
        setLoading(false);
        return;
      }

      const { data: itemRows, error: itemErr } = await supabase
        .from("order_items")
        .select("*, dishes(categories(name))")
        .in("order_id", orderRows.map((o) => o.id));

      if (itemErr) {
        setError(itemErr.message);
        setLoading(false);
        return;
      }

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
      cacheOrders(ordersWithItems); // persist for offline use
      setLoading(false);
    })();
  }, [supabase, adminId, adminName]);

  // Keep IndexedDB cache in sync with orders state
  useEffect(() => {
    if (orders.length > 0) {
      cacheOrders(orders);
    }
  }, [orders]);

  useEffect(() => {
    if (!supabase) return;
    const orderChannel = supabase
      .channel("orders-realtime")
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

          // Reload items if a waiter modified the order (items may have changed)
          if (updated.updated_by_type === "waiter" && updated.updated_at) {
            // Small delay to ensure replication has caught up (items were
            // inserted before the order UPDATE, but Supabase realtime
            // may still be propagating)
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

            // Also reload events for the selected order so the audit
            // trail shows the "updated" event immediately
            if (selectedIdRef.current === updated.id) {
              const { data: evts } = await supabase
                .from("order_events")
                .select("*")
                .eq("order_id", updated.id)
                .order("created_at", { ascending: true });
              setEvents((evts as OrderEvent[]) ?? []);
            }
          } else {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === updated.id ? { ...o, ...updated, items: o.items } : o,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
    };
  }, [supabase, adminId, adminName]);

  // Online/offline detection — just show a banner, don't auto-reload.
  // The admin can manually refresh the page when back online.
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };
    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel("waiters");

    const syncWaiters = () => {
      const state = channel.presenceState<{ name: string; joinedAt: string }>();
      // Dedupe by name — Supabase presence already removes disconnected
      // clients (WebSocket close fires a leave event), so we don't need
      // timestamp-based stale filtering. If they're in presence state,
      // their connection is alive.
      const byName = new Map<string, ActiveWaiter>();
      for (const p of Object.values(state).flat()) {
        const existing = byName.get(p.name);
        if (!existing || new Date(p.joinedAt) > new Date(existing.joinedAt)) {
          byName.set(p.name, { name: p.name, joinedAt: p.joinedAt });
        }
      }
      setWaiters(Array.from(byName.values()));
    };

    channel
      .on("presence", { event: "sync" }, syncWaiters)
      .on("presence", { event: "leave" }, syncWaiters)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, adminId, adminName]);

  useEffect(() => {
    if (!supabase || !selectedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale state when selection is removed
      setEvents([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("order_events")
        .select("*")
        .eq("order_id", selectedId)
        .order("created_at", { ascending: true });
      setEvents((data as OrderEvent[]) ?? []);
    })();

    const channel = supabase
      .channel(`events-${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_events",
          filter: `order_id=eq.${selectedId}`,
        },
        (payload) => {
          setEvents((prev) => [...prev, payload.new as OrderEvent]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, selectedId]);

  const advanceStatus = useCallback(
    async (id: string) => {
      if (!supabase || !navigator.onLine) return;
      const order = orders.find((o) => o.id === id);
      if (!order) return;
      const nextIndex = STATUS_FLOW.indexOf(order.status) + 1;
      if (nextIndex >= STATUS_FLOW.length) return;
      const nextStatus = STATUS_FLOW[nextIndex];
      const fromStatus = order.status;
      const now = new Date().toISOString();

      // Optimistic update
      setOrders((prev) =>
        prev.map((o) =>
          o.id === id
            ? {
                ...o,
                status: nextStatus,
                updated_by: adminName,
                updated_at: now,
                updated_by_type: "admin",
              }
            : o,
        ),
      );

      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          status: nextStatus,
          updated_by: adminName,
          updated_at: now,
          updated_by_type: "admin",
        })
        .eq("id", id);

      if (updateErr) {
        // Rollback optimistic update
        setOrders((prev) =>
          prev.map((o) => (o.id === id ? { ...o, status: fromStatus } : o)),
        );
        return;
      }

      await supabase.from("order_events").insert({
        order_id: id,
        event_type: "status_changed",
        actor_type: "admin",
        actor_name: adminName, actor_id: adminId,
        from_status: fromStatus,
        to_status: nextStatus,
      });

      // Set undo data — expires after 5 seconds
      setUndoData({ orderId: id, fromStatus, toStatus: nextStatus });
      setTimeout(() => setUndoData(null), 5000);
    },
    [supabase, orders, adminId, adminName],
  );

  // Admin sets the delivery fee for a delivery order
  const setDeliveryFee = useCallback(
    async (id: string, fee: number) => {
      if (!supabase) return;
      const order = orders.find((o) => o.id === id);
      if (!order) return;

      // Recalculate total: subtotal + desechables + new delivery fee
      const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
      const desechables = isDeliveryTable(order.table_number) ? itemCount * DESECHABLES_PER_DISH : 0;
      const subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
      const newTotal = subtotal + desechables + fee;

      // Optimistic update
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, delivery_fee: fee, total: newTotal } : o)),
      );

      const { error } = await supabase
        .from("orders")
        .update({ delivery_fee: fee, total: newTotal })
        .eq("id", id);

      if (error) {
        // Rollback
        setOrders((prev) =>
          prev.map((o) => (o.id === id ? { ...o, delivery_fee: order.delivery_fee, total: order.total } : o)),
        );
      }
    },
    [supabase, orders],
  );

  const undoStatus = useCallback(async () => {
    if (!supabase || !undoData) return;
    const { orderId, fromStatus, toStatus } = undoData;
    const now = new Date().toISOString();

    // Optimistic revert
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: fromStatus, updated_at: now, updated_by: adminName, updated_by_type: "admin" }
          : o,
      ),
    );

    const { error: updateErr } = await supabase
      .from("orders")
      .update({ status: fromStatus, updated_by: adminName, updated_at: now, updated_by_type: "admin" })
      .eq("id", orderId);

    if (updateErr) {
      // Rollback the revert — go back to the new status
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: toStatus } : o)),
      );
      setUndoData(null);
      return;
    }

    await supabase.from("order_events").insert({
      order_id: orderId,
      event_type: "status_changed",
      actor_type: "admin",
      actor_name: adminName, actor_id: adminId,
      from_status: toStatus,
      to_status: fromStatus,
    });

    setUndoData(null);
  }, [supabase, undoData, adminId, adminName]);

  const printOrder = useCallback(
    async (id: string) => {
      if (!supabase || !navigator.onLine) return;
      await supabase.from("order_events").insert({
        order_id: id,
        event_type: "printed",
        actor_type: "admin",
        actor_name: adminName, actor_id: adminId,
        metadata: { printed_at: new Date().toISOString() },
      });
      window.print();
    },
    [supabase, adminId, adminName],
  );

  const selectedOrder = orders.find((o) => o.id === selectedId) ?? null;
  const displayError = configError ?? error;

  // Date filtering
  const filteredByDate = useMemo(() => {
    if (dateFilter === "all") return orders;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86_400_000);
    const target = dateFilter === "today" ? today : yesterday;
    const nextDay = new Date(target.getTime() + 86_400_000);
    return orders.filter((o) => {
      const created = new Date(o.created_at);
      return created >= target && created < nextDay;
    });
  }, [orders, dateFilter]);

  // Status + waiter filtering (applied on top of date filter)
  const filteredOrders = useMemo(() => {
    let result = filteredByDate;
    if (statusFilter) result = result.filter((o) => o.status === statusFilter);
    if (waiterFilter) result = result.filter((o) => o.waiter_name === waiterFilter);
    return result;
  }, [filteredByDate, statusFilter, waiterFilter]);

  // Unique waiter names from visible (date-filtered) orders
  const visibleWaiters = useMemo(() => {
    const names = new Set(filteredByDate.map((o) => o.waiter_name));
    return Array.from(names).sort();
  }, [filteredByDate]);

  if (displayError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg font-semibold text-red-400">{displayError}</p>
        <p className="text-sm text-stone-500">
          Verifica que las variables de entorno de Supabase estén configuradas y
          que el esquema SQL haya sido ejecutado.
        </p>
      </div>
    );
  }

  // AuthGuard handles redirect, but show loading while auth resolves
  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-stone-500">
        Cargando...
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-stone-500">
        Cargando pedidos...
      </div>
    );
  }

  const counts = {
    nueva: filteredByDate.filter((o) => o.status === "nueva").length,
    en_cocina: filteredByDate.filter((o) => o.status === "en_cocina").length,
    lista: filteredByDate.filter((o) => o.status === "lista").length,
    servida: filteredByDate.filter((o) => o.status === "servida").length,
  };

  const kpiCards: {
    status: OrderStatus;
    label: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    bg: string;
    hint: string;
  }[] = [
    {
      status: "nueva",
      label: "Nuevas",
      value: counts.nueva,
      icon: <Clock className="size-5" />,
      color: "text-red-400",
      bg: "bg-red-500/10",
      hint: "Esperando acción",
    },
    {
      status: "en_cocina",
      label: "En cocina",
      value: counts.en_cocina,
      icon: <ChefHat className="size-5" />,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      hint: "Preparándose",
    },
    {
      status: "lista",
      label: "Listas",
      value: counts.lista,
      icon: <CheckCircle2 className="size-5" />,
      color: "text-green-400",
      bg: "bg-green-500/10",
      hint: "Para servir",
    },
    {
      status: "servida",
      label: "Servidas",
      value: counts.servida,
      icon: <Utensils className="size-5" />,
      color: "text-stone-400",
      bg: "bg-stone-900",
      hint: "Completadas",
    },
  ];

  return (
    <div className="flex h-dvh flex-col bg-stone-950">
      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 bg-amber-500/15 px-6 py-2 text-sm text-amber-400">
          <WifiOff className="size-4" />
          Sin conexión — mostrando datos guardados. Recarga la página cuando vuelva la conexión.
        </div>
      )}

      {/* Undo banner — shows for 5s after a status change */}
      {undoData && (
        <div className="flex items-center justify-between bg-stone-800 px-6 py-2 text-sm text-stone-300">
          <span>
            Estado cambiado a <strong className="text-stone-100">{STATUS_LABELS[undoData.toStatus]}</strong>
          </span>
          <button
            onClick={undoStatus}
            className="font-medium text-yellow-500 hover:text-yellow-400 transition-colors"
          >
            Deshacer
          </button>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between bg-stone-900 px-6 py-3">
        <div className="flex items-center gap-3">
          <Image
            src="/icon-192.png"
            alt="Punto 5"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <div>
            <h1 className="text-base font-bold text-stone-100">Panel principal</h1>
            <p className="text-xs text-stone-500">
              {filteredByDate.length} pedidos · {waiters.length} meseros activos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ActiveWaiters waiters={waiters} />
          <button
            onClick={() => router.push("/dashboard/waiters")}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-500 transition-colors hover:bg-stone-800 hover:text-stone-300"
            title="Gestión de meseros"
          >
            <UserCog className="size-4" />
            <span className="hidden sm:inline">Meseros</span>
          </button>
          <button
            onClick={async () => {
              await signOut();
              router.replace("/login/admin");
            }}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-500 transition-colors hover:bg-stone-800 hover:text-stone-300"
            title="Cerrar sesión"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>

      {/* KPI row — click to filter by status */}
      <div className="flex gap-3 px-6 py-4">
        {kpiCards.map((kpi) => {
          const isActive = statusFilter === kpi.status;
          return (
            <button
              key={kpi.label}
              onClick={() => setStatusFilter(isActive ? null : kpi.status)}
              className={`flex flex-1 items-center gap-3.5 rounded-xl px-4 py-3 transition-all active:scale-[0.98] ${
                isActive
                  ? `ring-2 ring-inset ${kpi.color.replace("text-", "ring-")} bg-stone-800`
                  : "bg-stone-900 hover:bg-stone-800/60"
              }`}
            >
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${kpi.bg} ${kpi.color}`}>
                {kpi.icon}
              </div>
              <div className="min-w-0 text-left">
                <p className="text-2xl font-bold leading-none text-stone-100">
                  {kpi.value}
                </p>
                <p className="mt-1 text-xs text-stone-500">{kpi.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main 2-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — orders feed */}
        <div className="flex w-96 shrink-0 flex-col bg-stone-900/50">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                {statusFilter ? `Filtrado: ${STATUS_LABELS[statusFilter]}` : "Pedidos"}
              </h2>
              <span className="text-xs text-stone-400">{filteredOrders.length}</span>
            </div>
            {/* Date filter pills */}
            <div className="mt-2 flex items-center gap-1.5">
              <Calendar className="size-3.5 shrink-0 text-stone-600" />
              {(["today", "yesterday", "all"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDateFilter(d)}
                  className={`rounded-md px-2 py-1 text-xs transition-colors ${
                    dateFilter === d
                      ? "bg-stone-800 font-medium text-stone-200"
                      : "text-stone-500 hover:bg-stone-800/50 hover:text-stone-300"
                  }`}
                >
                  {d === "today" ? "Hoy" : d === "yesterday" ? "Ayer" : "Todos"}
                </button>
              ))}
            </div>
            {/* Waiter filter pills */}
            {visibleWaiters.length > 1 && (
              <div className="mt-2 flex items-center gap-1.5">
                <Users className="size-3.5 shrink-0 text-stone-600" />
                {visibleWaiters.map((name) => (
                  <button
                    key={name}
                    onClick={() => setWaiterFilter(waiterFilter === name ? null : name)}
                    className={`rounded-md px-2 py-1 text-xs transition-colors ${
                      waiterFilter === name
                        ? "bg-stone-800 font-medium text-stone-200"
                        : "text-stone-500 hover:bg-stone-800/50 hover:text-stone-300"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
            {(statusFilter || waiterFilter) && (
              <button
                onClick={() => { setStatusFilter(null); setWaiterFilter(null); }}
                className="mt-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-stone-500 transition-colors hover:text-stone-300"
              >
                <X className="size-3" />
                Limpiar filtros
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            <OrdersFeed
              orders={filteredOrders}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        </div>

        {/* Right — order detail */}
        <div className="flex-1 overflow-hidden bg-stone-950">
          <OrderDetail
            order={selectedOrder}
            events={events}
            onAdvanceStatus={advanceStatus}
            onPrint={printOrder}
            onSetDeliveryFee={setDeliveryFee}
            disabled={!isOnline}
          />
        </div>
      </div>
    </div>
  );
}
