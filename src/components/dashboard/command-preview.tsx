"use client";

import { formatCOP, formatTime, tableLabel, isDeliveryTable, DESECHABLES_PER_DISH, splitPerUnit } from "@/lib/utils";
import { allNotesSame } from "@/lib/pos/logic";
import type { Order } from "@/lib/types";

/**
 * Kitchen ticket preview — styled as a white paper receipt.
 * Items are grouped by category so kitchen stations can prep efficiently.
 * This is the layout that will eventually be sent to a printer.
 */
export function CommandPreview({ order, additionalOnly, wasModified }: { order: Order; additionalOnly?: number; wasModified?: boolean }) {
  // Filter items: if additionalOnly is set, show only that round; otherwise show all
  const items = additionalOnly !== undefined
    ? order.items.filter((i) => i.is_additional && i.additional_number === additionalOnly)
    : order.items;

  // Group items by category_name
  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const cat = item.category_name ?? "Sin categoría";
    const list = grouped.get(cat) ?? [];
    list.push(item);
    grouped.set(cat, list);
  }

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const isDelivery = isDeliveryTable(order.table_number);
  // Desechables: delivery adds per dish, non-delivery adds per unit with "Para llevar" in notes
  const paraLlevarCount = isDelivery ? 0 : items.reduce((sum, i) => {
    const notes = i.notes ?? [];
    return sum + notes.filter((n: string | null) => n?.split(",").map((p) => p.trim().toLowerCase()).includes("para llevar")).length;
  }, 0);
  const desechables = (isDelivery ? itemCount : paraLlevarCount) * DESECHABLES_PER_DISH;
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <div className="mx-auto max-w-xs">
      {/* Paper receipt — white background, black text */}
      <div
        className="print-receipt rounded-sm bg-white p-4 font-mono text-sm shadow-lg"
        style={{ color: "#1c1917" }}
      >
        {/* Serrated top edge effect */}
        <div className="-mx-4 -mt-4 mb-3 h-3 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,#000_4px,#000_5px)] opacity-10" />

        {/* Header */}
        <div className="text-center">
          <p className="text-lg font-bold tracking-wider text-black">PUNTO 5</p>
          <p className="text-xs text-stone-600">
            {additionalOnly !== undefined ? "ADICIONAL #" + additionalOnly : "Comanda de cocina"}
          </p>
        </div>

        <div className="my-2 border-t border-dashed border-stone-300" />

        {/* Meta — table, time, waiter */}
        <div className="flex items-center justify-between text-xs text-black">
          <span className="text-base font-bold">{tableLabel(order.table_number)}</span>
          <span className="font-semibold text-black">
            {order.updated_at ? formatTime(order.updated_at) : formatTime(order.created_at)}
          </span>
        </div>
        {/* Delivery customer name — shown prominently for delivery orders */}
        {order.delivery_name && (
          <div className="mt-2 mb-2 rounded border border-stone-400 bg-stone-100 px-2 py-1.5 text-center">
            <span className="text-xs text-stone-500">Para: </span>
            <span className="text-sm font-bold text-black">{order.delivery_name}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-stone-600">
          <span>{order.waiter_name}</span>
          <span>{itemCount} {itemCount === 1 ? "plato" : "platos"}</span>
        </div>

        {wasModified && (
          <p className="mt-1.5 text-center text-xs font-bold uppercase tracking-widest text-stone-700">
            ★ Modificada ★
          </p>
        )}

        <div className="my-2 border-t border-dashed border-stone-300" />

        {/* Items grouped by category */}
        {Array.from(grouped.entries()).map(([category, items]) => (
          <div key={category} className="mb-3">
            <p className="mb-1.5 border-b border-stone-300 text-xs font-bold uppercase tracking-wider text-stone-800">
              {category}
            </p>
            <ul className="space-y-2">
              {items.map((item) => {
                const units = splitPerUnit(item);
                return (
                  <li key={item.id} className="text-black">
                    {units ? (
                      (() => {
                        const notes = item.notes ?? [];
                        const nonEmpty = notes.filter((n) => n?.trim());
                        // Group when all non-empty notes are equivalent
                        if (allNotesSame(notes)) {
                          const count = nonEmpty.length;
                          return (
                            <div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-base font-bold tabular-nums text-black">{item.quantity}x</span>
                                <span className="text-sm font-semibold text-black">{item.dish_name}</span>
                              </div>
                              {count > 0 && (
                                <p className="mt-0.5 ml-6 text-xs italic text-stone-600">
                                  → {nonEmpty[0]} ({count}x)
                                </p>
                              )}
                            </div>
                          );
                        }
                        // Different notes per unit — show each with unit number
                        return units.map((u, idx) => (
                          <div key={idx} className={idx > 0 ? "mt-1" : ""}>
                            <div className="flex items-baseline gap-2">
                              <span className="text-base font-bold tabular-nums text-black">1x</span>
                              <span className="text-sm font-semibold text-black">{item.dish_name}</span>
                            </div>
                            {u.note && (
                              <p className="mt-0.5 ml-6 text-xs italic text-stone-600">
                                U{idx + 1}: {u.note}
                              </p>
                            )}
                          </div>
                        ));
                      })()
                    ) : (
                      // Grouped when no notes
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-bold tabular-nums text-black">
                          {item.quantity}x
                        </span>
                        <span className="text-sm font-semibold text-black">
                          {item.dish_name}
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="my-2 border-t border-dashed border-stone-300" />

        {/* Total */}
        {additionalOnly !== undefined ? (
          // Additional-only print: show just the additional subtotal
          <>
            {desechables > 0 && (
              <div className="flex items-center justify-between text-xs text-stone-600">
                <span>Desechables ({isDelivery ? itemCount : paraLlevarCount})</span>
                <span>{formatCOP(desechables)}</span>
              </div>
            )}
            <div className="flex items-center justify-between font-bold text-black">
              <span>TOTAL ADICIONAL</span>
              <span className="text-base">{formatCOP(subtotal + desechables)}</span>
            </div>
          </>
        ) : (
          <>
            {isDelivery && (
              <>
                <div className="flex items-center justify-between text-xs text-stone-600">
                  <span>Subtotal</span>
                  <span>{formatCOP(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-stone-600">
                  <span>Desechables ({itemCount})</span>
                  <span>{formatCOP(desechables)}</span>
                </div>
                {order.delivery_fee > 0 && (
                  <div className="flex items-center justify-between text-xs text-stone-600">
                    <span>Domicilio</span>
                    <span>{formatCOP(order.delivery_fee)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex items-center justify-between font-bold text-black">
              <span>TOTAL</span>
              <span className="text-base">{formatCOP(order.total)}</span>
            </div>
          </>
        )}

        <div className="my-2 border-t border-dashed border-stone-300" />
        <p className="text-center text-xs text-stone-600">
          --- Fin de comanda ---
        </p>

        {/* Serrated bottom edge effect */}
        <div className="-mx-4 -mb-4 mt-3 h-3 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,#000_4px,#000_5px)] opacity-10" />
      </div>
    </div>
  );
}
