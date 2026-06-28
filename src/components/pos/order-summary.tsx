"use client";

import { useEffect, useRef, useState } from "react";
import { cn, formatCOP, tableLabel, isDeliveryTable, DESECHABLES_PER_DISH } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, Pencil, Send, PencilLine } from "lucide-react";
import { toggleQuickNote, type CartItem } from "@/lib/pos/logic";
import { getQuickNotes } from "@/lib/pos/quick-notes";

/** Right panel — order summary. Always visible while ordering. */
export function OrderSummary({
  tableNumber,
  deliveryName,
  onDeliveryNameChange,
  items,
  onInc,
  onDec,
  onRemove,
  onClear,
  onSend,
  onSetNotes,
  sending,
  editingOrderId,
  editHasChanges,
  onSaveEdit,
  onCancelEdit,
}: {
  tableNumber: number | null;
  deliveryName: string;
  onDeliveryNameChange: (name: string) => void;
  items: CartItem[];
  onInc: (dishId: string) => void;
  onDec: (dishId: string) => void;
  onRemove: (dishId: string) => void;
  onClear: () => void;
  onSend: () => void;
  onSetNotes: (dishId: string, unitIndex: number, value: string) => void;
  sending: boolean;
  editingOrderId: string | null;
  editHasChanges: boolean;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  // Track which item's notes are being edited
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editingNotesUnit, setEditingNotesUnit] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const notesEditorRef = useRef<HTMLDivElement | null>(null);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const isDelivery = tableNumber !== null && isDeliveryTable(tableNumber);
  const desechables = isDelivery ? itemCount * DESECHABLES_PER_DISH : 0;
  const grandTotal = total + desechables;
  const isEditing = editingOrderId !== null;

  // Close notes editor when clicking outside of it.
  // Uses 'click' (not 'mousedown') so button onClick handlers (like +/- counters)
  // fire first, then the editor closes — both in the same batched re-render.
  useEffect(() => {
    if (!editingNotes) return;
    const handler = (e: MouseEvent) => {
      if (notesEditorRef.current && !notesEditorRef.current.contains(e.target as Node)) {
        setEditingNotes(null);
        setEditingNotesUnit(null);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [editingNotes]);

  // Cancel clear confirmation if items change (e.g. user adds an item while "¿Seguro?" is showing)
  useEffect(() => {
    setConfirmClear(false);
  }, [itemCount, items.length]);

  const sendDisabledReason =
    items.length === 0
      ? "Agrega platos al pedido"
      : tableNumber === null
        ? "Selecciona una mesa"
        : isDeliveryTable(tableNumber) && !deliveryName.trim()
          ? "Identifica al cliente"
          : null;

  const showTooltip = () => {
    if (sendDisabledReason) {
      setTooltip(sendDisabledReason);
      setTimeout(() => setTooltip(null), 3000);
    }
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-white/5 bg-stone-900">
      {/* Header */}
      <div className="border-b border-white/5 px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            {isEditing && (
              <span className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-amber-400">
                <PencilLine className="size-3" />
                Editando pedido
              </span>
            )}
            {tableNumber !== null ? (
              <h2 className="text-base font-bold text-stone-100">{tableLabel(tableNumber)}</h2>
            ) : (
              <h2 className="text-base font-bold text-stone-100">Sin mesa</h2>
            )}
            <p className="text-xs text-stone-500">
              {itemCount} {itemCount === 1 ? "plato" : "platos"}
            </p>
          </div>
          {items.length > 0 && !isEditing && (
            <button
              onClick={() => {
                if (confirmClear) {
                  onClear();
                setConfirmClear(false);
              } else {
                setConfirmClear(true);
                setTimeout(() => setConfirmClear(false), 3000);
              }
            }}
            className={cn(
              "rounded-lg px-3 py-2 text-sm transition-colors",
              confirmClear
                ? "bg-red-500/10 text-red-400"
                : "text-stone-500 hover:bg-stone-800 hover:text-red-400",
            )}
          >
            {confirmClear ? "¿Seguro?" : "Limpiar"}
          </button>
        )}
        </div>
        {/* Delivery name input — shown when Domicilio (table 18) is selected */}
        {tableNumber !== null && isDeliveryTable(tableNumber) && (
          <input
            type="text"
            value={deliveryName}
            onChange={(e) => onDeliveryNameChange(e.target.value)}
            placeholder="Cómo identificar al cliente..."
            className="mt-3 w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-600 focus:border-yellow-500/50 focus:outline-none"
          />
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-xl bg-stone-800">
              <Send className="size-7 text-stone-600" />
            </div>
            <div>
              <p className="text-base font-medium text-stone-400">Pedido vacío</p>
              <p className="mt-1 text-sm text-stone-600">Toca un plato para agregarlo</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {items.map((item) => (
              <li key={item.dish_id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {item.category_name && (
                      <span className="text-[11px] font-medium uppercase tracking-wide text-stone-600">
                        {item.category_name}
                      </span>
                    )}
                    <span className="block text-base font-medium text-stone-100">
                      {item.dish_name}
                    </span>
                    <span className="text-sm text-stone-500">
                      {formatCOP(item.price)} c/u
                      {isDelivery && (
                        <span className="text-yellow-500/70">
                          {" "}+ {formatCOP(DESECHABLES_PER_DISH)} desechable
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="text-base font-semibold text-stone-200">
                    {formatCOP(item.price * item.quantity + (isDelivery ? DESECHABLES_PER_DISH * item.quantity : 0))}
                  </span>
                </div>

                {/* Counter + remove */}
                <div className="mt-3 flex items-center gap-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onDec(item.dish_id)}
                      className="flex size-9 items-center justify-center rounded-lg bg-stone-800 text-stone-300 transition active:scale-90 hover:bg-stone-700"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="min-w-8 text-center text-lg font-bold text-stone-100">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onInc(item.dish_id)}
                      className="flex size-9 items-center justify-center rounded-lg bg-stone-800 text-stone-300 transition active:scale-90 hover:bg-stone-700"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => onRemove(item.dish_id)}
                    className="flex size-9 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                {/* Notes — one input per unit */}
                {editingNotes === item.dish_id ? (
                  <div ref={notesEditorRef} className="mt-3 space-y-2">
                    {/* Quick notes — generated from dish description */}
                    {(() => {
                      const quickNotes = getQuickNotes(item.description);
                      if (quickNotes.length <= 1) return null; // Only "Para llevar", skip
                      return (
                    <div className="flex flex-wrap gap-1.5" onMouseDown={(e) => e.preventDefault()}>
                      {quickNotes.map((note) => {
                        // Highlight only if the focused unit has this note
                        const unitIdx = editingNotesUnit ?? 0;
                        const currentUnitNotes = item.notes[unitIdx] ?? "";
                        const active = currentUnitNotes
                          .split(",")
                          .map((p) => p.trim())
                          .includes(note);
                        return (
                          <button
                            key={note}
                            onClick={() => {
                              onSetNotes(item.dish_id, unitIdx, toggleQuickNote(currentUnitNotes, note));
                            }}
                            className={
                              active
                                ? "rounded-lg bg-yellow-500/15 px-2.5 py-1.5 text-xs font-medium text-yellow-400 ring-1 ring-inset ring-yellow-500/30"
                                : "rounded-lg bg-stone-800 px-2.5 py-1.5 text-xs text-stone-300 transition-colors hover:bg-stone-700 hover:text-stone-100"
                            }
                          >
                            {note}
                          </button>
                        );
                      })}
                    </div>
                      );
                    })()}
                    {/* One input per unit */}
                    {item.notes.map((note, unitIdx) => (
                      <input
                        key={unitIdx}
                        value={note}
                        onChange={(e) => onSetNotes(item.dish_id, unitIdx, e.target.value)}
                        onFocus={() => setEditingNotesUnit(unitIdx)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setEditingNotes(null);
                            setEditingNotesUnit(null);
                          }
                        }}
                        placeholder={item.quantity > 1 ? `Nota unidad ${unitIdx + 1}...` : "Nota..."}
                        className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-600 focus:border-yellow-500/50 focus:outline-none"
                      />
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingNotes(item.dish_id);
                      setEditingNotesUnit(0);
                    }}
                    className="mt-3 flex items-center gap-1.5 text-sm text-stone-600 transition-colors hover:text-stone-300"
                  >
                    <Pencil className="size-3.5" />
                    {item.notes.some((n) => n.trim()) ? (
                      <div className="flex flex-col items-start gap-0.5">
                        {item.notes.map((n, idx) => (
                          <span key={idx} className="text-stone-400">
                            {n.trim() ? `→ ${n}` : null}
                          </span>
                        )).filter(Boolean)}
                      </div>
                    ) : (
                      <span>Nota{item.quantity > 1 ? ` (${item.quantity} unidades)` : ""}</span>
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 bg-stone-950/50 px-5 py-5">
        {/* Delivery fee breakdown */}
        {isDelivery && desechables > 0 && (
          <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-3">
            <span className="text-xs text-yellow-500/70">
              Desechables {itemCount}×{formatCOP(DESECHABLES_PER_DISH)}
            </span>
            <span className="text-sm font-semibold text-yellow-500/70">
              {formatCOP(desechables)}
            </span>
          </div>
        )}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium uppercase tracking-wider text-stone-500">
            Total
          </span>
          <span className="text-2xl font-bold text-yellow-500">
            {formatCOP(grandTotal)}
          </span>
        </div>
        {isEditing ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              size="lg"
              onClick={onCancelEdit}
              disabled={sending}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              size="lg"
              onClick={onSaveEdit}
              disabled={items.length === 0 || sending || !editHasChanges}
            >
              {sending ? "Guardando..." : items.length === 0 ? "Sin platos" : "Guardar cambios"}
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Button
              className={cn("w-full", sendDisabledReason && "opacity-40")}
              size="lg"
              onClick={sendDisabledReason ? showTooltip : onSend}
            >
              {sending ? "Enviando..." : "Enviar a cocina"}
            </Button>
            {tooltip && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-stone-800 px-3 py-2 text-sm text-stone-100 shadow-xl ring-1 ring-white/10">
                {tooltip}
                <div className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-stone-800 ring-1 ring-white/10" />
              </div>
            )}
          </div>
        )}
        {!isEditing && tableNumber === null && items.length > 0 && (
          <p className="mt-2.5 text-center text-sm text-amber-400/80">
            Selecciona una mesa primero
          </p>
        )}
      </div>
    </aside>
  );
}
