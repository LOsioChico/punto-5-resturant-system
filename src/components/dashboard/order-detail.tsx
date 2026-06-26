"use client";

import { formatCOP, formatTime, timeAgo } from "@/lib/utils";
import type { Order, OrderEvent, OrderStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { CommandPreview } from "./command-preview";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ChefHat,
  CheckCircle2,
  Clock,
  History,
  Printer,
  Utensils,
  User,
} from "lucide-react";

const STATUS_FLOW: OrderStatus[] = ["nueva", "en_cocina", "lista", "servida"];

const NEXT_ACTION: Record<OrderStatus, { label: string; icon: React.ReactNode }> = {
  nueva: { label: "Enviar a cocina", icon: <ChefHat className="size-4" /> },
  en_cocina: { label: "Marcar como lista", icon: <CheckCircle2 className="size-4" /> },
  lista: { label: "Marcar como servida", icon: <Utensils className="size-4" /> },
  servida: { label: "", icon: null },
};

const EVENT_LABELS: Record<string, string> = {
  created: "Pedido creado",
  status_changed: "Cambio de estado",
  printed: "Impresión de comanda",
  updated: "Actualización",
  cancelled: "Cancelación",
};

const STATUS_LABELS: Record<string, string> = {
  nueva: "Nueva",
  en_cocina: "En cocina",
  lista: "Lista",
  servida: "Servida",
};

const STATUS_COLORS: Record<OrderStatus, { dot: string; text: string; bg: string }> = {
  nueva: { dot: "bg-red-500", text: "text-red-400", bg: "bg-red-500/10" },
  en_cocina: { dot: "bg-amber-500", text: "text-amber-400", bg: "bg-amber-500/10" },
  lista: { dot: "bg-green-500", text: "text-green-400", bg: "bg-green-500/10" },
  servida: { dot: "bg-stone-600", text: "text-stone-400", bg: "bg-stone-800" },
};

/** Right panel — order detail. */
export function OrderDetail({
  order,
  events,
  onAdvanceStatus,
  onPrint,
}: {
  order: Order | null;
  events: OrderEvent[];
  onAdvanceStatus: (id: string) => void;
  onPrint: (id: string) => void;
}) {
  if (!order) {
    return (
      <EmptyState
        icon={<Utensils className="size-7" />}
        title="Selecciona un pedido"
        description="Elige un pedido de la lista para ver su detalle"
      />
    );
  }

  const currentIndex = STATUS_FLOW.indexOf(order.status);
  const nextStatus = STATUS_FLOW[currentIndex + 1];
  const action = NEXT_ACTION[order.status];
  const printCount = events.filter((e) => e.event_type === "printed").length;
  const colors = STATUS_COLORS[order.status];

  return (
    <div className="flex h-full flex-col">
      {/* Header — table + status + progress */}
      <div className="bg-stone-900/50 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-stone-800 text-xl font-bold text-stone-100">
              {order.table_number}
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-100">
                Mesa {order.table_number}
              </h2>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-stone-500">
                <User className="size-3" />
                <span>{order.waiter_name}</span>
                <span className="text-stone-700">·</span>
                <Clock className="size-3" />
                <span>{formatTime(order.created_at)}</span>
                <span className="text-stone-700">·</span>
                <span>{timeAgo(order.created_at)}</span>
              </div>
            </div>
          </div>
          <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${colors.bg}`}>
            <span className={`size-2 rounded-full ${colors.dot}`} />
            <span className={`text-sm font-medium ${colors.text}`}>
              {STATUS_LABELS[order.status]}
            </span>
          </div>
        </div>

        {/* Progress — horizontal steps */}
        <div className="mt-5 flex items-center">
          {STATUS_FLOW.map((status, idx) => {
            const isDone = idx <= currentIndex;
            const isCurrent = idx === currentIndex;
            const stepColors = STATUS_COLORS[status];

            return (
              <div key={status} className="flex flex-1 items-center last:flex-none">
                <div className="flex items-center gap-2">
                  <div
                    className={
                      isDone
                        ? `flex size-7 items-center justify-center rounded-full ${stepColors.bg} ${stepColors.text}`
                        : "flex size-7 items-center justify-center rounded-full bg-stone-800 text-stone-500"
                    }
                  >
                    {idx === 0 && <Clock className="size-3.5" />}
                    {idx === 1 && <ChefHat className="size-3.5" />}
                    {idx === 2 && <CheckCircle2 className="size-3.5" />}
                    {idx === 3 && <Utensils className="size-3.5" />}
                  </div>
                  <span className={
                    isCurrent ? "text-xs font-medium text-stone-200" : isDone ? "text-xs text-stone-500" : "text-xs text-stone-600"
                  }>
                    {STATUS_LABELS[status]}
                  </span>
                </div>
                {idx < STATUS_FLOW.length - 1 && (
                  <div className={
                    isDone && !isCurrent ? "mx-2 h-px flex-1 bg-stone-700" : "mx-2 h-px flex-1 bg-stone-800"
                  } />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Items */}
        <div className="mb-6">
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Items del pedido
          </h3>
          <ul className="overflow-hidden rounded-xl bg-stone-900">
            {order.items.map((item, idx) => (
              <li
                key={item.id}
                className={idx > 0 ? "flex items-center gap-3 p-3.5 border-t border-stone-800/60" : "flex items-center gap-3 p-3.5"}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-800 text-sm font-bold text-stone-200 tabular-nums">
                  {item.quantity}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-sm text-stone-100">
                    {item.dish_name}
                  </span>
                  {item.notes && (
                    <span className="block truncate text-xs text-amber-400/80">
                      → {item.notes}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium text-stone-400">
                  {formatCOP(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between px-1">
            <span className="text-sm text-stone-500">Total</span>
            <span className="text-xl font-bold text-yellow-500">
              {formatCOP(order.total)}
            </span>
          </div>
        </div>

        {/* Command preview */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Comanda
            </h3>
            <div className="flex items-center gap-2">
              {printCount > 0 && (
                <span className="text-xs text-stone-400">
                  {printCount} {printCount === 1 ? "impresión" : "impresiones"}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPrint(order.id)}
              >
                <Printer className="size-3.5" />
                Imprimir
              </Button>
            </div>
          </div>
          <CommandPreview order={order} />
        </div>

        {/* Audit trail */}
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            <History className="size-3.5" />
            Historial ({events.length})
          </h3>
          {events.length === 0 ? (
            <p className="rounded-lg bg-stone-900 p-4 text-sm text-stone-500">
              Sin eventos registrados
            </p>
          ) : (
            <ol className="space-y-0">
              {events.map((event, idx) => (
                <li key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={
                        event.event_type === "created"
                          ? "size-2.5 shrink-0 rounded-full bg-yellow-500 ring-4 ring-yellow-500/10"
                          : event.event_type === "printed"
                            ? "size-2.5 shrink-0 rounded-full bg-blue-400 ring-4 ring-blue-400/10"
                            : "size-2.5 shrink-0 rounded-full bg-stone-500 ring-4 ring-stone-500/10"
                      }
                    />
                    {idx < events.length - 1 && (
                      <span className="w-px flex-1 bg-stone-800" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-stone-200">
                        {EVENT_LABELS[event.event_type] ?? event.event_type}
                      </span>
                      <span className="shrink-0 text-xs text-stone-500">
                        {formatTime(event.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">
                      por <span className="text-stone-400">{event.actor_name}</span>
                      {event.from_status && event.to_status && (
                        <>
                          {" · "}
                          {STATUS_LABELS[event.from_status] ?? event.from_status}
                          {" → "}
                          {STATUS_LABELS[event.to_status] ?? event.to_status}
                        </>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Action bar */}
      {nextStatus && action.label && (
        <div className="bg-stone-900/50 p-4">
          <Button
            className="w-full transition-all active:scale-[0.98]"
            size="lg"
            onClick={() => onAdvanceStatus(order.id)}
          >
            {action.icon}
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
