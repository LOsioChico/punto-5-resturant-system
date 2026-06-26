"use client";

import { cn } from "@/lib/utils";
import type { Category, Dish } from "@/lib/types";

/** Left sidebar — vertical category list. Warm, clear, scannable. */
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
    <nav className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-stone-800/80 bg-stone-950 p-2.5">
      {categories.map((cat) => {
        const count = dishes.filter((d) => d.category_id === cat.id).length;
        const isSelected = selected === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(
              "rounded-lg px-3.5 py-3 text-left transition-colors",
              isSelected
                ? "bg-yellow-500/10 text-yellow-500 ring-1 ring-inset ring-yellow-500/20"
                : "text-stone-400 hover:bg-stone-900 hover:text-stone-200",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{cat.name}</span>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  isSelected ? "text-yellow-500/60" : "text-stone-600",
                )}
              >
                {count}
              </span>
            </div>
            {cat.description && (
              <p
                className={cn(
                  "mt-0.5 line-clamp-2 text-xs leading-snug",
                  isSelected ? "text-yellow-500/50" : "text-stone-600",
                )}
              >
                {cat.description}
              </p>
            )}
          </button>
        );
      })}
    </nav>
  );
}
