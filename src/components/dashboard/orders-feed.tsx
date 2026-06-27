"use client";

import { cn, timeAgo, formatTime } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";
import { Clock } from "lucide-react";

const statusDot: Record<OrderStatus, string> = {
  nueva: "bg-red-500",
  en_cocina: "bg-amber-500",
  lista: "bg-green-500",
  servida: "bg-stone-600",
};

const statusLabel: Record<OrderStatus, string> = {
  nueva: "Nueva",
  en_cocina: "En cocina",
  lista: "Lista",
  servida: "Servida",
};

/** Left column — live feed of incoming orders. */
export function OrdersFeed({
  orders,
  selectedId,
  onSelect,
}: {
  orders: Order[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<Clock className="size-7" />}
        title="No hay pedidos"
        description="Los pedidos del POS aparecerán aquí"
      />
    );
  }

  return (
    <ul className="space-y-1.5 p-3">
      {orders.map((order) => {
        const isSelected = selectedId === order.id;
        const isNew = order.status === "nueva";

        return (
          <li key={order.id}>
            <button
              onClick={() => onSelect(order.id)}
              className={cn(
                "w-full rounded-lg px-3.5 py-3 text-left transition-all active:scale-[0.99]",
                isSelected
                  ? "bg-stone-800 ring-1 ring-inset ring-yellow-500/40"
                  : isNew
                    ? "bg-red-500/5 ring-1 ring-inset ring-red-500/20 hover:bg-red-500/10"
                    : "bg-stone-900 hover:bg-stone-800/60",
              )}
            >
              {/* Row 1 — table + time */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-stone-100">
                    Mesa {order.table_number}
                  </span>
                  {isNew && (
                    <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-400">
                      Nuevo
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-stone-400">
                    {timeAgo(order.created_at)}
                  </span>
                  <span className="text-[10px] text-stone-600">
                    {formatTime(order.created_at)}
                  </span>
                </div>
              </div>

              {/* Row 2 — waiter + status */}
              <div className="mt-1.5 flex items-center justify-between">
                <span className="truncate text-xs text-stone-500">
                  {order.waiter_name}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 pl-2 text-xs text-stone-500">
                  <span className={cn("size-1.5 rounded-full", statusDot[order.status])} />
                  {statusLabel[order.status]}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
