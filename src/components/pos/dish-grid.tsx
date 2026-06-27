"use client";

import { formatCOP } from "@/lib/utils";
import type { Category, Dish } from "@/lib/types";
import { getDishIcon } from "@/components/icons/dish-icons";
import { Minus, Plus } from "lucide-react";

/** Middle area — grid of dishes. Warm cards with clear hierarchy. */
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
      <div className="flex flex-1 items-center justify-center text-sm text-stone-600">
        Selecciona una categoría
      </div>
    );
  }

  const cartMap = new Map(cart.map((i) => [i.dish_id, i.quantity]));

  return (
    <div className="flex-1 overflow-y-auto bg-stone-950">
      <div className="p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
                    ? "flex flex-col overflow-hidden rounded-2xl border-2 border-yellow-500/50 bg-stone-900"
                    : "flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-stone-900"
                }
              >
                {/* Top — icon + name + description (tap to add) */}
                <button
                  onClick={() => onAdd(dish)}
                  className="flex flex-1 flex-col p-4 text-left active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={
                        inCart
                          ? "flex size-11 shrink-0 items-center justify-center rounded-xl bg-yellow-500/15"
                          : "flex size-11 shrink-0 items-center justify-center rounded-xl bg-stone-800"
                      }
                    >
                      <Icon
                        className={
                          inCart
                            ? "size-6 text-yellow-500"
                            : "size-6 text-stone-500"
                        }
                      />
                    </div>
                    <h3 className="text-base font-semibold leading-tight text-stone-100">
                      {dish.name}
                    </h3>
                  </div>

                  {dish.description && (
                    <p className="mt-3 text-sm leading-relaxed text-stone-500">
                      {dish.description}
                    </p>
                  )}
                </button>

                {/* Bottom bar — price + counter */}
                <div className="flex items-center justify-between border-t border-white/5 px-4 py-3.5">
                  <span className="text-base font-bold text-yellow-500">
                    {formatCOP(dish.price)}
                  </span>

                  {inCart ? (
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => onDec(dish.id)}
                        className="flex size-10 items-center justify-center rounded-xl bg-stone-800 text-stone-300 transition active:scale-90 hover:bg-stone-700"
                      >
                        <Minus className="size-5" />
                      </button>
                      <span className="min-w-8 text-center text-lg font-bold text-yellow-500">
                        {qty}
                      </span>
                      <button
                        onClick={() => onInc(dish.id)}
                        className="flex size-10 items-center justify-center rounded-xl bg-stone-800 text-stone-300 transition active:scale-90 hover:bg-stone-700"
                      >
                        <Plus className="size-5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onAdd(dish)}
                      className="flex size-10 items-center justify-center rounded-xl bg-stone-800 text-stone-400 transition active:scale-90 hover:bg-yellow-500 hover:text-stone-950"
                    >
                      <Plus className="size-5" />
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
