"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { ActiveWaiter, Order, OrderEvent, OrderStatus } from "@/lib/types";
import { OrdersFeed } from "./orders-feed";
import { ActiveWaiters } from "./active-waiters";
import { OrderDetail } from "./order-detail";
import { Clock, ChefHat, CheckCircle2, Utensils, TrendingUp } from "lucide-react";

const STATUS_FLOW: OrderStatus[] = ["nueva", "en_cocina", "lista", "servida"];

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
        (payload) => {
          const updated = payload.new as Order;
          setOrders((prev) =>
            prev.map((o) =>
              o.id === updated.id ? { ...o, ...updated, items: o.items } : o,
            ),
          );
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

    const STALE_MS = 30_000; // waiter must heartbeat within 30s

    const syncWaiters = () => {
      const state = channel.presenceState<{ name: string; joinedAt: string }>();
      const now = Date.now();
      const list: ActiveWaiter[] = Object.values(state)
        .flat()
        .filter((p) => now - new Date(p.joinedAt).getTime() < STALE_MS)
        .map((p) => ({ name: p.name, joinedAt: p.joinedAt }));
      setWaiters(list);
    };

    channel
      .on("presence", { event: "sync" }, syncWaiters)
      .subscribe();

    // Periodic sweep — removes stale waiters even if no presence event fires
    const sweep = setInterval(syncWaiters, 10_000);

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

  if (displayError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
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
      <div className="flex min-h-screen items-center justify-center text-stone-500">
        Cargando pedidos...
      </div>
    );
  }

  const counts = {
    nueva: orders.filter((o) => o.status === "nueva").length,
    en_cocina: orders.filter((o) => o.status === "en_cocina").length,
    lista: orders.filter((o) => o.status === "lista").length,
    servida: orders.filter((o) => o.status === "servida").length,
  };
  const totalRevenue = orders
    .filter((o) => o.status === "servida")
    .reduce((sum, o) => sum + o.total, 0);

  const kpiCards = [
    {
      label: "Nuevas",
      value: counts.nueva,
      icon: <Clock className="size-5" />,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      hint: "Esperando acción",
    },
    {
      label: "En cocina",
      value: counts.en_cocina,
      icon: <ChefHat className="size-5" />,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      hint: "Preparándose",
    },
    {
      label: "Listas",
      value: counts.lista,
      icon: <CheckCircle2 className="size-5" />,
      color: "text-green-400",
      bg: "bg-green-500/10",
      hint: "Para servir",
    },
    {
      label: "Servidas",
      value: counts.servida,
      icon: <Utensils className="size-5" />,
      color: "text-stone-400",
      bg: "bg-stone-900",
      hint: "Completadas",
    },
  ];

  return (
    <div className="flex h-screen flex-col bg-stone-950">
      {/* Top bar */}
      <div className="flex items-center justify-between bg-stone-900 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-yellow-500 text-sm font-bold text-stone-950">
            P5
          </div>
          <div>
            <h1 className="text-base font-bold text-stone-100">Panel principal</h1>
            <p className="text-xs text-stone-500">
              {orders.length} pedidos · {waiters.length} meseros activos
            </p>
          </div>
        </div>
        <ActiveWaiters waiters={waiters} />
      </div>

      {/* KPI row */}
      <div className="flex gap-3 px-6 py-4">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className="flex flex-1 items-center gap-3.5 rounded-xl bg-stone-900 px-4 py-3"
          >
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${kpi.bg} ${kpi.color}`}>
              {kpi.icon}
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none text-stone-100">
                {kpi.value}
              </p>
              <p className="mt-1 text-xs text-stone-500">{kpi.label}</p>
            </div>
          </div>
        ))}

        {/* Revenue — highlighted */}
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
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Pedidos en vivo
            </h2>
            <span className="text-xs text-stone-400">{orders.length} total</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <OrdersFeed
              orders={orders}
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
