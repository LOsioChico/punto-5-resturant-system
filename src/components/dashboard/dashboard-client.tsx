"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { ActiveWaiter, Order, OrderEvent, OrderStatus } from "@/lib/types";
import { OrdersFeed } from "./orders-feed";
import { ActiveWaiters } from "./active-waiters";
import { OrderDetail } from "./order-detail";
import { Clock, ChefHat, CheckCircle2, Utensils, TrendingUp, Calendar, X } from "lucide-react";

const STATUS_FLOW: OrderStatus[] = ["nueva", "en_cocina", "lista", "servida"];

const STATUS_LABELS: Record<OrderStatus, string> = {
  nueva: "Nuevas",
  en_cocina: "En cocina",
  lista: "Listas",
  servida: "Servidas",
};

export function DashboardClient() {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const configError = !supabase
    ? "Faltan las variables de entorno de Supabase. Copia .env.example a .env.local y complétalas."
    : null;

  const [orders, setOrders] = useState<Order[]>([]);
  const [waiters, setWaiters] = useState<ActiveWaiter[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | null>(null);
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "all">("today");

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data: orderRows, error: orderErr } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (orderErr) {
        setError(orderErr.message);
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
      setLoading(false);
    })();
  }, [supabase]);

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
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel("waiters");

    const STALE_MS = 15_000; // waiter must heartbeat within 15s

    const syncWaiters = () => {
      const state = channel.presenceState<{ name: string; joinedAt: string }>();
      const now = Date.now();
      // Dedupe by name — keep the most recent heartbeat per waiter
      const byName = new Map<string, ActiveWaiter>();
      for (const p of Object.values(state).flat()) {
        if (now - new Date(p.joinedAt).getTime() >= STALE_MS) continue;
        const existing = byName.get(p.name);
        if (!existing || new Date(p.joinedAt) > new Date(existing.joinedAt)) {
          byName.set(p.name, { name: p.name, joinedAt: p.joinedAt });
        }
      }
      setWaiters(Array.from(byName.values()));
    };

    channel
      .on("presence", { event: "sync" }, syncWaiters)
      .subscribe();

    // Periodic sweep — removes stale waiters even if no presence event fires
    const sweep = setInterval(syncWaiters, 5_000);

    return () => {
      clearInterval(sweep);
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !selectedId) {
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
      if (!supabase) return;
      const order = orders.find((o) => o.id === id);
      if (!order) return;
      const nextIndex = STATUS_FLOW.indexOf(order.status) + 1;
      if (nextIndex >= STATUS_FLOW.length) return;
      const nextStatus = STATUS_FLOW[nextIndex];
      const fromStatus = order.status;

      setOrders((prev) =>
        prev.map((o) =>
          o.id === id
            ? {
                ...o,
                status: nextStatus,
                updated_by: "admin",
                updated_at: new Date().toISOString(),
                updated_by_type: "admin",
              }
            : o,
        ),
      );

      await supabase
        .from("orders")
        .update({
          status: nextStatus,
          updated_by: "admin",
          updated_at: new Date().toISOString(),
          updated_by_type: "admin",
        })
        .eq("id", id);

      await supabase.from("order_events").insert({
        order_id: id,
        event_type: "status_changed",
        actor_type: "admin",
        actor_name: "admin",
        from_status: fromStatus,
        to_status: nextStatus,
      });
    },
    [supabase, orders],
  );

  const printOrder = useCallback(
    async (id: string) => {
      if (!supabase) return;
      await supabase.from("order_events").insert({
        order_id: id,
        event_type: "printed",
        actor_type: "admin",
        actor_name: "admin",
        metadata: { printed_at: new Date().toISOString() },
      });
      window.print();
    },
    [supabase],
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

  // Status filtering (applied on top of date filter)
  const filteredOrders = useMemo(() => {
    if (!statusFilter) return filteredByDate;
    return filteredByDate.filter((o) => o.status === statusFilter);
  }, [filteredByDate, statusFilter]);

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
  const totalRevenue = filteredByDate
    .filter((o) => o.status === "servida")
    .reduce((sum, o) => sum + o.total, 0);

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
      {/* Top bar */}
      <div className="flex items-center justify-between bg-stone-900 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-yellow-500 text-sm font-bold text-stone-950">
            P5
          </div>
          <div>
            <h1 className="text-base font-bold text-stone-100">Panel principal</h1>
            <p className="text-xs text-stone-500">
              {filteredByDate.length} pedidos · {waiters.length} meseros activos
            </p>
          </div>
        </div>
        <ActiveWaiters waiters={waiters} />
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

        {/* Revenue — not clickable, just display */}
        {totalRevenue > 0 && (
          <div className="flex flex-1 items-center gap-3.5 rounded-xl bg-yellow-500/10 px-4 py-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-yellow-500/15 text-yellow-500">
              <TrendingUp className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none text-yellow-500">
                {new Intl.NumberFormat("es-CO", {
                  style: "currency",
                  currency: "COP",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(totalRevenue)}
              </p>
              <p className="mt-1 text-xs text-stone-500">Ventas del día</p>
            </div>
          </div>
        )}
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
              {statusFilter && (
                <button
                  onClick={() => setStatusFilter(null)}
                  className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-stone-500 transition-colors hover:text-stone-300"
                >
                  <X className="size-3" />
                  Limpiar
                </button>
              )}
            </div>
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
          />
        </div>
      </div>
    </div>
  );
}
