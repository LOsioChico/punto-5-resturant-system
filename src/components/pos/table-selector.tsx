"use client";

import { cn, TABLE_COUNT, DELIVERY_TABLE } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

// Subtle status indicator — just a dot, not a full colored box
const statusDot: Record<OrderStatus, string> = {
  nueva: "bg-red-500",
  en_cocina: "bg-amber-500",
  servida: "bg-green-500",
  finalizada: "bg-stone-600",
  adicional: "bg-blue-500",
};

/** Top section — table selector. Minimal, clean, status as a dot not a full color wash. */
export function TableSelector({
  selected,
  onSelect,
  tableStatuses,
}: {
  selected: number | null;
  onSelect: (table: number) => void;
  tableStatuses: Map<number, OrderStatus>;
}) {
  return (
    <div className="border-b border-white/5 bg-stone-950 px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
          Seleccionar mesa
        </h2>
        <div className="flex items-center gap-4 text-xs text-stone-600">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-red-500" /> Nueva
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-amber-500" /> Cocina
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-green-500" /> Servida
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-blue-500" /> Adicional
          </span>
        </div>
      </div>
      <div className="grid grid-cols-6 gap-3 sm:grid-cols-8 lg:grid-cols-12">
        {/* Regular tables 1-17 */}
        {Array.from({ length: TABLE_COUNT }, (_, i) => i + 1).map((table) => {
          const status = tableStatuses.get(table);
          const isSelected = selected === table;

          return (
            <button
              key={table}
              onClick={() => onSelect(table)}
              className={cn(
                "relative flex h-16 items-center justify-center rounded-xl border transition-colors active:scale-95",
                isSelected
                  ? "border-yellow-500 bg-yellow-500 text-stone-950 shadow-lg shadow-yellow-500/20"
                  : status
                    ? "border-stone-700 bg-stone-900 text-stone-200 hover:border-stone-600"
                    : "border-white/10 bg-stone-900 text-stone-400 hover:border-stone-700 hover:text-stone-200",
              )}
            >
              <span className="text-xl font-bold leading-none">{table}</span>
              {status && (
                <span
                  className={cn(
                    "absolute right-2 top-2 size-2 rounded-full ring-2",
                    isSelected ? "ring-yellow-500" : "ring-stone-900",
                    statusDot[status],
                  )}
                />
              )}
            </button>
          );
        })}
        {/* Delivery / to-go table (18) */}
        {(() => {
          const table = DELIVERY_TABLE;
          const status = tableStatuses.get(table);
          const isSelected = selected === table;
          return (
            <button
              key={table}
              onClick={() => onSelect(table)}
              className={cn(
                "relative flex h-16 items-center justify-center rounded-xl border transition-colors active:scale-95",
                "col-span-2 sm:col-span-2 lg:col-span-2",
                isSelected
                  ? "border-yellow-500 bg-yellow-500 text-stone-950 shadow-lg shadow-yellow-500/20"
                  : status
                    ? "border-stone-700 bg-stone-900 text-stone-200 hover:border-stone-600"
                    : "border-dashed border-yellow-500/30 bg-stone-900 text-yellow-500/70 hover:border-yellow-500/50 hover:text-yellow-500",
              )}
            >
              <span className="text-sm font-bold leading-tight">Domicilio</span>
            </button>
          );
        })()}
      </div>
    </div>
  );
}
