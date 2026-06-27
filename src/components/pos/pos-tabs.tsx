"use client";

import { cn } from "@/lib/utils";

export type PosTab = "new" | "history";

/** Tab bar — warm underline, yellow active state. */
export function PosTabs({
  active,
  onChange,
  historyCount,
}: {
  active: PosTab;
  onChange: (tab: PosTab) => void;
  historyCount: number;
}) {
  return (
    <div className="flex gap-2 border-b border-white/5 bg-stone-950 px-5">
      <button
        onClick={() => onChange("new")}
        className={cn(
          "px-5 py-3.5 text-base font-medium transition-colors",
          active === "new"
            ? "border-b-2 border-yellow-500 text-yellow-500"
            : "border-b-2 border-transparent text-stone-500 hover:text-stone-300",
        )}
      >
        Nuevo pedido
      </button>
      <button
        onClick={() => onChange("history")}
        className={cn(
          "flex items-center gap-2 px-5 py-3.5 text-base font-medium transition-colors",
          active === "history"
            ? "border-b-2 border-yellow-500 text-yellow-500"
            : "border-b-2 border-transparent text-stone-500 hover:text-stone-300",
        )}
      >
        Mis pedidos
        {historyCount > 0 && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
              active === "history"
                ? "bg-yellow-500/20 text-yellow-500"
                : "bg-stone-900 text-stone-600",
            )}
          >
            {historyCount}
          </span>
        )}
      </button>
    </div>
  );
}
