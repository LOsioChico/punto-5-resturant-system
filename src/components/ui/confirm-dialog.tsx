"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

/**
 * Reusable confirmation dialog.
 *
 * Renders a modal overlay with a title, message, and confirm/cancel buttons.
 * Closes on Escape key or click outside. The confirm button can show a
 * loading spinner when `loading` is true.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger",
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "default";
  loading?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-stone-800 bg-stone-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex flex-col items-center gap-3 text-center">
          <h3 className="text-lg font-semibold text-stone-100">{title}</h3>
          <p className="text-sm text-stone-500">{message}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-stone-800 px-4 py-2.5 text-sm font-medium text-stone-300 transition-colors hover:bg-stone-900 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
              variant === "danger"
                ? "bg-red-500 hover:bg-red-400"
                : "bg-yellow-500 text-stone-950 hover:bg-yellow-400"
            }`}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
