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
    <nav className="flex w-64 shrink-0 flex-col gap-1.5 overflow-y-auto border-r border-white/5 bg-stone-950 p-3">
      {categories.map((cat) => {
        const count = dishes.filter((d) => d.category_id === cat.id).length;
        const isSelected = selected === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(
              "rounded-lg px-4 py-4 text-left transition-colors active:scale-[0.98]",
              isSelected
                ? "bg-yellow-500/10 text-yellow-500 ring-1 ring-inset ring-yellow-500/20"
                : "text-stone-400 hover:bg-stone-900 hover:text-stone-200",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-base font-semibold">{cat.name}</span>
              <span
                className={cn(
                  "text-sm tabular-nums",
                  isSelected ? "text-yellow-500/60" : "text-stone-600",
                )}
              >
                {count}
              </span>
            </div>
            {cat.description && (
              <p
                className={cn(
                  "mt-1 line-clamp-2 text-sm leading-snug",
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
