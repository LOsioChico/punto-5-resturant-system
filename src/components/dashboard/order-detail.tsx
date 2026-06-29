"use client";

import { useState } from "react";
import { cn, formatCOP, formatTime, timeAgo, tableLabel, tableShortName, DESECHABLES_PER_DISH, isDeliveryTable, splitPerUnit } from "@/lib/utils";
import { allNotesSame } from "@/lib/pos/logic";
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
  PencilLine,
  Bike,
} from "lucide-react";

const STATUS_FLOW: OrderStatus[] = ["nueva", "en_cocina", "lista", "servida"];

const NEXT_ACTION: Record<OrderStatus, { label: string; icon: React.ReactNode }> = {
  nueva: { label: "Enviar a cocina", icon: <ChefHat className="size-4" /> },
  en_cocina: { label: "Marcar como lista", icon: <CheckCircle2 className="size-4" /> },
  lista: { label: "Marcar como servida", icon: <Utensils className="size-4" /> },
  servida: { label: "", icon: null },
  adicional: { label: "Marcar como lista", icon: <CheckCircle2 className="size-4" /> },
};

const EVENT_LABELS: Record<string, string> = {
  created: "Pedido creado",
  status_changed: "Cambio de estado",
  printed: "Impresión de comanda",
  updated: "Actualización",
  cancelled: "Cancelación",
  additional_added: "Adicional agregado",
  delivery_fee_set: "Domicilio actualizado",
};

const STATUS_LABELS: Record<string, string> = {
  nueva: "Nueva",
  en_cocina: "En cocina",
  lista: "Lista",
  servida: "Servida",
  adicional: "Adicional",
};

const STATUS_COLORS: Record<OrderStatus, { dot: string; text: string; bg: string }> = {
  nueva: { dot: "bg-red-500", text: "text-red-400", bg: "bg-red-500/10" },
  en_cocina: { dot: "bg-amber-500", text: "text-amber-400", bg: "bg-amber-500/10" },
  lista: { dot: "bg-green-500", text: "text-green-400", bg: "bg-green-500/10" },
  servida: { dot: "bg-stone-600", text: "text-stone-400", bg: "bg-stone-800" },
  adicional: { dot: "bg-blue-500", text: "text-blue-400", bg: "bg-blue-500/10" },
};

/** Right panel — order detail. */
export function OrderDetail({
  order,
  events,
  onAdvanceStatus,
  onPrint,
  onSetDeliveryFee,
  disabled = false,
}: {
  order: Order | null;
  events: OrderEvent[];
  onAdvanceStatus: (id: string) => void;
  onPrint: (id: string, version?: { type: "full" | "additional"; round?: number }) => void;
  onSetDeliveryFee: (id: string, fee: number) => void;
  disabled?: boolean;
}) {
  const [deliveryFeeInput, setDeliveryFeeInput] = useState("");
  const [editingFee, setEditingFee] = useState(false);
  const [printAdditional, setPrintAdditional] = useState<number | undefined>(undefined);

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
  // 'adicional' is not in STATUS_FLOW — it advances to 'lista'
  const nextStatus = order.status === "adicional" ? "lista" as OrderStatus : STATUS_FLOW[currentIndex + 1];
  const action = NEXT_ACTION[order.status];
  const printCount = events.filter((e) => e.event_type === "printed").length;
  const colors = STATUS_COLORS[order.status];
  // "Modificado" badge: only show when the order has an "updated" event
  // (from saveEditedOrder), not when additionals were added.
  const wasModified = events.some((e) => e.event_type === "updated");

  return (
    <div className="flex h-full flex-col">
      {/* Header — table + status + progress */}
      <div className="bg-stone-900/50 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={
              isDeliveryTable(order.table_number)
                ? "flex size-12 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-400"
                : "flex size-12 items-center justify-center rounded-xl bg-stone-800 text-xl font-bold text-stone-100"
            }>
              {isDeliveryTable(order.table_number) ? <Bike className="size-6" /> : tableShortName(order.table_number)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-100">
                {tableLabel(order.table_number)}
              </h2>
              {order.delivery_name && (
                <p className="mt-0.5 text-sm font-medium text-yellow-400">
                  Para: {order.delivery_name}
                </p>
              )}
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
          <div className="flex flex-col items-end gap-2">
            <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${colors.bg}`}>
              <span className={`size-2 rounded-full ${colors.dot}`} />
              <span className={`text-sm font-medium ${colors.text}`}>
                {STATUS_LABELS[order.status]}
              </span>
            </div>
            {wasModified && order.updated_at && (
              <span className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
                <PencilLine className="size-3" />
                Modificado por {order.updated_by} · {timeAgo(order.updated_at)}
              </span>
            )}
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
                onClick={() => {
                  onPrint(order.id, printAdditional !== undefined
                    ? { type: "additional", round: printAdditional }
                    : { type: "full" });
                }}
                disabled={disabled}
              >
                <Printer className="size-3.5" />
                Imprimir
              </Button>
            </div>
          </div>

          {/* Preview version tabs — show if order has adicionals */}
          {order.items.some((i) => i.is_additional) ? (
            <div className="mb-3 flex flex-wrap gap-1.5 rounded-lg bg-stone-900/60 p-1.5">
              <button
                onClick={() => setPrintAdditional(undefined)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                  printAdditional === undefined
                    ? "bg-blue-500/20 text-blue-300 ring-1 ring-inset ring-blue-500/40"
                    : "text-stone-400 hover:bg-stone-800 hover:text-stone-200",
                )}
              >
                Comanda completa
              </button>
              {Array.from(
                new Set(order.items.filter((i) => i.is_additional).map((i) => i.additional_number)),
              ).map((round) => (
                <button
                  key={round}
                  onClick={() => setPrintAdditional(round ?? undefined)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                    printAdditional === round
                      ? "bg-blue-500/20 text-blue-300 ring-1 ring-inset ring-blue-500/40"
                      : "text-stone-400 hover:bg-stone-800 hover:text-stone-200",
                  )}
                >
                  Adicional #{round}
                </button>
              ))}
            </div>
          ) : null}

          <CommandPreview order={order} additionalOnly={printAdditional} wasModified={wasModified} />
        </div>

        {/* Items — regular items first, then additionals grouped by round */}
        <div className="mb-6">
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Items del pedido
          </h3>
          <ul className="overflow-hidden rounded-xl bg-stone-900">
            {/* Regular (non-additional) items */}
            {order.items.filter((i) => !i.is_additional).map((item, idx) => {
              const units = splitPerUnit(item);
              return units ? (
                <div key={item.id}>
                  {(() => {
                    const notes = item.notes ?? [];
                    const nonEmpty = notes.filter((n) => n?.trim());
                    if (allNotesSame(notes)) {
                      const count = nonEmpty.length;
                      return (
                        <li
                          className={`flex items-center gap-3 p-3.5 ${idx > 0 ? "border-t border-white/5" : ""}`}
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums bg-stone-800 text-stone-200">
                            {item.quantity}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="block text-sm text-stone-100">
                              {item.dish_name}
                            </span>
                            {count > 0 && (
                              <span className="block truncate text-xs text-amber-400/80">
                                → {nonEmpty[0]} ({count}x)
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium text-stone-400">
                            {formatCOP(item.price * item.quantity)}
                          </span>
                        </li>
                      );
                    }
                    return units.map((u, unitIdx) => (
                      <li
                        key={`${item.id}-${unitIdx}`}
                        className={`flex items-center gap-3 p-3.5 ${idx > 0 || unitIdx > 0 ? "border-t border-white/5" : ""}`}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums bg-stone-800 text-stone-200">
                          1
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block text-sm text-stone-100">
                            {item.dish_name}
                          </span>
                          {u.note && (
                            <span className="block truncate text-xs text-amber-400/80">
                              U{unitIdx + 1}: {u.note}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-stone-400">
                          {formatCOP(item.price)}
                        </span>
                      </li>
                    ));
                  })()}
                </div>
              ) : (
                <li
                  key={item.id}
                  className={`flex items-center gap-3 p-3.5 ${idx > 0 ? "border-t border-white/5" : ""}`}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums bg-stone-800 text-stone-200">
                    {item.quantity}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm text-stone-100">
                      {item.dish_name}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-stone-400">
                    {formatCOP(item.price * item.quantity)}
                  </span>
                </li>
              );
            })}

            {/* Additional items grouped by round */}
            {Array.from(
              new Set(order.items.filter((i) => i.is_additional).map((i) => i.additional_number)),
            ).map((round) => {
              const roundItems = order.items.filter((i) => i.is_additional && i.additional_number === round);
              return (
                <div key={`round-${round}`}>
                  <div className="flex items-center gap-2 border-t border-white/5 bg-stone-800/30 px-3.5 py-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      Adicional #{round}
                    </span>
                  </div>
                  {roundItems.map((item, idx) => {
                    const units = splitPerUnit(item);
                    return units ? (
                      (() => {
                        const notes = item.notes ?? [];
                        const nonEmpty = notes.filter((n) => n?.trim());
                        if (allNotesSame(notes)) {
                          const count = nonEmpty.length;
                          return (
                            <li
                              key={item.id}
                              className={`flex items-center gap-3 p-3.5 ${idx > 0 ? "border-t border-white/5" : ""} bg-stone-800/20`}
                            >
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums bg-stone-800 text-stone-400">
                                {item.quantity}
                              </span>
                              <div className="min-w-0 flex-1">
                                <span className="block text-sm text-stone-400">
                                  {item.dish_name}
                                </span>
                                {count > 0 && (
                                  <span className="block truncate text-xs text-amber-400/80">
                                    → {nonEmpty[0]} ({count}x)
                                  </span>
                                )}
                              </div>
                              <span className="text-sm font-medium text-stone-400">
                                {formatCOP(item.price * item.quantity)}
                              </span>
                            </li>
                          );
                        }
                        return units.map((u, unitIdx) => (
                          <li
                            key={`${item.id}-${unitIdx}`}
                            className={`flex items-center gap-3 p-3.5 ${idx > 0 || unitIdx > 0 ? "border-t border-white/5" : ""} bg-stone-800/20`}
                          >
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums bg-stone-800 text-stone-400">
                              1
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="block text-sm text-stone-400">
                                {item.dish_name}
                              </span>
                              {u.note && (
                                <span className="block truncate text-xs text-amber-400/80">
                                  U{unitIdx + 1}: {u.note}
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-medium text-stone-400">
                              {formatCOP(item.price)}
                            </span>
                          </li>
                        ));
                      })()
                    ) : (
                      <li
                        key={item.id}
                        className={`flex items-center gap-3 p-3.5 ${idx > 0 ? "border-t border-white/5" : ""} bg-stone-800/20`}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums bg-stone-800 text-stone-400">
                          {item.quantity}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block text-sm text-stone-400">
                            {item.dish_name}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-stone-400">
                          {formatCOP(item.price * item.quantity)}
                        </span>
                      </li>
                    );
                  })}
                </div>
              );
            })}
          </ul>

          {order.delivery_name && (
            <>
              <div className="mt-3 flex items-center justify-between border-t border-white/5 px-1 pt-2">
                <span className="text-xs text-yellow-500/70">
                  Desechables ({order.items.reduce((s, i) => s + i.quantity, 0)})
                </span>
                <span className="text-sm font-semibold text-yellow-500/70">
                  {formatCOP(order.items.reduce((s, i) => s + i.quantity, 0) * DESECHABLES_PER_DISH)}
                </span>
              </div>
              {/* Delivery fee — admin editable */}
              <div className="flex items-center justify-between px-1 pt-1">
                <span className="text-xs text-yellow-500/70">Domicilio</span>
                {editingFee ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-stone-600">$</span>
                    <input
                      type="number"
                      autoFocus
                      value={deliveryFeeInput}
                      onChange={(e) => setDeliveryFeeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const fee = parseInt(deliveryFeeInput, 10) || 0;
                          onSetDeliveryFee(order.id, fee);
                          setEditingFee(false);
                        } else if (e.key === "Escape") {
                          setEditingFee(false);
                        }
                      }}
                      onBlur={() => {
                        const fee = parseInt(deliveryFeeInput, 10) || 0;
                        onSetDeliveryFee(order.id, fee);
                        setEditingFee(false);
                      }}
                      placeholder="0"
                      className="w-24 rounded border border-stone-700 bg-stone-800 px-2 py-0.5 text-right text-sm text-stone-100 placeholder:text-stone-600 focus:border-yellow-500/50 focus:outline-none"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setDeliveryFeeInput(order.delivery_fee ? String(order.delivery_fee) : "");
                      setEditingFee(true);
                    }}
                    disabled={disabled}
                    className="text-sm font-semibold text-yellow-500/70 transition-colors hover:text-yellow-400 disabled:opacity-50"
                  >
                    {order.delivery_fee > 0 ? formatCOP(order.delivery_fee) : "Agregar"}
                  </button>
                )}
              </div>
            </>
          )}
          <div className="mt-3 flex items-center justify-between px-1">
            <span className="text-sm text-stone-500">Total</span>
            <span className="text-xl font-bold text-yellow-500">
              {formatCOP(order.total)}
            </span>
          </div>
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
              {events.map((event, idx) => {
                const meta = event.metadata as {
                  added?: number;
                  updated?: number;
                  removed?: number;
                  item_count?: number;
                  total?: number;
                  table_number?: number;
                  added_items?: { name: string; qty: number }[];
                  updated_items?: { name: string; qty: number; old_qty: number; notes: string | null; old_notes: string | null }[];
                  removed_items?: { name: string; qty: number }[];
                  version?: "full" | "additional";
                  additional_round?: number;
                  additional_number?: number;
                  additional_total?: number;
                  new_total?: number;
                };
                const changes: string[] = [];
                if (meta.added) changes.push(`+${meta.added} agregado${meta.added > 1 ? "s" : ""}`);
                if (meta.updated) changes.push(`${meta.updated} modificado${meta.updated > 1 ? "s" : ""}`);
                if (meta.removed) changes.push(`-${meta.removed} eliminado${meta.removed > 1 ? "s" : ""}`);

                // Detailed change lines
                const detailLines: { text: string; type: "add" | "mod" | "del" }[] = [];
                for (const item of meta.added_items ?? []) {
                  detailLines.push({ text: `${item.name} (${item.qty}x)`, type: "add" });
                }
                for (const item of meta.updated_items ?? []) {
                  const parts: string[] = [];
                  if (item.qty !== item.old_qty) parts.push(`${item.old_qty}x → ${item.qty}x`);
                  // Compare notes arrays — normalize to strings for comparison
                  const newNotesStr = Array.isArray(item.notes) ? item.notes.join("; ") : (item.notes ?? "");
                  const oldNotesStr = Array.isArray(item.old_notes) ? item.old_notes.join("; ") : (item.old_notes ?? "");
                  if (newNotesStr !== oldNotesStr) {
                    parts.push(newNotesStr ? `nota: "${newNotesStr}"` : "sin nota");
                  }
                  detailLines.push({
                    text: `${item.name}${parts.length > 0 ? ` — ${parts.join(", ")}` : ""}`,
                    type: "mod",
                  });
                }
                for (const item of meta.removed_items ?? []) {
                  detailLines.push({ text: `${item.name} (${item.qty}x)`, type: "del" });
                }

                return (
                  <li key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={
                          event.event_type === "created"
                            ? "size-2.5 shrink-0 rounded-full bg-yellow-500 ring-4 ring-yellow-500/10"
                            : event.event_type === "printed"
                              ? "size-2.5 shrink-0 rounded-full bg-blue-400 ring-4 ring-blue-400/10"
                              : event.event_type === "updated"
                                ? "size-2.5 shrink-0 rounded-full bg-amber-500 ring-4 ring-amber-500/10"
                                : event.event_type === "additional_added"
                                  ? "size-2.5 shrink-0 rounded-full bg-blue-500 ring-4 ring-blue-500/10"
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
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
                        <User className="size-3 text-stone-600" />
                        <span className="text-stone-400">{event.actor_name}</span>
                        {event.from_status && event.to_status && (
                          <>
                            {" · "}
                            {STATUS_LABELS[event.from_status] ?? event.from_status}
                            {" → "}
                            {STATUS_LABELS[event.to_status] ?? event.to_status}
                          </>
                        )}
                      </p>
                      {/* Print version info */}
                      {event.event_type === "printed" && (
                        <p className="mt-1 text-xs text-blue-400/80">
                          {meta.version === "additional" && meta.additional_round
                            ? `Adicional #${meta.additional_round}`
                            : "Comanda completa"}
                        </p>
                      )}
                      {/* Additional added details */}
                      {event.event_type === "additional_added" && (
                        <p className="mt-1 text-xs text-blue-400/80">
                          Adicional #{meta.additional_number} · {meta.item_count} {meta.item_count === 1 ? "plato" : "platos"}
                          {meta.additional_total ? ` · ${formatCOP(meta.additional_total)}` : ""}
                        </p>
                      )}
                      {changes.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {changes.map((c) => (
                            <span
                              key={c}
                              className={
                                c.startsWith("+")
                                  ? "rounded bg-green-500/10 px-1.5 py-0.5 text-[11px] font-medium text-green-400"
                                  : c.startsWith("-")
                                    ? "rounded bg-red-500/10 px-1.5 py-0.5 text-[11px] font-medium text-red-400"
                                    : "rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-400"
                              }
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                      {detailLines.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {detailLines.map((d, i) => (
                            <li
                              key={i}
                              className={
                                d.type === "add"
                                  ? "text-[11px] text-green-400/80"
                                  : d.type === "del"
                                    ? "text-[11px] text-red-400/80"
                                    : "text-[11px] text-amber-400/80"
                              }
                            >
                              {d.type === "add" ? "+ " : d.type === "del" ? "− " : "~ "}
                              {d.text}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      {/* Action bar */}
      {nextStatus && action.label ? (
        <div className="bg-stone-900/50 p-4">
          <Button
            className="w-full transition-all active:scale-[0.98]"
            size="lg"
            onClick={() => onAdvanceStatus(order.id)}
            disabled={disabled}
          >
            {action.icon}
            {action.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
