"use client";

import { formatCOP, formatTime, timeAgo } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList, Clock, ChefHat, CheckCircle2, Utensils } from "lucide-react";

const statusConfig: Record<OrderStatus, { icon: React.ReactNode; ring: string; label: string }> = {
  nueva: { icon: <Clock className="size-5" />, ring: "bg-red-500", label: "Nueva" },
  en_cocina: { icon: <ChefHat className="size-5" />, ring: "bg-amber-500", label: "En cocina" },
  lista: { icon: <CheckCircle2 className="size-5" />, ring: "bg-green-500", label: "Lista" },
  servida: { icon: <Utensils className="size-5" />, ring: "bg-stone-600", label: "Servida" },
};

/** Waiter's order history — flat list of order cards with status timeline. */
export function WaiterOrders({
  orders,
  waiterName,
}: {
  orders: Order[];
  waiterName: string;
}) {
  const myOrders = orders
    .filter((o) => o.waiter_name === waiterName)
    .sort((a, b) => {
      const aActive = a.status !== "servida" ? 0 : 1;
      const bActive = b.status !== "servida" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  if (myOrders.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="size-7" />}
        title="No tienes pedidos aún"
        description="Los pedidos que envíes aparecerán aquí"
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-stone-950">
      <div className="mx-auto max-w-3xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-300">
            {myOrders.filter((o) => o.status !== "servida").length} activos ·{" "}
            {myOrders.filter((o) => o.status === "servida").length} completados
          </h2>
        </div>

        <ul className="space-y-3">
          {myOrders.map((order) => {
            const config = statusConfig[order.status];
            const isActive = order.status !== "servida";

            return (
              <li
                key={order.id}
                className={
                  isActive
                    ? "overflow-hidden rounded-2xl border border-white/10 bg-stone-900"
                    : "overflow-hidden rounded-2xl border border-white/5 bg-stone-900/50"
                }
              >
                {/* Top row — table + status + time */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-stone-950 text-base font-bold text-stone-200">
                      {order.table_number}
                    </span>
                    <div>
                      <p className="text-base font-semibold text-stone-100">
                        Mesa {order.table_number}
                      </p>
                      <p className="text-sm text-stone-500">
                        {formatTime(order.created_at)} · {timeAgo(order.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`flex size-2.5 rounded-full ${config.ring}`} />
                    <span className={
                      isActive ? "text-sm font-medium text-stone-300" : "text-sm text-stone-500"
                    }>
                      {config.label}
                    </span>
                  </div>
                </div>

                {/* Items — flat list, no category nesting */}
                <div className="border-t border-white/5 px-5 py-4">
                  <ul className="space-y-2">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2.5 text-stone-300">
                          <span className="font-bold text-stone-400 tabular-nums">
                            {item.quantity}x
                          </span>
                          {item.dish_name}
                        </span>
                        <span className="text-stone-500">
                          {formatCOP(item.price * item.quantity)}
                        </span>
                      </li>
                    ))}
                    {order.items.some((i) => i.notes) && (
                      <li className="pt-1.5">
                        {order.items.filter((i) => i.notes).map((item) => (
                          <p key={item.id} className="text-sm text-amber-400/80">
                            → {item.dish_name}: {item.notes}
                          </p>
                        ))}
                      </li>
                    )}
                  </ul>
                </div>

                {/* Bottom — total */}
                <div className="flex items-center justify-between border-t border-white/5 px-5 py-3.5">
                  <span className="text-sm text-stone-500">Total</span>
                  <span className={isActive ? "text-lg font-bold text-yellow-500" : "text-lg font-bold text-stone-400"}>
                    {formatCOP(order.total)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
