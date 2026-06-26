"use client";

import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

const TABLE_COUNT = 12;

// Subtle status indicator — just a dot, not a full colored box
const statusDot: Record<OrderStatus, string> = {
  nueva: "bg-red-500",
  en_cocina: "bg-amber-500",
  lista: "bg-green-500",
  servida: "bg-stone-600",
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
    <div className="border-b border-stone-800/80 bg-stone-950 px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          Seleccionar mesa
        </h2>
        <div className="flex items-center gap-4 text-[11px] text-stone-600">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-red-500" /> Nueva
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" /> Cocina
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-green-500" /> Lista
          </span>
        </div>
      </div>
      <div className="grid grid-cols-6 gap-2.5 sm:grid-cols-8 lg:grid-cols-12">
        {Array.from({ length: TABLE_COUNT }, (_, i) => i + 1).map((table) => {
          const status = tableStatuses.get(table);
          const isSelected = selected === table;

          return (
            <button
              key={table}
              onClick={() => onSelect(table)}
              className={cn(
                "relative flex h-16 flex-col items-center justify-center rounded-xl border transition-all active:scale-95",
                isSelected
                  ? "border-yellow-500 bg-yellow-500 text-stone-950 shadow-lg shadow-yellow-500/20"
                  : status
                    ? "border-stone-700 bg-stone-900 text-stone-200 hover:border-stone-600"
                    : "border-stone-800 bg-stone-900 text-stone-400 hover:border-stone-700 hover:text-stone-200",
              )}
            >
              <span className="text-xl font-bold leading-none">{table}</span>
              {isSelected && (
                <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide">
                  Mesa
                </span>
              )}
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
      </div>
    </div>
  );
}
