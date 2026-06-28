"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { formatCOP, tableLabel } from "@/lib/utils";
import type { Order, Dish, Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { X, Plus, Minus, Search, Send } from "lucide-react";

interface CartEntry {
  dish: Dish;
  quantity: number;
}

/** Modal for adding additional items to a served order. */
export function AddAdditionalModal({
  order,
  onClose,
  onSend,
}: {
  order: Order;
  onClose: () => void;
  onSend: (items: { dish_id: string; dish_name: string; price: number; quantity: number }[]) => Promise<void>;
}) {
  const supabase = createSupabaseClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("dishes").select("*").order("sort_order"),
    ]).then(([catRes, dishRes]) => {
      if (catRes.data) setCategories(catRes.data as Category[]);
      if (dishRes.data) setDishes(dishRes.data as Dish[]);
      setLoading(false);
    });
  }, [supabase]);

  const filteredDishes = dishes.filter((d) => {
    if (search.trim()) {
      return d.name.toLowerCase().includes(search.toLowerCase());
    }
    if (selectedCategory) return d.category_id === selectedCategory;
    return true;
  });

  const addToCart = useCallback((dish: Dish) => {
    setCart((prev) => {
      const existing = prev[dish.id];
      return { ...prev, [dish.id]: { dish, quantity: (existing?.quantity ?? 0) + 1 } };
    });
  }, []);

  const incItem = useCallback((dishId: string) => {
    setCart((prev) => {
      const existing = prev[dishId];
      if (!existing) return prev;
      return { ...prev, [dishId]: { ...existing, quantity: existing.quantity + 1 } };
    });
  }, []);

  const decItem = useCallback((dishId: string) => {
    setCart((prev) => {
      const existing = prev[dishId];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const next = { ...prev };
        delete next[dishId];
        return next;
      }
      return { ...prev, [dishId]: { ...existing, quantity: existing.quantity - 1 } };
    });
  }, []);

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce((sum, e) => sum + e.dish.price * e.quantity, 0);

  const handleSend = async () => {
    if (cartItems.length === 0) return;
    setSending(true);
    await onSend(
      cartItems.map((e) => ({
        dish_id: e.dish.id,
        dish_name: e.dish.name,
        price: e.dish.price,
        quantity: e.quantity,
      })),
    );
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/10 bg-stone-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-stone-100">
              Adicional — {tableLabel(order.table_number)}
            </h2>
            <p className="text-xs text-stone-500">
              Selecciona los platos para agregar al pedido
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-800 hover:text-stone-300"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Search + categories */}
        <div className="border-b border-white/5 px-5 py-3">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar plato..."
              className="w-full rounded-lg border border-stone-700 bg-stone-900 py-2 pl-10 pr-3 text-sm text-stone-100 placeholder:text-stone-600 focus:border-yellow-500/50 focus:outline-none"
            />
          </div>
          {!search.trim() && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  !selectedCategory
                    ? "bg-yellow-500/15 text-yellow-400 ring-1 ring-inset ring-yellow-500/30"
                    : "bg-stone-900 text-stone-400 hover:bg-stone-800"
                }`}
              >
                Todas
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedCategory === cat.id
                      ? "bg-yellow-500/15 text-yellow-400 ring-1 ring-inset ring-yellow-500/30"
                      : "bg-stone-900 text-stone-400 hover:bg-stone-800"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dish list */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className="text-center text-sm text-stone-500">Cargando menú...</p>
          ) : filteredDishes.length === 0 ? (
            <p className="text-center text-sm text-stone-500">No se encontraron platos</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filteredDishes.map((dish) => {
                const inCart = cart[dish.id];
                return (
                  <li
                    key={dish.id}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-stone-900 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-100">{dish.name}</p>
                      <p className="text-xs text-stone-500">{formatCOP(dish.price)}</p>
                    </div>
                    {inCart ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => decItem(dish.id)}
                          className="flex size-7 items-center justify-center rounded-lg bg-stone-800 text-stone-300 transition active:scale-90 hover:bg-stone-700"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="min-w-6 text-center text-sm font-bold text-stone-100 tabular-nums">
                          {inCart.quantity}
                        </span>
                        <button
                          onClick={() => incItem(dish.id)}
                          className="flex size-7 items-center justify-center rounded-lg bg-stone-800 text-stone-300 transition active:scale-90 hover:bg-stone-700"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(dish)}
                        className="flex size-8 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-400 transition-colors hover:bg-yellow-500 hover:text-stone-950"
                      >
                        <Plus className="size-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer — cart summary + send */}
        {cartItems.length > 0 && (
          <div className="border-t border-white/5 bg-stone-950/50 px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-stone-500">
                {cartItems.reduce((s, e) => s + e.quantity, 0)} {cartItems.reduce((s, e) => s + e.quantity, 0) === 1 ? "plato" : "platos"}
              </span>
              <span className="text-lg font-bold text-yellow-500">{formatCOP(cartTotal)}</span>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? "Enviando..." : "Enviar adicional a cocina"}
              {!sending && <Send className="size-4" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
