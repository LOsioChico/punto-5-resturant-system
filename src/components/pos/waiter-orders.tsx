"use client";

import { formatCOP, formatTime, timeAgo, tableLabel, tableShortName, isDeliveryTable, splitPerUnit } from "@/lib/utils";
import { compareDesc } from "date-fns";
import { allNotesSame } from "@/lib/pos/logic";
import { advanceActionLabel, statusLabel } from "@/lib/dashboard/logic";
import type { Order, OrderStatus } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList, Clock, ChefHat, CheckCircle2, Utensils, PencilLine, Bike, Plus, PlusCircle } from "lucide-react";

const statusConfig: Record<OrderStatus, { icon: React.ReactNode; ring: string; label: string }> = {
  nueva: { icon: <Clock className="size-5" />, ring: "bg-red-500", label: "Nueva" },
  en_cocina: { icon: <ChefHat className="size-5" />, ring: "bg-amber-500", label: "En cocina" },
  servida: { icon: <CheckCircle2 className="size-5" />, ring: "bg-green-500", label: "Servida" },
  finalizada: { icon: <Utensils className="size-5" />, ring: "bg-stone-600", label: "Finalizada" },
  adicional: { icon: <PlusCircle className="size-5" />, ring: "bg-blue-500", label: "Adicional" },
};

/** Waiter's order history — flat list of order cards with status timeline. */
export function WaiterOrders({
  orders,
  waiterName,
  onEdit,
  onAddAdditional,
  onAdvanceStatus,
}: {
  orders: Order[];
  waiterName: string;
  onEdit: (order: Order) => void;
  onAddAdditional: (order: Order) => void;
  onAdvanceStatus: (order: Order) => void;
}) {
  const myOrders = orders
    .filter((o) => o.waiter_name === waiterName)
    .sort((a, b) => {
      const aActive = a.status !== "finalizada" ? 0 : 1;
      const bActive = b.status !== "finalizada" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return compareDesc(new Date(a.created_at), new Date(b.created_at));
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
            {myOrders.filter((o) => o.status !== "finalizada").length} activos ·{" "}
            {myOrders.filter((o) => o.status === "finalizada").length} completados
          </h2>
        </div>

        <ul className="space-y-3">
          {myOrders.map((order) => {
            const config = statusConfig[order.status];
            const isActive = order.status !== "finalizada";
            const canEdit = order.status === "nueva" || order.status === "en_cocina";
            const canAdvance = order.status === "en_cocina" || order.status === "adicional";
            const canAddAdditional = order.status === "servida" || order.status === "finalizada" || order.status === "adicional";
            const wasModified = order.updated_by_type === "waiter" && order.updated_at !== null && order.status !== "adicional";
            const isDelivery = isDeliveryTable(order.table_number);
            const hasAdditionals = order.items.some((i) => i.is_additional);

            return (
              <li
                key={order.id}
                className={
                  isActive
                    ? isDelivery
                      ? "overflow-hidden rounded-xl border border-yellow-500/20 bg-stone-900"
                      : "overflow-hidden rounded-xl border border-white/10 bg-stone-900"
                    : "overflow-hidden rounded-xl border border-white/5 bg-stone-900/50"
                }
              >
                {/* Top row — table + status + time + edit */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className={
                      isDelivery
                        ? "flex size-11 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-400"
                        : "flex size-11 items-center justify-center rounded-lg bg-stone-950 text-base font-bold text-stone-200"
                    }>
                      {isDelivery ? <Bike className="size-5" /> : tableShortName(order.table_number)}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold text-stone-100">
                          {tableLabel(order.table_number)}
                        </p>
                        {order.order_number && (
                          <span className="text-xs font-medium text-stone-600">
                            #{String(order.order_number).padStart(3, "0")}
                          </span>
                        )}
                        {wasModified && (
                          <span className="flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
                            <PencilLine className="size-2.5" />
                            Modificado
                          </span>
                        )}
                        {hasAdditionals && (
                          <span className="flex items-center gap-1 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-400">
                            <PlusCircle className="size-2.5" />
                            Adicional
                          </span>
                        )}
                      </div>
                      {order.delivery_name ? (
                        <p className="text-sm font-medium text-yellow-400">
                          Para: {order.delivery_name}
                        </p>
                      ) : (
                        <p className="text-sm text-stone-500">
                          {formatTime(order.created_at)} · {timeAgo(order.created_at)}
                        </p>
                      )}
                      {order.delivery_name && (
                        <p className="text-xs text-stone-500">
                          {formatTime(order.created_at)} · {timeAgo(order.created_at)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`flex size-2.5 rounded-full ${config.ring}`} />
                    <span className={
                      isActive ? "text-sm font-medium text-stone-300" : "text-sm text-stone-500"
                    }>
                      {statusLabel(order.status, isDeliveryTable(order.table_number))}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => onEdit(order)}
                        className="ml-1 flex size-8 items-center justify-center rounded-lg bg-stone-800 text-stone-400 transition-colors hover:bg-yellow-500 hover:text-stone-950"
                        title="Editar pedido"
                      >
                        <PencilLine className="size-4" />
                      </button>
                    )}
                    {canAdvance && (
                      <button
                        onClick={() => onAdvanceStatus(order)}
                        className="ml-1 flex items-center gap-1.5 rounded-lg bg-green-500/15 px-3 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-500 hover:text-stone-950"
                      >
                        {order.status === "adicional" ? (
                          <Utensils className="size-4" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        {advanceActionLabel(order.status, isDeliveryTable(order.table_number))}
                      </button>
                    )}
                    {canAddAdditional && (
                      <button
                        onClick={() => onAddAdditional(order)}
                        className="ml-1 flex size-8 items-center justify-center rounded-lg bg-stone-800 text-stone-400 transition-colors hover:bg-yellow-500 hover:text-stone-950"
                        title="Agregar adicional"
                      >
                        <Plus className="size-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Items — regular items first, then additionals grouped by round */}
                <div className="border-t border-white/5 px-5 py-4">
                  <ul className="space-y-3">
                    {/* Regular (non-additional) items */}
                    {order.items.filter((i) => !i.is_additional).map((item) => {
                      const units = splitPerUnit(item);
                      return (
                        <li key={item.id}>
                          {units ? (
                            (() => {
                              const notes = item.notes ?? [];
                              const nonEmpty = notes.filter((n) => n?.trim());
                              if (allNotesSame(notes)) {
                                return (
                                  <div>
                                    <div className="flex items-center justify-between text-base">
                                      <span className="flex items-center gap-2.5 text-stone-300">
                                        <span className="font-bold text-stone-400 tabular-nums">{item.quantity}x</span>
                                        <span>
                                          {item.category_name && (
                                            <span className="text-sm text-stone-600">{item.category_name} · </span>
                                          )}
                                          {item.dish_name}
                                        </span>
                                      </span>
                                      <span className="text-stone-500">
                                        {formatCOP(item.price * item.quantity)}
                                      </span>
                                    </div>
                                    {nonEmpty.length > 0 && (
                                      <p className="ml-7 mt-0.5 text-sm text-amber-400/80">
                                        → {nonEmpty[0]} ({nonEmpty.length}x)
                                      </p>
                                    )}
                                  </div>
                                );
                              }
                              return (
                                <div className="space-y-1.5">
                                  {units.map((u, idx) => (
                                    <div key={idx}>
                                      <div className="flex items-center justify-between text-base">
                                        <span className="flex items-center gap-2.5 text-stone-300">
                                          <span className="font-bold text-stone-400 tabular-nums">1x</span>
                                          <span>
                                            {item.category_name && (
                                              <span className="text-sm text-stone-600">{item.category_name} · </span>
                                            )}
                                            {item.dish_name}
                                          </span>
                                        </span>
                                        <span className="text-stone-500">
                                          {formatCOP(item.price)}
                                        </span>
                                      </div>
                                      {u.note && (
                                        <p className="ml-7 mt-0.5 text-sm text-amber-400/80">
                                          U{idx + 1}: {u.note}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()
                          ) : (
                            <div className="flex items-center justify-between text-base">
                              <span className="flex items-center gap-2.5 text-stone-300">
                                <span className="font-bold text-stone-400 tabular-nums">
                                  {item.quantity}x
                                </span>
                                <span>
                                  {item.category_name && (
                                    <span className="text-sm text-stone-600">{item.category_name} · </span>
                                  )}
                                  {item.dish_name}
                                </span>
                              </span>
                              <span className="text-stone-500">
                                {formatCOP(item.price * item.quantity)}
                              </span>
                            </div>
                          )}
                        </li>
                      );
                    })}

                    {/* Additional items grouped by round */}
                    {Array.from(
                      new Set(order.items.filter((i) => i.is_additional).map((i) => i.additional_number)),
                    ).map((round) => {
                      const roundItems = order.items.filter((i) => i.is_additional && i.additional_number === round);
                      return (
                        <li key={`round-${round}`} className="rounded-lg bg-stone-800/40 px-3 py-2 -mx-1">
                          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                            Adicional #{round}
                          </p>
                          <div className="space-y-2">
                            {roundItems.map((item) => {
                              const units = splitPerUnit(item);
                              return units ? (
                                (() => {
                                  const notes = item.notes ?? [];
                                  const nonEmpty = notes.filter((n) => n?.trim());
                                  if (allNotesSame(notes)) {
                                    return (
                                      <div key={item.id}>
                                        <div className="flex items-center justify-between text-base">
                                          <span className="flex items-center gap-2.5 text-stone-400">
                                            <span className="font-bold text-stone-400 tabular-nums">{item.quantity}x</span>
                                            <span>
                                              {item.category_name && (
                                                <span className="text-sm text-stone-600">{item.category_name} · </span>
                                              )}
                                              {item.dish_name}
                                            </span>
                                          </span>
                                          <span className="text-stone-500">
                                            {formatCOP(item.price * item.quantity)}
                                          </span>
                                        </div>
                                        {nonEmpty.length > 0 && (
                                          <p className="ml-7 mt-0.5 text-sm text-amber-400/80">
                                            → {nonEmpty[0]} ({nonEmpty.length}x)
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }
                                  return (
                                    <div key={item.id} className="space-y-1.5">
                                      {units.map((u, idx) => (
                                        <div key={idx}>
                                          <div className="flex items-center justify-between text-base">
                                            <span className="flex items-center gap-2.5 text-stone-400">
                                              <span className="font-bold text-stone-400 tabular-nums">1x</span>
                                              <span>
                                                {item.category_name && (
                                                  <span className="text-sm text-stone-600">{item.category_name} · </span>
                                                )}
                                                {item.dish_name}
                                              </span>
                                            </span>
                                            <span className="text-stone-500">
                                              {formatCOP(item.price)}
                                            </span>
                                          </div>
                                          {u.note && (
                                            <p className="ml-7 mt-0.5 text-sm text-amber-400/80">
                                              U{idx + 1}: {u.note}
                                            </p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()
                              ) : (
                                <div key={item.id} className="flex items-center justify-between text-base">
                                  <span className="flex items-center gap-2.5 text-stone-400">
                                    <span className="font-bold text-stone-400 tabular-nums">
                                      {item.quantity}x
                                    </span>
                                    <span>
                                      {item.category_name && (
                                        <span className="text-sm text-stone-600">{item.category_name} · </span>
                                      )}
                                      {item.dish_name}
                                    </span>
                                  </span>
                                  <span className="text-stone-500">
                                    {formatCOP(item.price * item.quantity)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </li>
                      );
                    })}
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
