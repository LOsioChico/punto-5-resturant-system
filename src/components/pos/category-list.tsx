"use client";

import { cn } from "@/lib/utils";
import type { Category, Dish } from "@/lib/types";

/** Horizontal category pills — scrollable, tablet-friendly. */
export function CategoryList({
  categories,
  dishes,
  selected,
  onSelect,
}: {
  categories: Category[];
  dishes: Dish[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-white/5 bg-stone-950 px-5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {categories.map((cat) => {
        const count = dishes.filter((d) => d.category_id === cat.id).length;
        const isSelected = selected === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 transition-colors active:scale-[0.98]",
              isSelected
                ? "bg-yellow-500/10 text-yellow-500 ring-1 ring-inset ring-yellow-500/20"
                : "text-stone-400 hover:bg-stone-900 hover:text-stone-200",
            )}
          >
            <span className="text-base font-semibold whitespace-nowrap">{cat.name}</span>
            <span
              className={cn(
                "text-sm tabular-nums",
                isSelected ? "text-yellow-500/60" : "text-stone-600",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
