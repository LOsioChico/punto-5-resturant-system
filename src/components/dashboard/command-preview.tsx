"use client";

import { formatCOP, formatTime } from "@/lib/utils";
import type { Order } from "@/lib/types";

/**
 * Kitchen ticket preview — styled as a white paper receipt.
 * Items are grouped by category so kitchen stations can prep efficiently.
 * This is the layout that will eventually be sent to a printer.
 */
export function CommandPreview({ order }: { order: Order }) {
  // Group items by category_name
  const grouped = new Map<string, typeof order.items>();
  for (const item of order.items) {
    const cat = item.category_name ?? "Sin categoría";
    const list = grouped.get(cat) ?? [];
    list.push(item);
    grouped.set(cat, list);
  }

  return (
    <div className="mx-auto max-w-xs">
      {/* Paper receipt — white background, black text */}
      <div className="rounded-sm bg-white p-4 font-mono text-sm text-stone-900 shadow-lg">
        {/* Serrated top edge effect */}
        <div className="-mx-4 -mt-4 mb-3 h-3 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,#000_4px,#000_5px)] opacity-10" />

        <div className="text-center">
          <p className="text-lg font-bold tracking-wider">PUNTO 5</p>
          <p className="text-xs text-stone-500">Comanda de cocina</p>
        </div>

        <div className="my-2 border-t border-dashed border-stone-300" />

        <div className="flex justify-between text-xs">
          <span className="font-semibold">Mesa: {order.table_number}</span>
          <span>{formatTime(order.created_at)}</span>
        </div>
        <p className="text-xs">Mesero: {order.waiter_name}</p>

        <div className="my-2 border-t border-dashed border-stone-300" />

        {/* Items grouped by category */}
        {Array.from(grouped.entries()).map(([category, items]) => (
          <div key={category} className="mb-2">
            <p className="mb-1 border-b border-stone-200 text-xs font-bold uppercase tracking-wider text-stone-700">
              {category}
            </p>
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.id} className="flex gap-2">
                  <span className="font-semibold">{item.quantity}x</span>
                  <div className="flex-1">
                    <span>{item.dish_name}</span>
                    {item.notes && (
                      <p className="pl-3 text-xs italic text-stone-600">
                        → {item.notes}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="my-2 border-t border-dashed border-stone-300" />

        <div className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span>{formatCOP(order.total)}</span>
        </div>

        <div className="my-2 border-t border-dashed border-stone-300" />
        <p className="text-center text-xs text-stone-400">
          --- Fin de comanda ---
        </p>

        {/* Serrated bottom edge effect */}
        <div className="-mx-4 -mb-4 mt-3 h-3 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,#000_4px,#000_5px)] opacity-10" />
      </div>
    </div>
  );
}
