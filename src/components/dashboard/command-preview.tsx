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
      <div
        className="print-receipt rounded-sm bg-white p-4 font-mono text-sm shadow-lg"
        style={{ color: "#1c1917" }}
      >
        {/* Serrated top edge effect */}
        <div className="-mx-4 -mt-4 mb-3 h-3 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,#000_4px,#000_5px)] opacity-10" />

        <div className="text-center">
          <p className="text-lg font-bold tracking-wider text-black">PUNTO 5</p>
          <p className="text-xs text-stone-600">Comanda de cocina</p>
        </div>

        <div className="my-2 border-t border-dashed border-stone-300" />

        <div className="flex justify-between text-xs text-black">
          <span className="font-semibold">Mesa: {order.table_number}</span>
          <span className="text-black">
            {order.updated_at ? formatTime(order.updated_at) : formatTime(order.created_at)}
          </span>
        </div>
        <p className="text-xs text-black">Mesero: {order.waiter_name}</p>

        <div className="my-2 border-t border-dashed border-stone-300" />

        {/* Items grouped by category */}
        {Array.from(grouped.entries()).map(([category, items]) => (
          <div key={category} className="mb-2">
            <p className="mb-1 border-b border-stone-200 text-xs font-bold uppercase tracking-wider text-stone-800">
              {category}
            </p>
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li key={item.id} className="text-black">
                  <div className="flex gap-2">
                    <span className="font-semibold text-black">{item.quantity}x</span>
                    <span className="text-black">{item.dish_name}</span>
                  </div>
                  {item.notes && (
                    <p className="ml-5 border-l-2 border-stone-400 pl-1.5 text-xs font-semibold text-stone-700">
                      {item.notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="my-2 border-t border-dashed border-stone-300" />

        <div className="flex justify-between font-bold text-black">
          <span>TOTAL</span>
          <span>{formatCOP(order.total)}</span>
        </div>

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
