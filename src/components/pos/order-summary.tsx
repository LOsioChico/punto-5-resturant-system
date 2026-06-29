"use client";

import { useEffect, useRef, useState } from "react";
import { cn, formatCOP, tableLabel, isDeliveryTable, DESECHABLES_PER_DISH } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, Pencil, Send, PencilLine, PlusCircle } from "lucide-react";
import { toggleQuickNote, countParaLlevar, allNotesSame, type CartItem } from "@/lib/pos/logic";
import { getQuickNotes } from "@/lib/pos/quick-notes";

/** Right panel — order summary. Always visible while ordering. */
export function OrderSummary({
  tableNumber,
  deliveryName,
  onDeliveryNameChange,
  deliveryFee,
  onDeliveryFeeChange,
  items,
  onInc,
  onDec,
  onRemove,
  onClear,
  onSend,
  onSetNotes,
  onSetAllNotes,
  sending,
  editingOrderId,
  editHasChanges,
  onSaveEdit,
  onCancelEdit,
  additionalOrderId,
  onSendAdditional,
  onCancelAdditional,
}: {
  tableNumber: number | null;
  deliveryName: string;
  onDeliveryNameChange: (name: string) => void;
  deliveryFee: string;
  onDeliveryFeeChange: (fee: string) => void;
  items: CartItem[];
  onInc: (dishId: string) => void;
  onDec: (dishId: string) => void;
  onRemove: (dishId: string) => void;
  onClear: () => void;
  onSend: () => void;
  onSetNotes: (dishId: string, unitIndex: number, value: string) => void;
  onSetAllNotes: (dishId: string, value: string) => void;
  sending: boolean;
  editingOrderId: string | null;
  editHasChanges: boolean;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  additionalOrderId: string | null;
  onSendAdditional: () => void;
  onCancelAdditional: () => void;
}) {
  // Track which item's notes are being edited
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editingNotesUnit, setEditingNotesUnit] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState<"all" | "perUnit">("all");
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const notesEditorRef = useRef<HTMLDivElement | null>(null);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const isDelivery = tableNumber !== null && isDeliveryTable(tableNumber);
  const isAdditional = additionalOrderId !== null;
  // Delivery forces "Para llevar" on all items → desechables per dish.
  // Additional orders do NOT force it — the waiter decides per item.
  const forceParaLlevar = isDelivery;
  const paraLlevarCount = forceParaLlevar ? itemCount : items.reduce((sum, i) => sum + countParaLlevar(i.notes), 0);
  const desechables = paraLlevarCount * DESECHABLES_PER_DISH;
  const fee = isDelivery ? (parseInt(deliveryFee, 10) || 0) : 0;
  const grandTotal = total + desechables + fee;
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting derived state on prop change
    setConfirmClear(false);
  }, [itemCount, items.length]);

  const sendDisabledReason =
    items.length === 0
      ? "Agrega platos al pedido"
      : tableNumber === null
        ? "Selecciona una mesa"
        : isDeliveryTable(tableNumber) && !deliveryName.trim()
          ? "Identifica al cliente"
          : isDeliveryTable(tableNumber) && !deliveryFee.trim()
            ? "Ingresa el domicilio"
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
            {isAdditional && (
              <span className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-blue-400">
                <PlusCircle className="size-3" />
                Adicional al pedido
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
          {items.length > 0 && !isEditing && !isAdditional && (
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
        {/* Delivery name + fee inputs — shown when Domicilio (table 18) is selected */}
        {tableNumber !== null && isDeliveryTable(tableNumber) && (
          <>
            <input
              type="text"
              value={deliveryName}
              onChange={(e) => onDeliveryNameChange(e.target.value)}
              placeholder="Cómo identificar al cliente..."
              className="mt-3 w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-600 focus:border-yellow-500/50 focus:outline-none"
            />
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-stone-500">Domicilio</span>
              <div className="flex flex-1 items-center rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 focus-within:border-yellow-500/50">
                <span className="text-sm text-stone-600">$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={deliveryFee}
                  onChange={(e) => onDeliveryFeeChange(e.target.value)}
                  placeholder="0"
                  className="w-full bg-transparent text-right text-sm font-semibold text-yellow-500 placeholder:text-stone-600 focus:outline-none"
                />
              </div>
            </div>
          </>
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
                    </span>
                    {forceParaLlevar && (
                      <span className="mt-0.5 block text-xs text-yellow-500/70">
                        + {formatCOP(DESECHABLES_PER_DISH)} desechable ({item.quantity} {item.quantity === 1 ? "unidad" : "unidades"})
                      </span>
                    )}
                    {!forceParaLlevar && countParaLlevar(item.notes) > 0 && (
                      <span className="mt-0.5 block text-xs text-yellow-500/70">
                        + {formatCOP(DESECHABLES_PER_DISH)} desechable ({countParaLlevar(item.notes)} {countParaLlevar(item.notes) === 1 ? "unidad" : "unidades"})
                      </span>
                    )}
                  </div>
                  <span className="text-base font-semibold text-stone-200">
                    {formatCOP(item.price * item.quantity + (forceParaLlevar ? DESECHABLES_PER_DISH * item.quantity : countParaLlevar(item.notes) * DESECHABLES_PER_DISH))}
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

                {/* Notes editor */}
                {editingNotes === item.dish_id ? (
                  <div ref={notesEditorRef} className="mt-3 space-y-2">
                    {/* Mode toggle — only for multi-unit items */}
                    {item.quantity > 1 && (
                      <div className="flex w-fit gap-0.5 rounded-md bg-stone-800/80 p-0.5">
                        <button
                          onClick={() => {
                            // When switching to "Todas", sync notes: copy first unit's note to all
                            const first = item.notes[0] ?? "";
                            if (item.notes.some((n) => n !== first)) {
                              onSetAllNotes(item.dish_id, first);
                            }
                            setNotesMode("all");
                          }}
                          className={cn(
                            "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                            notesMode === "all"
                              ? "bg-stone-600 text-stone-100"
                              : "text-stone-500 hover:text-stone-300",
                          )}
                        >
                          Todas
                        </button>
                        <button
                          onClick={() => {
                            // When switching to perUnit, if all units share equivalent notes
                            // (from "Todas" mode), keep it only on the first unit and clear the rest
                            if (allNotesSame(item.notes) && item.notes[0]?.trim()) {
                              onSetNotes(item.dish_id, 0, item.notes[0]);
                              for (let i = 1; i < item.notes.length; i++) {
                                onSetNotes(item.dish_id, i, "");
                              }
                            }
                            setNotesMode("perUnit");
                          }}
                          className={cn(
                            "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                            notesMode === "perUnit"
                              ? "bg-stone-600 text-stone-100"
                              : "text-stone-500 hover:text-stone-300",
                          )}
                        >
                          Por unidad
                        </button>
                      </div>
                    )}
                    {/* Quick notes — generated from dish description */}
                    {(() => {
                      const quickNotes = getQuickNotes(item.description);
                      if (quickNotes.length <= 1) return null; // Only "Para llevar", skip
                      return (
                    <div className="flex flex-wrap gap-1.5" onMouseDown={(e) => e.preventDefault()}>
                      {quickNotes.map((note) => {
                        // "Para llevar" is locked on for delivery orders
                        const isLockedParaLlevar = forceParaLlevar && note === "Para llevar";
                        // In "all" mode, highlight if any unit has the note
                        // In "perUnit" mode, highlight only the focused unit
                        const active = isLockedParaLlevar || (notesMode === "all" || item.quantity === 1
                          ? item.notes.some((n) =>
                              (n ?? "").split(",").map((p) => p.trim()).includes(note),
                            )
                          : (() => {
                              const unitIdx = editingNotesUnit ?? 0;
                              const currentUnitNotes = item.notes[unitIdx] ?? "";
                              return currentUnitNotes
                                .split(",")
                                .map((p) => p.trim())
                                .includes(note);
                            })());
                        return (
                          <button
                            key={note}
                            disabled={isLockedParaLlevar}
                            onClick={() => {
                              if (isLockedParaLlevar) return;
                              if (item.quantity === 1) {
                                // Single unit — use onSetNotes directly
                                const currentUnitNotes = item.notes[0] ?? "";
                                onSetNotes(item.dish_id, 0, toggleQuickNote(currentUnitNotes, note));
                              } else if (notesMode === "all") {
                                // Toggle on all units
                                const baseNote = item.notes[0] ?? "";
                                const allHave = item.notes.every((n) =>
                                  (n ?? "").split(",").map((p) => p.trim()).includes(note),
                                );
                                const parts = baseNote.split(",").map((p) => p.trim()).filter(Boolean);
                                const newValue = allHave
                                  ? parts.filter((p) => p !== note).join(", ")
                                  : [...parts, note].join(", ");
                                onSetAllNotes(item.dish_id, newValue);
                              } else {
                                const unitIdx = editingNotesUnit ?? 0;
                                const currentUnitNotes = item.notes[unitIdx] ?? "";
                                onSetNotes(item.dish_id, unitIdx, toggleQuickNote(currentUnitNotes, note));
                              }
                            }}
                            className={
                              isLockedParaLlevar
                                ? "cursor-not-allowed rounded-lg bg-yellow-500/15 px-2.5 py-1.5 text-xs font-medium text-yellow-400 ring-1 ring-inset ring-yellow-500/30 opacity-60"
                                : active
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
                    {/* Single input (all units) or one input per unit */}
                    {notesMode === "all" && item.quantity > 1 ? (
                      <input
                        value={item.notes[0] ?? ""}
                        onChange={(e) => onSetAllNotes(item.dish_id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setEditingNotes(null);
                            setEditingNotesUnit(null);
                          }
                        }}
                        placeholder="Nota para todas..."
                        className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-600 focus:border-yellow-500/50 focus:outline-none"
                      />
                    ) : (
                      item.notes.map((note, unitIdx) => (
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
                      ))
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingNotes(item.dish_id);
                      setEditingNotesUnit(0);
                      // Default to "all" mode if all units share equivalent notes, else "perUnit"
                      setNotesMode(allNotesSame(item.notes) ? "all" : "perUnit");
                    }}
                    className="mt-3 flex items-start gap-1.5 text-left text-sm text-stone-600 transition-colors hover:text-stone-300"
                  >
                    <Pencil className="mt-0.5 size-3.5 shrink-0" />
                    {item.notes.some((n) => n.trim()) ? (
                      <div className="flex flex-col gap-0.5">
                        {(() => {
                          const nonEmpty = item.notes.filter((n) => n.trim());
                          if (allNotesSame(item.notes)) {
                            // All units share equivalent notes — show once with count
                            return [<span key={0} className="text-stone-400">→ {nonEmpty[0]} ({nonEmpty.length}x)</span>];
                          }
                          // Different notes per unit — show each with unit number
                          return item.notes.map((n, idx) => (
                            n.trim() ? (
                              <span key={idx} className="text-stone-400">
                                U{idx + 1}: {n.trim()}
                              </span>
                            ) : null
                          )).filter(Boolean);
                        })()}
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
        {/* Desechables breakdown */}
        {desechables > 0 && (
          <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-3">
            <span className="text-xs text-yellow-500/70">
              Desechables ({isDelivery ? itemCount : paraLlevarCount} {isDelivery ? (itemCount === 1 ? "plato" : "platos") : (paraLlevarCount === 1 ? "unidad" : "unidades")})
            </span>
            <span className="text-sm font-semibold text-yellow-500/70">
              {formatCOP(desechables)}
            </span>
          </div>
        )}
        {/* Delivery fee breakdown */}
        {isDelivery && fee > 0 && (
          <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-3">
            <span className="text-xs text-yellow-500/70">Domicilio</span>
            <span className="text-sm font-semibold text-yellow-500/70">
              {formatCOP(fee)}
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
        ) : isAdditional ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              size="lg"
              onClick={onCancelAdditional}
              disabled={sending}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              size="lg"
              onClick={onSendAdditional}
              disabled={items.length === 0 || sending}
            >
              {sending ? "Enviando..." : items.length === 0 ? "Sin platos" : "Enviar adicional"}
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
