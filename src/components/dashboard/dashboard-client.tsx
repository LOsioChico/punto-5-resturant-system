"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { compareDesc } from "date-fns";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { signOut } from "@/lib/auth";
import type { ActiveWaiter, Order, OrderEvent, OrderStatus } from "@/lib/types";
import { needsItemReload } from "@/lib/realtime";
import { filterByDate, sortOrders, filterByTable, searchOrders, getVisibleTables } from "@/lib/dashboard/logic";
import { tableLabel } from "@/lib/utils";
import {
  advanceOrderStatus,
  undoOrderStatus,
  setOrderDeliveryFee,
  logPrintEvent,
  deleteOrder,
} from "@/lib/mutations";
import { OrdersFeed } from "./orders-feed";
import { ActiveWaiters } from "./active-waiters";
import { OrderDetail } from "./order-detail";
import { Clock, ChefHat, CheckCircle2, Utensils, Calendar, X, Users, WifiOff, LogOut, UserCog, ChevronDown, UserCircle, Search, Table2, Trash2, ArrowLeft } from "lucide-react";
import { cacheOrders, loadCachedOrders } from "@/lib/offline/db";

const STATUS_LABELS: Record<OrderStatus, string> = {
  nueva: "Nuevas",
  en_cocina: "En cocina",
  servida: "Servidas",
  finalizada: "Finalizadas",
  adicional: "Adicionales",
};

export function DashboardClient() {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const adminName = user?.user_metadata?.full_name ?? user?.email ?? "admin";
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
  const [tableFilter, setTableFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "all" | { specific: string }>("today");
  const [isOnline, setIsOnline] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [waiterFilterOpen, setWaiterFilterOpen] = useState(false);
  const [tableFilterOpen, setTableFilterOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [undoData, setUndoData] = useState<{
    orderId: string;
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
  } | null>(null);

  const loadOrders = useCallback(async (includeDeleted: boolean) => {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    // If offline, load from cache (only for active orders)
    if (!navigator.onLine && !includeDeleted) {
      const cached = await loadCachedOrders<Order>();
      if (cached && cached.length > 0) {
        setOrders(cached);
      }
      setLoading(false);
      return;
    }

    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (includeDeleted) {
      query = query.not("deleted_at", "is", null);
    } else {
      query = query.is("deleted_at", null);
    }

    const { data: orderRows, error: orderErr } = await query;

    if (orderErr) {
      // Network error — try cache (only for active orders)
      if (orderErr.message.includes("Failed to fetch") || orderErr.message.includes("network")) {
        if (!includeDeleted) {
          const cached = await loadCachedOrders<Order>();
          if (cached) setOrders(cached);
        }
      } else {
        setError(orderErr.message);
      }
      setLoading(false);
      return;
    }

    if (!orderRows || orderRows.length === 0) {
      setOrders([]);
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
    if (!includeDeleted) {
      cacheOrders(ordersWithItems); // persist for offline use
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch, setState happens after await
    loadOrders(showDeleted);
  }, [loadOrders, showDeleted]);

  // Keep IndexedDB cache in sync with orders state
  useEffect(() => {
    if (orders.length > 0) {
      cacheOrders(orders);
    }
  }, [orders]);

  useEffect(() => {
    if (!supabase) return;
    // Skip realtime when viewing deleted orders — the deleted view is a
    // static snapshot, not a live feed.
    if (showDeleted) return;
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

          // Soft-deleted order — remove from list
          if (updated.deleted_at) {
            setOrders((prev) => prev.filter((o) => o.id !== updated.id));
            return;
          }

          // Reload items if a waiter modified the order (items may have changed)
          // or if the status changed to "adicional" (additional items were added)
          if (needsItemReload(updated)) {
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
  }, [supabase, adminId, adminName, showDeleted]);

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
        if (!existing || compareDesc(new Date(existing.joinedAt), new Date(p.joinedAt)) > 0) {
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

      const result = await advanceOrderStatus(supabase, {
        orderId: id,
        currentStatus: order.status,
        actor: { type: "admin", name: adminName, id: adminId },
      });

      if ("error" in result) {
        return;
      }

      const { fromStatus, toStatus, now } = result.data;

      // Optimistic update
      setOrders((prev) =>
        prev.map((o) =>
          o.id === id
            ? {
                ...o,
                status: toStatus,
                updated_by: adminName,
                updated_at: now,
                updated_by_type: "admin",
              }
            : o,
        ),
      );

      // Set undo data — expires after 5 seconds
      setUndoData({ orderId: id, fromStatus, toStatus });
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

      const result = await setOrderDeliveryFee(supabase, {
        orderId: id,
        fee,
        order,
        actor: { type: "admin", name: adminName, id: adminId },
      });

      if ("error" in result) {
        return;
      }

      // Optimistic update
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, delivery_fee: fee, total: result.data.total } : o)),
      );
    },
    [supabase, orders, adminId, adminName],
  );

  const undoStatus = useCallback(async () => {
    if (!supabase || !undoData) return;
    const { orderId, fromStatus, toStatus } = undoData;

    const result = await undoOrderStatus(supabase, {
      orderId,
      fromStatus,
      toStatus,
      actor: { type: "admin", name: adminName, id: adminId },
    });

    if ("error" in result) {
      setUndoData(null);
      return;
    }

    // Optimistic revert
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: fromStatus, updated_at: result.data.now, updated_by: adminName, updated_by_type: "admin" }
          : o,
      ),
    );

    setUndoData(null);
  }, [supabase, undoData, adminId, adminName]);

  const printOrder = useCallback(
    async (id: string, version?: { type: "full" | "additional"; round?: number }) => {
      if (!supabase || !navigator.onLine) return;
      await logPrintEvent(supabase, {
        orderId: id,
        version,
        actor: { type: "admin", name: adminName, id: adminId },
      });
      window.print();
    },
    [supabase, adminId, adminName],
  );

  // Admin soft-deletes an order
  const removeOrder = useCallback(
    async (id: string) => {
      if (!supabase) return;
      const result = await deleteOrder(supabase, {
        orderId: id,
        actor: { type: "admin", name: adminName, id: adminId },
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSelectedId(null);
    },
    [supabase, adminId, adminName],
  );

  const selectedOrder = orders.find((o) => o.id === selectedId) ?? null;
  const displayError = configError ?? error;

  // Date filtering (timezone-aware via filterByDate from logic.ts)
  const filteredByDate = useMemo(() => {
    return filterByDate(orders, dateFilter);
  }, [orders, dateFilter]);

  // Status + waiter + table + search filtering (applied on top of date filter)
  const filteredOrders = useMemo(() => {
    let result = filteredByDate;
    if (statusFilter) result = result.filter((o) => o.status === statusFilter);
    if (waiterFilter) result = result.filter((o) => o.waiter_name === waiterFilter);
    result = filterByTable(result, tableFilter);
    result = searchOrders(result, searchQuery);
    return sortOrders(result);
  }, [filteredByDate, statusFilter, waiterFilter, tableFilter, searchQuery]);

  // Unique waiter names from visible (date-filtered) orders
  const visibleWaiters = useMemo(() => {
    const names = new Set(filteredByDate.map((o) => o.waiter_name));
    return Array.from(names).sort();
  }, [filteredByDate]);

  // Unique table numbers from visible (date-filtered) orders
  const visibleTables = useMemo(() => {
    return getVisibleTables(filteredByDate);
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
    servida: filteredByDate.filter((o) => o.status === "servida").length,
    finalizada: filteredByDate.filter((o) => o.status === "finalizada").length,
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
      status: "servida",
      label: "Servidas",
      value: counts.servida,
      icon: <CheckCircle2 className="size-5" />,
      color: "text-green-400",
      bg: "bg-green-500/10",
      hint: "En la mesa",
    },
    {
      status: "finalizada",
      label: "Finalizadas",
      value: counts.finalizada,
      icon: <Utensils className="size-5" />,
      color: "text-stone-400",
      bg: "bg-stone-900",
      hint: "Pago confirmado",
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

      {/* Deleted orders banner */}
      {showDeleted && (
        <div className="flex items-center justify-between bg-red-500/10 px-6 py-2 text-sm text-red-400">
          <span className="flex items-center gap-2">
            <Trash2 className="size-4" />
            Viendo pedidos eliminados — lectura únicamente
          </span>
          <button
            onClick={() => {
              setShowDeleted(false);
              setSelectedId(null);
            }}
            className="flex items-center gap-1.5 font-medium text-stone-300 transition-colors hover:text-stone-100"
          >
            <ArrowLeft className="size-4" />
            Volver a pedidos activos
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
            <h1 className="text-base font-bold text-stone-100">
              {showDeleted ? "Pedidos eliminados" : "Panel principal"}
            </h1>
            <p className="text-xs text-stone-500">
              {showDeleted
                ? `${filteredByDate.length} pedidos eliminados`
                : `${filteredByDate.length} pedidos · ${waiters.length} meseros activos`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ActiveWaiters waiters={waiters} />
          {/* Admin menu dropdown */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-300 transition-colors hover:bg-stone-800 hover:text-stone-100"
            >
              <UserCircle className="size-5 text-stone-500" />
              <span className="hidden max-w-[160px] truncate sm:inline">{adminName}</span>
              <ChevronDown className={`size-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-lg border border-white/10 bg-stone-950 shadow-xl">
                  {/* Manage waiters */}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      router.push("/dashboard/waiters");
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-stone-900"
                  >
                    <div className="flex size-10 items-center justify-center rounded-lg bg-stone-800 text-stone-500">
                      <UserCog className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-stone-200">Gestión de meseros</p>
                      <p className="text-xs text-stone-500">Crear, activar, desactivar</p>
                    </div>
                  </button>
                  {/* View deleted orders */}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setSelectedId(null);
                      setShowDeleted(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-stone-900"
                  >
                    <div className="flex size-10 items-center justify-center rounded-lg bg-stone-800 text-stone-500">
                      <Trash2 className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-stone-200">Pedidos eliminados</p>
                      <p className="text-xs text-stone-500">Ver historial de pedidos borrados</p>
                    </div>
                  </button>
                  {/* Divider */}
                  <div className="h-px bg-white/5" />
                  {/* Sign out */}
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
                    <p className="text-sm text-stone-300">Cerrar sesión</p>
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
                Tendrás que volver a iniciar sesión para acceder al panel.
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
                  await signOut();
                  router.replace("/login/admin");
                }}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-400"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

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
            {/* Search box */}
            <div className="mt-2 flex items-center gap-1.5">
              <Search className="size-3.5 shrink-0 text-stone-600" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por plato, mesa o mesero..."
                className="w-full rounded-md bg-stone-900 px-2 py-1 text-xs text-stone-200 placeholder:text-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-700"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="shrink-0 text-stone-600 transition-colors hover:text-stone-400"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
            {/* Date filter — quick presets + date picker */}
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
              <input
                type="date"
                value={typeof dateFilter === "object" ? dateFilter.specific : ""}
                onChange={(e) => {
                  if (e.target.value) {
                    setDateFilter({ specific: e.target.value });
                  }
                }}
                className="ml-auto rounded-md bg-stone-900 px-1.5 py-1 text-xs text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-700 [color-scheme:dark]"
              />
            </div>
            {/* Waiter + Table filter dropdowns */}
            <div className="mt-2 flex items-center gap-1.5">
              {visibleWaiters.length > 1 && (
                <div className="relative flex-1">
                  <button
                    onClick={() => setWaiterFilterOpen(!waiterFilterOpen)}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-xs transition-colors ${
                      waiterFilter
                        ? "bg-stone-800 font-medium text-stone-200"
                        : "text-stone-500 hover:bg-stone-800/50 hover:text-stone-300"
                    }`}
                  >
                    <span className="flex items-center gap-1 truncate">
                      <Users className="size-3 shrink-0" />
                      <span className="truncate">{waiterFilter ?? "Mesero"}</span>
                    </span>
                    <ChevronDown className={`size-3 shrink-0 transition-transform ${waiterFilterOpen ? "rotate-180" : ""}`} />
                  </button>
                  {waiterFilterOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setWaiterFilterOpen(false)} />
                      <div className="absolute left-0 top-7 z-50 max-h-60 w-full overflow-y-auto rounded-lg border border-white/10 bg-stone-950 py-1 shadow-xl">
                        <button
                          onClick={() => { setWaiterFilter(null); setWaiterFilterOpen(false); }}
                          className={`flex w-full items-center px-3 py-2 text-left text-xs transition-colors hover:bg-stone-900 ${
                            !waiterFilter ? "font-medium text-stone-200" : "text-stone-500"
                          }`}
                        >
                          Todos los meseros
                        </button>
                        {visibleWaiters.map((name) => (
                          <button
                            key={name}
                            onClick={() => { setWaiterFilter(waiterFilter === name ? null : name); setWaiterFilterOpen(false); }}
                            className={`flex w-full items-center px-3 py-2 text-left text-xs transition-colors hover:bg-stone-900 ${
                              waiterFilter === name ? "font-medium text-stone-200" : "text-stone-500"
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              {visibleTables.length > 1 && (
                <div className="relative flex-1">
                  <button
                    onClick={() => setTableFilterOpen(!tableFilterOpen)}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-xs transition-colors ${
                      tableFilter !== null
                        ? "bg-stone-800 font-medium text-stone-200"
                        : "text-stone-500 hover:bg-stone-800/50 hover:text-stone-300"
                    }`}
                  >
                    <span className="flex items-center gap-1 truncate">
                      <Table2 className="size-3 shrink-0" />
                      <span className="truncate">
                        {tableFilter !== null ? tableLabel(tableFilter) : "Mesa"}
                      </span>
                    </span>
                    <ChevronDown className={`size-3 shrink-0 transition-transform ${tableFilterOpen ? "rotate-180" : ""}`} />
                  </button>
                  {tableFilterOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setTableFilterOpen(false)} />
                      <div className="absolute left-0 top-7 z-50 max-h-60 w-full overflow-y-auto rounded-lg border border-white/10 bg-stone-950 py-1 shadow-xl">
                        <button
                          onClick={() => { setTableFilter(null); setTableFilterOpen(false); }}
                          className={`flex w-full items-center px-3 py-2 text-left text-xs transition-colors hover:bg-stone-900 ${
                            tableFilter === null ? "font-medium text-stone-200" : "text-stone-500"
                          }`}
                        >
                          Todas las mesas
                        </button>
                        {visibleTables.map((table) => (
                          <button
                            key={table}
                            onClick={() => { setTableFilter(tableFilter === table ? null : table); setTableFilterOpen(false); }}
                            className={`flex w-full items-center px-3 py-2 text-left text-xs transition-colors hover:bg-stone-900 ${
                              tableFilter === table ? "font-medium text-stone-200" : "text-stone-500"
                            }`}
                          >
                            {tableLabel(table)}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {(statusFilter || waiterFilter || tableFilter !== null || searchQuery) && (
              <button
                onClick={() => { setStatusFilter(null); setWaiterFilter(null); setTableFilter(null); setSearchQuery(""); }}
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
            onDelete={removeOrder}
            disabled={!isOnline || showDeleted}
          />
        </div>
      </div>
    </div>
  );
}
