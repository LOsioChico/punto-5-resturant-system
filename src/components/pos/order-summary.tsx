"use client";

import { formatCOP } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Minus, Plus, Trash2, Pencil, Send } from "lucide-react";
import { useState } from "react";

export interface CartItem {
  dish_id: string;
  dish_name: string;
  category_name: string;
  price: number;
  quantity: number;
  notes: string;
}

/** Right panel — order summary. Warm, clear, focused on the order. */
export function OrderSummary({
  tableNumber,
  items,
  onInc,
  onDec,
  onRemove,
  onClear,
  onSend,
  onSetNotes,
  sending,
}: {
  tableNumber: number | null;
  items: CartItem[];
  onInc: (dishId: string) => void;
  onDec: (dishId: string) => void;
  onRemove: (dishId: string) => void;
  onClear: () => void;
  onSend: () => void;
  onSetNotes: (dishId: string, notes: string) => void;
  sending: boolean;
}) {
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-white/5 bg-stone-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-stone-100">
            {tableNumber !== null ? `Mesa ${tableNumber}` : "Sin mesa"}
          </h2>
          <p className="text-sm text-stone-500">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={onClear}
            className="rounded-lg px-3 py-2 text-sm text-stone-500 transition-colors hover:bg-stone-800 hover:text-red-400"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <EmptyState
            icon={<Send className="size-7" />}
            title="Pedido vacío"
            description="Toca un plato para agregarlo"
          />
        ) : (
          <ul className="divide-y divide-white/5">
            {items.map((item) => (
              <li key={item.dish_id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="block text-base font-medium text-stone-100">
                      {item.dish_name}
                    </span>
                    <span className="text-sm text-stone-500">
                      {formatCOP(item.price)} c/u
                    </span>
                  </div>
                  <span className="text-base font-semibold text-stone-200">
                    {formatCOP(item.price * item.quantity)}
                  </span>
                </div>

                {/* Counter + remove */}
                <div className="mt-3 flex items-center gap-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onDec(item.dish_id)}
                      className="flex size-10 items-center justify-center rounded-lg bg-stone-800 text-stone-300 transition active:scale-90 hover:bg-stone-700"
                    >
                      <Minus className="size-5" />
                    </button>
                    <span className="min-w-8 text-center text-lg font-bold text-stone-100">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onInc(item.dish_id)}
                      className="flex size-10 items-center justify-center rounded-lg bg-stone-800 text-stone-300 transition active:scale-90 hover:bg-stone-700"
                    >
                      <Plus className="size-5" />
                    </button>
                  </div>
                  <button
                    onClick={() => onRemove(item.dish_id)}
                    className="flex size-10 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="size-5" />
                  </button>
                </div>

                {/* Notes */}
                {editingNotes === item.dish_id ? (
                  <input
                    autoFocus
                    value={item.notes}
                    onChange={(e) => onSetNotes(item.dish_id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") {
                        setEditingNotes(null);
                      }
                    }}
                    onBlur={() => setEditingNotes(null)}
                    placeholder="Ej: sin cebolla, extra picante..."
                    className="mt-3 w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2.5 text-sm text-stone-100 placeholder:text-stone-600 focus:border-yellow-500/50 focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setEditingNotes(item.dish_id)}
                    className="mt-3 flex items-center gap-1.5 text-sm text-stone-600 transition-colors hover:text-stone-300"
                  >
                    <Pencil className="size-3.5" />
                    {item.notes ? (
                      <span className="text-stone-400">{item.notes}</span>
                    ) : (
                      <span>Nota</span>
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 px-5 py-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium uppercase tracking-wider text-stone-500">
            Total
          </span>
          <span className="text-2xl font-bold text-yellow-500">
            {formatCOP(total)}
          </span>
        </div>
        <Button
          className="w-full"
          size="lg"
          onClick={onSend}
          disabled={items.length === 0 || tableNumber === null || sending}
        >
          {sending ? "Enviando..." : "Enviar a cocina"}
        </Button>
        {tableNumber === null && items.length > 0 && (
          <p className="mt-2 text-center text-sm text-stone-500">
            Selecciona una mesa primero
          </p>
        )}
      </div>
    </aside>
  );
}
