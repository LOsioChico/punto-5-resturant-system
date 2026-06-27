"use client";

import { formatCOP } from "@/lib/utils";
import type { Category, Dish } from "@/lib/types";
import { getDishIcon } from "@/components/icons/dish-icons";
import { Minus, Plus } from "lucide-react";

/** Dish grid — auto-fill columns that adapt to available width. */
export function DishGrid({
  dishes,
  categories,
  cart,
  onAdd,
  onInc,
  onDec,
}: {
  dishes: Dish[];
  categories: Category[];
  cart: { dish_id: string; quantity: number }[];
  onAdd: (dish: Dish) => void;
  onInc: (dishId: string) => void;
  onDec: (dishId: string) => void;
}) {
  if (dishes.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-base text-stone-600">Selecciona una categoría</p>
      </div>
    );
  }

  const cartMap = new Map(cart.map((i) => [i.dish_id, i.quantity]));

  return (
    <div className="flex-1 overflow-y-auto bg-stone-950">
      <div className="p-4">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
          {dishes.map((dish) => {
            const category = categories.find((c) => c.id === dish.category_id);
            const Icon = getDishIcon(dish.name, category?.name);
            const qty = cartMap.get(dish.id) ?? 0;
            const inCart = qty > 0;

            return (
              <div
                key={dish.id}
                className={
                  inCart
                    ? "flex flex-col overflow-hidden rounded-xl border-2 border-yellow-500/50 bg-stone-900"
                    : "flex flex-col overflow-hidden rounded-xl border border-white/10 bg-stone-900"
                }
              >
                {/* Top — tap to add */}
                <button
                  onClick={() => onAdd(dish)}
                  className="flex flex-1 flex-col p-3.5 text-left active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={
                        inCart
                          ? "flex size-8 shrink-0 items-center justify-center rounded-lg bg-yellow-500/15"
                          : "flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-800"
                      }
                    >
                      <Icon
                        className={
                          inCart
                            ? "size-4 text-yellow-500"
                            : "size-4 text-stone-500"
                        }
                      />
                    </div>
                    <div className="min-w-0">
                      {category && (
                        <p className="truncate text-xs font-medium uppercase tracking-wide text-stone-600">
                          {category.name}
                        </p>
                      )}
                      <h3 className="line-clamp-2 break-words text-sm font-semibold leading-tight text-stone-100">
                        {dish.name}
                      </h3>
                    </div>
                  </div>

                  {dish.description && (
                    <p className="mt-2 break-words text-xs leading-relaxed text-stone-500">
                      {dish.description}
                    </p>
                  )}
                </button>

                {/* Bottom bar — price + counter */}
                <div className="flex items-center justify-between gap-2 border-t border-white/5 px-3.5 py-3">
                  <span className="shrink-0 text-sm font-bold text-yellow-500">
                    {formatCOP(dish.price)}
                  </span>

                  {inCart ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => onDec(dish.id)}
                        className="flex size-9 items-center justify-center rounded-lg bg-stone-800 text-stone-300 transition active:scale-90 hover:bg-stone-700"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="min-w-6 text-center text-base font-bold text-yellow-500">
                        {qty}
                      </span>
                      <button
                        onClick={() => onInc(dish.id)}
                        className="flex size-9 items-center justify-center rounded-lg bg-stone-800 text-stone-300 transition active:scale-90 hover:bg-stone-700"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onAdd(dish)}
                      className="flex size-9 items-center justify-center rounded-lg bg-stone-800 text-stone-400 transition active:scale-90 hover:bg-yellow-500 hover:text-stone-950"
                    >
                      <Plus className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
